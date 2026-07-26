import assert from "node:assert/strict";
import { computePromptsSha, getPromptsShaCached } from "../server/lib/promptsSha.js";

const a = computePromptsSha();
assert.ok(a.prompts_sha && a.prompts_sha.length === 16);
assert.ok(a.files.includes("chatPrompts.js"));
const b = getPromptsShaCached();
assert.equal(b.prompts_sha, a.prompts_sha);

console.log("promptsSha.test.js: ok");
