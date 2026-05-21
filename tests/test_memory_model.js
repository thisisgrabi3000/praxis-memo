const assert = require("assert");
const { loadApp } = require("./helpers/load-app");
const app = loadApp();

const old = app.normalizeMemoryItem({ text: "Schlaf klären", status: "offen" });
assert.strictEqual(old.resolvedAt, "", "resolvedAt default leer");
assert.strictEqual(old.resolvedSessionId, "", "resolvedSessionId default leer");
assert.strictEqual(old.origin, "ki", "origin default ki");

const manual = app.normalizeMemoryItem({ text: "X", origin: "manuell", resolvedAt: "2026-05-21T10:00:00Z", resolvedSessionId: "s-9" });
assert.strictEqual(manual.origin, "manuell");
assert.strictEqual(manual.resolvedAt, "2026-05-21T10:00:00Z");
assert.strictEqual(manual.resolvedSessionId, "s-9");

console.log("RESULT: ALL OK");
