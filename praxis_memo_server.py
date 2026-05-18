from __future__ import annotations

import argparse
import json
import logging
import mimetypes
import os
import re
import ssl
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime, date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
BACKUP_DIR = APP_DIR / "backups"
TMP_DIR = DATA_DIR / "tmp"
DATA_FILE = DATA_DIR / "praxismemo-data.json"
STATE_FILE = DATA_DIR / "backup-state.json"
LOG_FILE = DATA_DIR / "server.log"
AUTO_BACKUP_INTERVAL_SECONDS = 30 * 60
MAX_BACKUPS_PER_DAY = 30
KEEP_DAILY_DAYS = 90
MAX_AUDIO_BYTES = 50 * 1024 * 1024  # 50 MB hard cap

WHISPER_MODEL_NAME = "base"
OLLAMA_BASE = "http://127.0.0.1:11434"
OLLAMA_MODEL = "qwen2.5:3b"
OLLAMA_TIMEOUT_SECONDS = 240
OLLAMA_NUM_CTX = 12288   # ~5000 Wörter Eingabe sicher verarbeitbar
MAX_TRANSCRIPT_WORDS = 5000  # darüber: Server lehnt ab (Inhalt würde verloren gehen)

# Demo-Modus: wenn OPENAI_API_KEY gesetzt ist, geht Strukturierung an OpenAI statt Ollama
# NUR FÜR DEMO MIT FIKTIVEN DATEN — verlässt den PC, geht in die USA
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = "gpt-4o-mini"
OPENAI_TIMEOUT_SECONDS = 60


def _https_context() -> ssl.SSLContext:
    """SSL context with certifi CA bundle if available — fixes macOS python.org cert issue."""
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


_HTTPS_CTX = _https_context()


def ensure_dirs() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    BACKUP_DIR.mkdir(exist_ok=True)
    TMP_DIR.mkdir(exist_ok=True)
    # Clean leftover audio fragments from previous runs (privacy)
    for leftover in TMP_DIR.glob("*"):
        try:
            leftover.unlink()
        except OSError:
            pass


# ---------- Logging ----------
logger = logging.getLogger("praxismemo")
logger.setLevel(logging.WARNING)


def setup_logging() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    if logger.handlers:
        return
    handler = logging.FileHandler(str(LOG_FILE), encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)


# ---------- Whisper ----------
_whisper_model = None
_whisper_lock = threading.Lock()
_whisper_available: bool | None = None


def _load_whisper_model():
    global _whisper_model, _whisper_available
    with _whisper_lock:
        if _whisper_model is not None:
            return _whisper_model
        try:
            from faster_whisper import WhisperModel  # type: ignore
            _whisper_model = WhisperModel(WHISPER_MODEL_NAME, device="cpu", compute_type="int8")
            _whisper_available = True
        except Exception:
            logger.exception("Whisper-Modell konnte nicht geladen werden")
            _whisper_available = False
    return _whisper_model


def whisper_available() -> bool:
    global _whisper_available
    if _whisper_available is None:
        try:
            import faster_whisper  # type: ignore  # noqa: F401
            _whisper_available = True
        except ImportError:
            _whisper_available = False
    return bool(_whisper_available)


def transcribe_audio(audio_bytes: bytes, content_type: str) -> str:
    model = _load_whisper_model()
    if model is None:
        raise RuntimeError("faster-whisper nicht verfügbar")

    ext = "ogg" if "ogg" in content_type else "webm"
    tmp_path = TMP_DIR / f"audio-{int(time.time() * 1000)}-{threading.get_ident()}.{ext}"
    tmp_path.write_bytes(audio_bytes)

    try:
        segments, _ = model.transcribe(str(tmp_path), language="de", beam_size=5)
        return " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        try:
            tmp_path.unlink()
        except OSError:
            pass


# ---------- Ollama proxy ----------

def ollama_available() -> bool:
    try:
        with urllib.request.urlopen(f"{OLLAMA_BASE}/api/tags", timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False


def _check_word_limit(transcript: str) -> None:
    word_count = len([w for w in transcript.split() if w])
    if word_count > MAX_TRANSCRIPT_WORDS:
        raise RuntimeError(
            f"Transkript zu lang ({word_count} Wörter, Maximum {MAX_TRANSCRIPT_WORDS}). "
            "Bitte in mehrere Memos aufteilen — sonst geht Inhalt verloren."
        )


# CJK characters that small multilingual LLMs (e.g. qwen2.5:3b) sometimes drift into
# mid-sentence on German prompts. Includes Han, Hiragana, Katakana, Hangul, fullwidth forms.
_CJK_PATTERN = re.compile(
    r"[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿가-힯＀-￯]+"
)


def _strip_cjk(text: str) -> str:
    if not isinstance(text, str):
        return text
    cleaned = _CJK_PATTERN.sub(" ", text)
    return re.sub(r"\s+", " ", cleaned).strip()


def _structure_messages(transcript: str) -> list:
    user_prompt = (
        "Du bist ein Dokumentationssystem für eine psychotherapeutische Praxis. "
        "Analysiere die folgende Sitzungs-Nachnotiz einer Therapeutin und verteile den Inhalt "
        "präzise auf vier Felder.\n\n"
        f"Nachnotiz:\n{transcript}\n\n"
        "WICHTIG: Antworte AUSSCHLIESSLICH auf Deutsch. Verwende KEINE chinesischen, "
        "japanischen, koreanischen oder andere fremdsprachigen Schriftzeichen — nur deutsche "
        "Buchstaben, Umlaute und Standard-Satzzeichen.\n\n"
        "Antworte ausschließlich mit einem JSON-Objekt (kein Text davor oder danach):\n"
        "{\n"
        '  "core": "Kernpunkte und wichtigste Themen dieser Sitzung in 2-3 Sätzen",\n'
        '  "agreement": "Konkrete Vereinbarungen und Aufgaben des Patienten bis zum nächsten Termin",\n'
        '  "open": "Noch offene Fragen und Themen, die weiter beobachtet werden müssen",\n'
        '  "watch": "Beobachtungsfokus für den nächsten Termin — mögliche Warnsignale, Ressourcen, offene Klärungen"\n'
        "}"
    )
    return [
        {"role": "system", "content": (
            "Du bist ein präzises medizinisches Dokumentationssystem für eine deutschsprachige Praxis. "
            "Antworte ausschließlich auf Deutsch und ausschließlich mit dem geforderten JSON-Objekt, "
            "ohne weitere Erklärungen. Verwende niemals chinesische, japanische, koreanische oder "
            "andere fremdsprachige Schriftzeichen."
        )},
        {"role": "user", "content": user_prompt},
    ]


def _extract_json(content: str) -> dict:
    if not content:
        raise RuntimeError("Leere Antwort vom Modell")
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise RuntimeError("Kein JSON in Modell-Antwort")
    parsed = json.loads(content[start:end + 1])
    # Strip CJK glyphs the model may have leaked into German strings (Plan B safety net).
    if isinstance(parsed, dict):
        for key, value in list(parsed.items()):
            if isinstance(value, str):
                parsed[key] = _strip_cjk(value)
    return parsed


def structure_via_ollama(transcript: str) -> dict:
    _check_word_limit(transcript)

    body = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": _structure_messages(transcript),
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.1,
            "num_ctx": OLLAMA_NUM_CTX,
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_BASE}/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT_SECONDS) as resp:
        response_data = json.loads(resp.read().decode("utf-8"))

    content = (response_data.get("message") or {}).get("content", "").strip()
    return _extract_json(content)


def openai_available() -> bool:
    return bool(OPENAI_API_KEY)


def structure_via_openai(transcript: str) -> dict:
    """DEMO-Modus: Strukturierung über OpenAI. Sendet Transkript an US-Server!"""
    _check_word_limit(transcript)

    body = json.dumps({
        "model": OPENAI_MODEL,
        "messages": _structure_messages(transcript),
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=OPENAI_TIMEOUT_SECONDS, context=_HTTPS_CTX) as resp:
        response_data = json.loads(resp.read().decode("utf-8"))

    choices = response_data.get("choices") or []
    if not choices:
        raise RuntimeError("OpenAI: keine Antwort")
    content = (choices[0].get("message") or {}).get("content", "").strip()
    return _extract_json(content)


def structure_transcript(transcript: str) -> tuple[dict, str]:
    """Returns (result_dict, mode) where mode is 'openai-demo' or 'local'."""
    if openai_available():
        return structure_via_openai(transcript), "openai-demo"
    return structure_via_ollama(transcript), "local"


def now_stamp() -> str:
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def today_folder() -> Path:
    return BACKUP_DIR / datetime.now().strftime("%Y-%m-%d")


def read_json(path: Path, fallback):
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def write_json_atomic(path: Path, payload) -> None:
    path.parent.mkdir(exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    os.replace(temp_path, path)


def create_backup(payload, prefix: str) -> Path:
    folder = today_folder()
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"praxismemo-{prefix}-{now_stamp()}.json"
    write_json_atomic(target, payload)
    prune_backups()
    return target


def maybe_create_auto_backup(payload) -> None:
    state = read_json(STATE_FILE, {})
    last_backup_at = float(state.get("last_auto_backup_at", 0) or 0)
    if time.time() - last_backup_at < AUTO_BACKUP_INTERVAL_SECONDS:
        return
    create_backup(payload, "auto")
    state["last_auto_backup_at"] = time.time()
    write_json_atomic(STATE_FILE, state)


def prune_backups() -> None:
    today = date.today()

    # Per-day cap: keep newest MAX_BACKUPS_PER_DAY backups per folder
    for day_dir in BACKUP_DIR.iterdir():
        if not day_dir.is_dir():
            continue
        day_files = sorted(
            day_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for old in day_files[MAX_BACKUPS_PER_DAY:]:
            try:
                old.unlink()
            except OSError:
                pass

    # Remove day folders older than KEEP_DAILY_DAYS that are empty
    for day_dir in BACKUP_DIR.iterdir():
        if not day_dir.is_dir():
            continue
        try:
            folder_date = datetime.strptime(day_dir.name, "%Y-%m-%d").date()
        except ValueError:
            continue
        if (today - folder_date).days > KEEP_DAILY_DAYS:
            try:
                day_dir.rmdir()  # only removes if empty
            except OSError:
                pass


def load_payload():
    return read_json(DATA_FILE, {})


def save_payload(payload) -> None:
    write_json_atomic(DATA_FILE, payload)
    maybe_create_auto_backup(payload)


def payload_from_request(handler: BaseHTTPRequestHandler):
    length = int(handler.headers.get("Content-Length", "0") or 0)
    if length <= 0:
        return {}
    body = handler.rfile.read(length)
    return json.loads(body.decode("utf-8"))


class PraxisMemoHandler(BaseHTTPRequestHandler):
    server_version = "PraxisMemoLocal/2.0"

    def log_message(self, format, *args):  # noqa: A002
        return

    def send_json(self, status: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urllib.parse.urlparse(self.path).path

        if path == "/api/load":
            payload = load_payload()
            self.send_json(200, payload if payload else {"patients": None})
            return

        if path == "/api/status":
            self.send_json(200, {"ok": True, "dataFile": str(DATA_FILE), "backupDir": str(BACKUP_DIR)})
            return

        if path == "/api/transcribe-status":
            self.send_json(200, {"available": whisper_available()})
            return

        if path == "/api/structure-status":
            if openai_available():
                self.send_json(200, {"available": True, "mode": "openai-demo"})
            else:
                self.send_json(200, {"available": ollama_available(), "mode": "local"})
            return

        self.serve_static(path)

    def do_POST(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        try:
            payload = payload_from_request(self)
        except json.JSONDecodeError:
            self.send_json(400, {"ok": False, "error": "Invalid JSON"})
            return

        if path == "/api/save":
            if not isinstance(payload.get("patients"), list):
                self.send_json(400, {"ok": False, "error": "Missing patients"})
                return
            save_payload(payload)
            self.send_json(200, {"ok": True})
            return

        if path == "/api/transcribe":
            length = int(self.headers.get("Content-Length", "0") or 0)
            if length <= 0:
                self.send_json(400, {"ok": False, "error": "Keine Audiodaten"})
                return
            if length > MAX_AUDIO_BYTES:
                self.send_json(413, {"ok": False, "error": "Audiodatei zu groß"})
                return
            audio_bytes = self.rfile.read(length)
            content_type = self.headers.get("Content-Type", "audio/webm")
            try:
                text = transcribe_audio(audio_bytes, content_type)
                self.send_json(200, {"ok": True, "text": text})
            except Exception as exc:
                logger.exception("Transkription fehlgeschlagen")
                self.send_json(503, {"ok": False, "error": str(exc)})
            return

        if path == "/api/structure":
            transcript = (payload.get("transcript") or "").strip()
            if not transcript:
                self.send_json(400, {"ok": False, "error": "Kein Transkript"})
                return
            try:
                result, mode = structure_transcript(transcript)
                self.send_json(200, {"ok": True, "result": result, "mode": mode})
            except Exception as exc:
                logger.exception("Strukturierung fehlgeschlagen")
                self.send_json(503, {"ok": False, "error": str(exc)})
            return

        if path == "/api/backup":
            if not isinstance(payload.get("patients"), list):
                payload = load_payload()
            if not isinstance(payload.get("patients"), list):
                self.send_json(400, {"ok": False, "error": "No data to back up"})
                return
            target = create_backup(payload, "manuell")
            self.send_json(200, {"ok": True, "fileName": target.name, "path": str(target)})
            return

        self.send_json(404, {"ok": False, "error": "Not found"})

    def serve_static(self, request_path: str) -> None:
        relative = request_path.lstrip("/") or "index.html"
        if relative.endswith("/"):
            relative += "index.html"

        target = (APP_DIR / relative).resolve()
        app_root = APP_DIR.resolve()

        # Path traversal guard
        try:
            target.relative_to(app_root)
        except ValueError:
            self.send_error(403)
            return

        if not target.exists() or not target.is_file():
            self.send_error(404)
            return

        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if content_type.startswith(("text/", "application/javascript")):
            content_type += "; charset=utf-8"

        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def build_server(preferred_port: int) -> ThreadingHTTPServer:
    for port in [preferred_port, 3001, 4873, 4874, 0]:
        try:
            return ThreadingHTTPServer(("127.0.0.1", port), PraxisMemoHandler)
        except OSError:
            continue
    raise RuntimeError("No local port available")


def copy_starter_files_once() -> None:
    ensure_dirs()
    for folder in [DATA_DIR, BACKUP_DIR]:
        marker = folder / "README.txt"
        if not marker.exists():
            marker.write_text(
                "Dieser Ordner wird automatisch von Praxis Memo verwendet.\n"
                "Bitte Dateien nicht manuell bearbeiten, waehrend die App laeuft.\n",
                encoding="utf-8",
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Praxis Memo lokal starten")
    parser.add_argument("port_arg", nargs="?", type=int)
    parser.add_argument("--port", type=int, default=3000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    copy_starter_files_once()
    setup_logging()
    server = build_server(args.port_arg or args.port)
    host, port = server.server_address
    url = f"http://{host}:{port}/"

    print("")
    print("Praxis Memo laeuft lokal.")
    print(f"Adresse: {url}")
    print(f"Daten:   {DATA_FILE}")
    print(f"Backups: {BACKUP_DIR}")
    print("")
    if openai_available():
        print("!" * 60)
        print("DEMO-MODUS: Strukturierung laeuft ueber OpenAI (Cloud, USA)")
        print("KEINE ECHTEN PATIENTENDATEN EINGEBEN!")
        print("Zum Deaktivieren: OPENAI_API_KEY-Variable entfernen.")
        print("!" * 60)
        print("")
    print("Dieses Fenster offen lassen. Zum Beenden: Fenster schliessen oder Strg+C.")
    print("")

    if not args.no_browser:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nPraxis Memo wurde beendet.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
