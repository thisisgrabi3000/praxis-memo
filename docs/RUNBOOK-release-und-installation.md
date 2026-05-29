# Runbook: Release & Installation (für Entwickler / nächstes Mal)

Stand: 2026-05-29 · Repo `thisisgrabi3000/praxis-memo` · Branch `main`

Dieses Dokument ist das **wiederverwendbare Runbook** für: neue Version
veröffentlichen + auf Miriams Praxis-PC bringen. Verifizierte Befehle, inkl.
der Fallen, in die man sonst tritt. (Versions-Changelogs stehen separat in
`docs/release-notes-vX.Y.Z.md`.)

---

## 1. Die zwei Kanäle (wichtig zu verstehen)

| Kanal | Wofür | Quelle | Mechanik |
|---|---|---|---|
| **GitHub-Release** | laufende Updates am PC | `releases/latest/download/praxis-memo-app.zip` | `Praxis Memo Update.bat` lädt + `Expand-Archive -Force` |
| **USB-Paket** | Frischinstallation / neuer PC | lokal gebautes `dist/PraxisMemo-<datum>.zip` | manuell nach `C:\PraxisMemo` entpacken |

Der PC bezieht App-Updates **per Doppelklick auf `Praxis Memo Update.bat`**.
Das funktioniert nur korrekt, wenn das **GitHub-`latest`-Release die aktuelle
Version trägt** — sonst Downgrade (siehe Fallen).

---

## 2. Release veröffentlichen (Standard-Flow)

Voraussetzung: Code auf `main` fertig, Tests grün.

```bash
# 1. VERSION bumpen (Datei ist im ZIP, wird von Update.bat gelesen)
#    -> Datei `VERSION` auf neue Nummer setzen, z.B. 1.0.9
#    Cache-Buster in index.html (?v=X.Y.Z-...) sollten zur Version passen.

# 2. Verifikation
node tests/test_befund_engine.js          # muss grün sein
python3 -m py_compile praxis_memo_server.py
node --check app.js

# 3. Commit + Tag auf main
git add app.js befund.js index.html praxis_memo_server.py styles.css \
        tests/test_befund_engine.js VERSION docs/release-notes-vX.Y.Z.md
git commit -m "feat: vX.Y.Z — <kurzbeschreibung>"
git tag -a vX.Y.Z -m "vX.Y.Z — <kurzbeschreibung>"

# 4. Release-Asset bauen: EXAKT 'praxis-memo-app.zip', kanonische 13-Datei-Liste,
#    OHNE 'Praxis Memo Update.bat' (Begründung: Falle 2)
mkdir -p dist && rm -f dist/praxis-memo-app.zip
zip -X dist/praxis-memo-app.zip \
  index.html styles.css app.js befund.js praxis_memo_server.py \
  "Start Praxis Memo.bat" "KI einrichten.bat" "Datenordner oeffnen.bat" \
  "PC KI Leistung pruefen.bat" "Besseres Modell installieren.bat" \
  "Schnelles Modell (3b) zurueck.bat" README_PC_INSTALLATION.txt VERSION

# 5. Push + Release
git push origin main
git push origin vX.Y.Z
gh release create vX.Y.Z dist/praxis-memo-app.zip \
  --repo thisisgrabi3000/praxis-memo \
  --title "vX.Y.Z — <titel>" \
  --notes-file docs/release-notes-vX.Y.Z.md
```

### Pflicht-Verifikation nach dem Release
Genau das prüfen, was `Update.bat` tut:

```bash
curl -L --fail --silent --show-error -o /tmp/check.zip \
  "https://github.com/thisisgrabi3000/praxis-memo/releases/latest/download/praxis-memo-app.zip"
unzip -p /tmp/check.zip VERSION   # MUSS die neue Version zeigen
```

Wenn hier die **alte** Version steht, zieht der PC beim nächsten Doppelklick ein
Downgrade. Erst weitermachen, wenn `latest` die neue Version liefert.

> **Freigabe-Gate:** Push + Release gehen nur auf ausdrückliche Ansage des Users
> (Live-Praxis-PC). Lokales Bauen/Committen ist erlaubt; veröffentlichen nicht
> ohne Wort. Siehe Memory `feedback-deploy-authorization`.

---

## 3. USB-Paket für Frischinstallation bauen

Nötig bei: neuer/leerer PC, oder PC steht auf sehr alter Version ohne Updater.
Enthält **zusätzlich** `Praxis Memo Update.bat` (damit der PC danach selbst
updaten kann) + die Anleitungs-Docs.

```bash
mkdir -p dist && rm -f "dist/PraxisMemo-$(date +%F).zip"
zip -X "dist/PraxisMemo-$(date +%F).zip" \
  index.html styles.css app.js befund.js praxis_memo_server.py \
  "Start Praxis Memo.bat" "KI einrichten.bat" "Praxis Memo Update.bat" \
  "Datenordner oeffnen.bat" "PC KI Leistung pruefen.bat" \
  "Besseres Modell installieren.bat" "Schnelles Modell (3b) zurueck.bat" \
  README_PC_INSTALLATION.txt VERSION \
  docs/anleitung-miriam.pdf docs/ablaufplan-miriam.md
unzip -p "dist/PraxisMemo-$(date +%F).zip" VERSION   # Kontrolle
```

`dist/` und `*.zip` sind in `.gitignore` — Pakete landen nicht im Repo.

---

## 4. Installation am PC (Miriam)

Voraussetzung einmalig: Python (Microsoft Store), Ollama, faster-whisper.
Modell: **`qwen2.5:3b`** — der PC hat nur **8 GB RAM**, kein 7b/größer.

### Weg A — sauberer Frischinstall (empfohlen bei „alles erneut")
1. USB-`PraxisMemo-<datum>.zip` nach `C:\PraxisMemo` entpacken (alten Ordner
   vorher sichern, v. a. `data/` und `backups/`).
2. `KI einrichten.bat` einmal ausführen (Python/Ollama/Whisper + Modell-Pull).
3. `Start Praxis Memo.bat` → App auf `http://127.0.0.1:3000/`.
4. Ab dann Updates: **`Praxis Memo Update.bat` doppelklicken**.

### Weg B — schnell (PC hat schon Python + Ollama)
- `Praxis Memo Update.bat` in den App-Ordner legen und doppelklicken → sichert
  Daten, lädt `latest`, updatet Whisper, pullt Modell, legt Desktop-Icon an.

`Update.bat` sichert vor jedem Update automatisch:
`data\praxismemo-data.json` → `backups\vor-update\` und die alten Code-Dateien.

---

## 5. Fallen (Lessons Learned — hier konzentriert)

1. **Downgrade-Falle:** `Update.bat` zieht immer `releases/latest`. Wenn das
   neueste Release eine ältere Version ist als auf dem PC, überschreibt ein
   Doppelklick die neuere Version mit der älteren. → Vor „per Doppelklick"
   IMMER zuerst das Release veröffentlichen und `latest` per `curl` verifizieren.

2. **Update.bat NICHT ins Release-Asset:** `Update.bat` entpackt das ZIP per
   `Expand-Archive -Force` in den App-Ordner. Läge `Praxis Memo Update.bat`
   selbst im ZIP, würde es sich **während der Ausführung selbst überschreiben**
   (Windows liest .bat zeilenweise von Platte → Korruptionsrisiko). Deshalb:
   Updater nur ins USB-Paket, nie ins `praxis-memo-app.zip`.

3. **Asset-Name exakt `praxis-memo-app.zip`:** `Update.bat` zieht genau diesen
   Dateinamen von `latest/download`. Anderer Name = Download schlägt fehl.

4. **`VERSION` ist im Repo getrackt, aber wird pro Release gebumpt** und MUSS im
   ZIP liegen (Update.bat liest sie und zeigt „aktualisiert auf X.Y.Z").

5. **Jede neue Deploy-Datei** muss in `Paket erstellen.bat` UND in beide ZIP-Build-
   Befehle (oben). Sonst kommt sie nicht auf den PC.

6. **8 GB RAM → `qwen2.5:3b`.** Kein größeres Modell als Default setzen.

7. **`data/` + `backups/` nie ins ZIP** und nie committen (`.gitignore`).
   Patientendaten/Backups bleiben ausschließlich lokal auf dem PC.

8. **Medizinische Inhalte append-only / nichts fabrizieren** — gilt für Code
   (geprüfte Stände nicht überschreiben), nicht fürs Deploy, aber im Hinterkopf.

---

## 6. Schnell-Checkliste Release

- [ ] `VERSION` gebumpt + Cache-Buster passend
- [ ] Tests grün (`node tests/test_befund_engine.js`, `py_compile`, `node --check`)
- [ ] `docs/release-notes-vX.Y.Z.md` geschrieben
- [ ] Commit + Tag `vX.Y.Z` auf `main`
- [ ] `dist/praxis-memo-app.zip` gebaut (13 Dateien, ohne Update.bat)
- [ ] **User-Freigabe für Push/Release eingeholt**
- [ ] `git push origin main` + `git push origin vX.Y.Z`
- [ ] `gh release create vX.Y.Z dist/praxis-memo-app.zip ...`
- [ ] `curl latest/download/praxis-memo-app.zip` → `unzip -p ... VERSION` = neue Version
- [ ] (bei Frischinstall) USB-Paket `dist/PraxisMemo-<datum>.zip` gebaut + auf Stick
