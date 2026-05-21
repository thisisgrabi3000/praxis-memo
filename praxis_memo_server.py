from __future__ import annotations

import argparse
import json
import logging
import mimetypes
import os
import re
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

# Only these front-end files are served statically. Patient data, logs, backups
# and VCS metadata under the app root must never be reachable via the browser.
STATIC_ALLOWLIST = {"index.html", "app.js", "styles.css"}

WHISPER_MODEL_NAME = "base"
OLLAMA_BASE = "http://127.0.0.1:11434"
DEFAULT_OLLAMA_MODEL = "qwen2.5:3b"
ALLOWED_MODELS = {"qwen2.5:3b", "qwen2.5:7b"}
OLLAMA_TIMEOUT_SECONDS = 240
OLLAMA_NUM_CTX = 12288   # ~5000 Wörter Eingabe sicher verarbeitbar
MAX_TRANSCRIPT_WORDS = 5000  # darüber: Server lehnt ab (Inhalt würde verloren gehen)


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

def ollama_available(model: str | None = None) -> bool:
    try:
        with urllib.request.urlopen(f"{OLLAMA_BASE}/api/tags", timeout=2) as resp:
            if resp.status != 200:
                return False
            if not model:
                return True
            payload = json.loads(resp.read().decode("utf-8"))
            installed = {
                str(item.get("name") or item.get("model") or "").strip()
                for item in payload.get("models", [])
                if isinstance(item, dict)
            }
            return model in installed
    except Exception:
        return False


MODEL_FILE = DATA_DIR / "ki-modell.txt"


def active_model() -> str:
    """Liest das aktive Strukturierungsmodell aus data/ki-modell.txt.
    Fallback auf DEFAULT_OLLAMA_MODEL bei fehlender/leerer/ungültiger Datei."""
    try:
        name = MODEL_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return DEFAULT_OLLAMA_MODEL
    return name if name in ALLOWED_MODELS else DEFAULT_OLLAMA_MODEL


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


def _structure_messages(transcript: str, patient_id: str = "") -> list:
    patient_context = (
        f"Aktueller Patient: {patient_id}. Erwähne ausschließlich dieses Patienten-Kürzel, "
        "falls überhaupt ein Kürzel nötig ist. Andere Patienten-Kürzel dürfen in der Antwort "
        "nicht erscheinen, auch nicht als Negation oder offene Frage.\n"
        if patient_id else ""
    )
    user_prompt = (
        "Du bist ein Dokumentationssystem für eine psychiatrische oder psychotherapeutische Praxis. "
        "Analysiere die folgende Sitzungs-Nachnotiz einer behandelnden Person und verteile den Inhalt "
        "präzise auf vier Felder.\n\n"
        f"{patient_context}"
        f"Nachnotiz:\n{transcript}\n\n"
        "WICHTIG: Antworte AUSSCHLIESSLICH auf Deutsch. Verwende KEINE chinesischen, "
        "japanischen, koreanischen oder andere fremdsprachigen Schriftzeichen — nur deutsche "
        "Buchstaben, Umlaute und Standard-Satzzeichen.\n"
        "WICHTIG: Erfinde oder verändere KEINE Patienten-Kürzel oder -Nummern (z.B. P-001). "
        "Übernimm ein Kürzel nur, wenn es wörtlich in der Nachnotiz steht; ansonsten erwähne "
        "gar keines. Wenn eine fremde Patienten-ID nur zur Abgrenzung oder Negation genannt wird "
        "(z.B. 'kein Bezug zu P-007'), ignoriere diese fremde ID vollständig und nimm sie nicht "
        "in offene Fragen oder Beobachtungen auf.\n"
        "WICHTIG: Stelle KEINE Diagnosen und triff KEINE Therapieentscheidungen. Halte klar "
        "auseinander, was der Patient berichtet, was als offene Frage/Hypothese formuliert ist, "
        "was vereinbart wurde und welche Risiken/Schutzfaktoren beobachtet werden sollen. "
        "Unsicherheit muss als Unsicherheit erhalten bleiben.\n\n"
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
            "Du bist ein präzises medizinisches Dokumentationssystem für eine deutschsprachige psychiatrische oder psychotherapeutische Praxis. "
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


def _validate_patient_ids(parsed: dict, patient_id: str) -> None:
    if not patient_id:
        return
    output_text = " ".join(str(parsed.get(key, "")) for key in ("core", "agreement", "open", "watch"))
    output_ids = set(re.findall(r"\bP-[A-Za-z0-9-]+\b", output_text))
    foreign_ids = sorted(pid for pid in output_ids if pid != patient_id)
    if foreign_ids:
        raise RuntimeError(
            "KI-Antwort enthält fremde Patientenkürzel: "
            + ", ".join(foreign_ids)
            + ". Strukturierung wurde aus Sicherheitsgründen nicht gespeichert."
        )


def structure_via_ollama(transcript: str, patient_id: str = "") -> dict:
    _check_word_limit(transcript)

    body = json.dumps({
        "model": active_model(),
        "messages": _structure_messages(transcript, patient_id),
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
    parsed = _extract_json(content)
    _validate_patient_ids(parsed, patient_id)
    return parsed


def structure_transcript(transcript: str, patient_id: str = "") -> tuple[dict, str]:
    """Returns (result_dict, mode); mode is always 'local' (Ollama, on-device)."""
    return structure_via_ollama(transcript, patient_id), "local"


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

    # Retention: delete backups in day folders older than KEEP_DAILY_DAYS, then
    # remove the now-empty folder. Deleting the files first is essential — rmdir
    # alone never removes a non-empty folder, so old backups would linger forever.
    for day_dir in BACKUP_DIR.iterdir():
        if not day_dir.is_dir():
            continue
        try:
            folder_date = datetime.strptime(day_dir.name, "%Y-%m-%d").date()
        except ValueError:
            continue
        if (today - folder_date).days > KEEP_DAILY_DAYS:
            for old_file in day_dir.glob("*.json"):
                try:
                    old_file.unlink()
                except OSError:
                    pass
            try:
                day_dir.rmdir()  # only removes if now empty
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


# ---------- Request trust (DNS-rebinding + CSRF guard) ----------
# The server binds 127.0.0.1, but binding alone does not stop a malicious web
# page in the same browser from reaching it via DNS rebinding (the page rebinds
# its own domain to 127.0.0.1, defeating the browser's same-origin/CORS checks).
# Defense: only honour requests whose Host header names the loopback interface
# literally, and reject any cross-origin POST. A rebound request still carries
# the attacker's domain in Host/Origin, so these checks block it.
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _host_is_loopback(host_header: str) -> bool:
    """True if a Host header (host[:port]) names the loopback interface."""
    if not host_header:
        return False
    try:
        hostname = urllib.parse.urlsplit(f"//{host_header.strip()}").hostname
    except ValueError:
        return False
    return hostname in LOOPBACK_HOSTS


def _origin_is_loopback(origin: str) -> bool:
    """True if an Origin/Referer URL points at the loopback interface."""
    try:
        hostname = urllib.parse.urlsplit(origin).hostname
    except ValueError:
        return False
    return hostname in LOOPBACK_HOSTS


class PraxisMemoHandler(BaseHTTPRequestHandler):
    server_version = "PraxisMemoLocal/2.0"

    def log_message(self, format, *args):  # noqa: A002
        return

    def _is_trusted(self) -> bool:
        # DNS-rebinding guard: Host must be a loopback literal, never a domain.
        if not _host_is_loopback(self.headers.get("Host", "")):
            return False
        # CSRF guard: a cross-origin browser request carries a foreign Origin.
        origin = self.headers.get("Origin")
        if origin and not _origin_is_loopback(origin):
            return False
        # Belt-and-suspenders: modern browsers tag cross-site requests.
        site = self.headers.get("Sec-Fetch-Site")
        if site and site not in ("same-origin", "none"):
            return False
        return True

    def send_json(self, status: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if not self._is_trusted():
            self.send_error(403, "Forbidden")
            return

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
            model = active_model()
            self.send_json(200, {"available": ollama_available(model), "mode": "local", "model": model})
            return

        self.serve_static(path)

    def do_POST(self) -> None:
        if not self._is_trusted():
            self.send_error(403, "Forbidden")
            return

        path = urllib.parse.urlparse(self.path).path

        # Audio endpoint: the body is raw audio bytes, not JSON. It MUST be handled
        # before payload_from_request() runs — that helper reads and JSON-parses the
        # whole body, which would reject audio with 400 and consume the bytes.
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

        # JSON endpoints from here on.
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

        if path == "/api/structure":
            transcript = (payload.get("transcript") or "").strip()
            patient_id = (payload.get("patientId") or "").strip()
            if not transcript:
                self.send_json(400, {"ok": False, "error": "Kein Transkript"})
                return
            try:
                result, mode = structure_transcript(transcript, patient_id)
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

        # Strict allowlist: serve only the app's own front-end files. Everything
        # else (data/*.json, server.log, .git/config, backups, …) stays private,
        # even though it lives under the app root. This is the primary defense;
        # the path-traversal check below is a second line.
        if relative not in STATIC_ALLOWLIST:
            self.send_error(403)
            return

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
