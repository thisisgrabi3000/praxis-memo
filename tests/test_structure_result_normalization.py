import importlib.util
import json
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location("pms", "praxis_memo_server.py")
pms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pms)


def run():
    fails = []

    def ck(name, cond):
        print(("  OK " if cond else "  FAIL ") + name)
        if not cond:
            fails.append(name)

    parsed = pms._normalize_structure_result({
        "core": "Patient berichtet von Belastung.",
        "agreement": ["Wochenliste testen", "Termin notieren"],
        "open": ["Erinnerungshilfe klaeren", "Alltagstauglichkeit pruefen"],
        "watch": ["Ueberforderung beobachten"],
        "resolved": ["Offenen Punkt besprochen", {"text": "Objekt bleibt Text"}],
    })

    ck("agreement list becomes text", parsed["agreement"] == "Wochenliste testen\nTermin notieren")
    ck("open list becomes text", parsed["open"] == "Erinnerungshilfe klaeren\nAlltagstauglichkeit pruefen")
    ck("watch list becomes text", parsed["watch"] == "Ueberforderung beobachten")
    ck("resolved remains list", isinstance(parsed["resolved"], list) and len(parsed["resolved"]) == 2)
    ck("required keys are strings", all(isinstance(parsed[key], str) for key in pms.STRUCTURE_TEXT_KEYS))

    preserved = pms._preserve_source_terms(
        {
            "core": "Patient berichtet ueber ADHD und szenatherapeutische Arbeit.",
            "agreement": "",
            "open": "",
            "watch": "ADHD weiter beobachten; szenatherapeutischen Anteil notieren.",
            "resolved": ["ADHD Punkt"]
        },
        "Patient berichtet ADHS und schematherapeutische Arbeit.",
    )
    ck("ADHS preserved from transcript", "ADHD" not in preserved["core"] and "ADHS" in preserved["core"])
    ck("schematherapeutisch preserved from transcript", "schematherapeutische" in preserved["core"])

    try:
        pms._validate_care_recommendations(
            {"core": "", "agreement": "", "open": "", "watch": "Überprüfung mit einem Facharzt"},
            "Patient berichtet Belastung ohne weitere Versorgungsschritte.",
        )
        ck("unsupported care recommendation blocked", False)
    except RuntimeError:
        ck("unsupported care recommendation blocked", True)

    try:
        pms._validate_care_recommendations(
            {"core": "", "agreement": "", "open": "", "watch": "Facharzttermin wurde vom Patienten berichtet"},
            "Patient berichtet, dass ein Facharzttermin bereits vereinbart ist.",
        )
        ck("sourced care term allowed", True)
    except RuntimeError:
        ck("sourced care term allowed", False)

    corrupt = Path(tempfile.mkdtemp()) / "broken.json"
    corrupt.write_text("{not valid json", encoding="utf-8")
    ck("corrupt json fallback still works for non-strict reads", pms.read_json(corrupt, {"fallback": True}) == {"fallback": True})
    try:
        pms.read_json(corrupt, {}, strict=True)
        ck("corrupt data file raises in strict mode", False)
    except json.JSONDecodeError:
        ck("corrupt data file raises in strict mode", True)

    print("RESULT:", "ALL OK" if not fails else f"{len(fails)} FAIL")
    raise SystemExit(1 if fails else 0)


if __name__ == "__main__":
    run()
