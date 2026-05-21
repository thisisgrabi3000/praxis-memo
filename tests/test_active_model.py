import importlib.util, tempfile, os
from pathlib import Path

spec = importlib.util.spec_from_file_location("pms", "praxis_memo_server.py")
pms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pms)

def with_model_file(content):
    tmp = Path(tempfile.mkdtemp()) / "ki-modell.txt"
    if content is not None:
        tmp.write_text(content, encoding="utf-8")
    pms.MODEL_FILE = tmp
    return tmp

def run():
    fails = []
    def ck(name, cond):
        print(("  OK " if cond else "  FAIL ") + name)
        if not cond: fails.append(name)

    with_model_file(None)            # Datei fehlt
    ck("fehlt -> 3b", pms.active_model() == "qwen2.5:3b")
    with_model_file("")              # leer
    ck("leer -> 3b", pms.active_model() == "qwen2.5:3b")
    with_model_file("qwen2.5:7b")
    ck("7b -> 7b", pms.active_model() == "qwen2.5:7b")
    with_model_file("  qwen2.5:7b\n")
    ck("whitespace -> 7b", pms.active_model() == "qwen2.5:7b")
    with_model_file("qwen2.5:3b")
    ck("3b -> 3b", pms.active_model() == "qwen2.5:3b")
    with_model_file("gpt-4")         # nicht in Allowlist
    ck("ungueltig -> 3b", pms.active_model() == "qwen2.5:3b")

    print("RESULT:", "ALL OK" if not fails else f"{len(fails)} FAIL")
    raise SystemExit(1 if fails else 0)

if __name__ == "__main__":
    run()
