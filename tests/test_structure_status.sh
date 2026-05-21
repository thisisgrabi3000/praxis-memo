#!/usr/bin/env bash
set -euo pipefail
TDIR=$(mktemp -d /tmp/pms-status-test.XXXXXX)
cp praxis_memo_server.py app.js index.html styles.css "$TDIR"/
PORT=3066
( cd "$TDIR" && python3 praxis_memo_server.py --port $PORT --no-browser >/dev/null 2>&1 & echo $! > "$TDIR/pid" )
sleep 1
B="http://127.0.0.1:$PORT"
for i in $(seq 1 20); do curl -s -o /dev/null "$B/api/structure-status" && break; sleep 0.3; done

echo "Default (keine Datei):"; DEF=$(curl -s "$B/api/structure-status"); echo "  $DEF"
echo "$DEF" | grep -q '"model": "qwen2.5:3b"' && echo "  OK default 3b" || { echo "  FAIL default"; kill "$(cat "$TDIR/pid")"; exit 1; }

mkdir -p "$TDIR/data"; printf 'qwen2.5:7b' > "$TDIR/data/ki-modell.txt"
echo "Nach 7b-Aktivierung:"; SET=$(curl -s "$B/api/structure-status"); echo "  $SET"
echo "$SET" | grep -q '"model": "qwen2.5:7b"' && echo "  OK 7b" || { echo "  FAIL 7b"; kill "$(cat "$TDIR/pid")"; exit 1; }

kill "$(cat "$TDIR/pid")" 2>/dev/null || true
rm -rf "$TDIR"
echo "RESULT: ALL OK"
