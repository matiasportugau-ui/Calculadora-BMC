/**
 * IMP-09 — voice error durable insert (offline, mock pg).
 */
import assert from "node:assert/strict";
import {
  recordVoiceError,
  listVoiceErrors,
  clearVoiceErrors,
  _setVoiceErrorPoolForTests,
} from "../server/lib/voiceErrorLog.js";

const mock = {
  queries: [],
  rows: [],
  async query(sql, params) {
    mock.queries.push({ sql, params });
    if (/INSERT INTO public\.agent_voice_events/i.test(sql)) {
      mock.rows.push({
        kind: params[1],
        message: params[2],
        status: params[3],
        detail: params[4],
      });
    }
    return { rows: [] };
  },
};

_setVoiceErrorPoolForTests(mock);
clearVoiceErrors();

process.env.DATABASE_URL = "postgres://mock/mock";

const entry = recordVoiceError({
  kind: "session_mint_fail",
  message: "401 unauthorized",
  status: 401,
  detail: "hands-free start",
});
assert.equal(entry.kind, "session_mint_fail");
assert.equal(listVoiceErrors().length, 1);

await new Promise((r) => setTimeout(r, 50));
assert.ok(mock.queries.some((q) => /agent_voice_events/i.test(q.sql)), "persist insert fired");
assert.equal(mock.rows.length, 1);
assert.equal(mock.rows[0].kind, "session_mint_fail");

_setVoiceErrorPoolForTests(null);
delete process.env.DATABASE_URL;

console.log("voiceErrorPersist.test.js: ok");
