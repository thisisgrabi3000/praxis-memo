# BitLocker vor Ort aktivieren — Checkliste

**Ziel:** Die Festplatte von Miriams PC verschlüsseln, damit die Patientendaten bei
Diebstahl oder Ausbau der Platte unlesbar sind. Im Alltag merkt niemand etwas —
der Schutz greift nur, wenn jemand physisch an die Daten will.

> ⚠️ **Der Wiederherstellungsschlüssel ist heilig.** Geht er verloren *und* es passiert
> mal etwas (Hardware-Tausch, BIOS-Update, defektes TPM), sind die Daten **für immer weg**.
> Schlüssel immer **außerhalb des PCs** sichern. Siehe Schritt 4.

---

## 0. Vorher (zuhause)
- [ ] `bitlocker-check.bat` auf den USB-Stick kopieren (liegt in `docs/`)

## 1. Status prüfen (vor Ort, ~1 Min)
- [ ] `bitlocker-check.bat` auf ihrem PC doppelklicken → UAC mit **„Ja"** bestätigen
- [ ] Aus der Anzeige notieren:
  - Windows-**Edition**: Pro/Enterprise/Education **oder** Home?
  - **BitLocker C:** „Protection On" (an) oder „Protection Off" (aus)?
  - **TPM** vorhanden? (TpmPresent: True)

## 2. Entscheidung nach Edition
- **Pro / Enterprise / Education** → BitLocker verfügbar → weiter mit **Schritt 3**.
- **Home** → kein klassisches BitLocker. Zwei Optionen:
  - **„Geräteverschlüsselung"**: Einstellungen → Datenschutz & Sicherheit → Geräteverschlüsselung.
    Falls der Schalter da ist: einschalten — das ist ein abgespecktes BitLocker, reicht aus.
    (Den Recovery-Key sichert Windows dann im Microsoft-Konto — Schritt 4 trotzdem beachten.)
  - **Sonst:** kostenloses **VeraCrypt** für einen verschlüsselten Container, in dem nur der
    `data`-Ordner der App liegt. → Sag mir Bescheid, dann baue ich dir dafür eine eigene Anleitung.

## 3. BitLocker einschalten (nur Pro/Enterprise/Education)
- [ ] Start → **„BitLocker verwalten"** öffnen
- [ ] Bei **Laufwerk C:** auf **„BitLocker aktivieren"** klicken
- [ ] **Wiederherstellungsschlüssel sichern**: „In Datei speichern" wählen UND zusätzlich
      ausdrucken/abfotografieren — **nicht** nur auf demselben PC ablegen!
- [ ] **„Gesamtes Laufwerk verschlüsseln"** wählen (gründlicher als „nur belegter Speicher")
- [ ] **„Neuer Verschlüsselungsmodus"** wählen
- [ ] Starten. Die Verschlüsselung läuft im Hintergrund weiter — PC bleibt normal benutzbar.

## 4. Recovery-Key sicher ablegen (KRITISCH)
- [ ] Den 48-stelligen Schlüssel an **mindestens 2 Orten außerhalb des PCs** ablegen, z.B.:
  - dein Passwortmanager **und**
  - ein Ausdruck im Praxis-Safe
- [ ] Kurz notieren, *wo* der Schlüssel liegt (damit du ihn im Notfall findest)

## 5. Gegenkontrolle
- [ ] `bitlocker-check.bat` nochmal laufen lassen
- [ ] Erwartet: **„Protection On"**. (Der Status „Fully Encrypted" kann bei großer Platte
      noch eine Weile auf „Encryption in Progress" stehen — das ist okay, Schutz ist trotzdem aktiv.)

---

**Wenn fertig:** Damit ist die wichtigste DSGVO-Anforderung (Verschlüsselung at-rest, Art. 32)
für den Diebstahl-/Verlust-Fall abgedeckt. Offene Punkte danach: §630f Änderungslog,
Verschlüsselung *innerhalb* der App — siehe `prod-spec.md`.
