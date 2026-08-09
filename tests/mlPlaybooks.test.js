import assert from "node:assert/strict";
import { buildMlPlaybooks } from "../server/lib/mlPlaybooks.js";

const result = buildMlPlaybooks();
assert.ok(Array.isArray(result.items));
assert.ok(result.items.length >= 2, "expected playbooks from ml_pulse + price gaps");
assert.ok(result.summary);
assert.equal(typeof result.generated_at, "string");
assert.ok(result.items.every((i) => i.id && i.action && i.priority));

console.log("mlPlaybooks tests passed");
