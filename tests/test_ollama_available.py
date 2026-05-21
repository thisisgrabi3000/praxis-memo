import importlib.util
import json

spec = importlib.util.spec_from_file_location("pms", "praxis_memo_server.py")
pms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pms)


class FakeResponse:
    def __init__(self, status=200, payload=None):
        self.status = status
        self.payload = payload if payload is not None else {"models": []}

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def run():
    fails = []
    original_urlopen = pms.urllib.request.urlopen

    def ck(name, cond):
        print(("  OK " if cond else "  FAIL ") + name)
        if not cond:
            fails.append(name)

    try:
        pms.urllib.request.urlopen = lambda *args, **kwargs: FakeResponse(
            payload={"models": [{"name": "qwen2.5:3b"}, {"model": "qwen2.5:7b"}]}
        )
        ck("service available without model check", pms.ollama_available() is True)
        ck("installed 3b available", pms.ollama_available("qwen2.5:3b") is True)
        ck("installed 7b available via model field", pms.ollama_available("qwen2.5:7b") is True)
        ck("missing model unavailable", pms.ollama_available("qwen2.5:14b") is False)

        pms.urllib.request.urlopen = lambda *args, **kwargs: FakeResponse(status=503)
        ck("non-200 unavailable", pms.ollama_available("qwen2.5:3b") is False)

        def raise_error(*args, **kwargs):
            raise OSError("offline")

        pms.urllib.request.urlopen = raise_error
        ck("urlopen error unavailable", pms.ollama_available("qwen2.5:3b") is False)
    finally:
        pms.urllib.request.urlopen = original_urlopen

    print("RESULT:", "ALL OK" if not fails else f"{len(fails)} FAIL")
    raise SystemExit(1 if fails else 0)


if __name__ == "__main__":
    run()
