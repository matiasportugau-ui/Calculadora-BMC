// Gap 4 sequence worker — offline tests with mocked pg pool.
// node tests/omniSequenceWorker.test.js
import { findNoReplyCandidates, runSequenceTick } from "../server/lib/omni/orchestrator/sequenceWorker.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

function makePool(handler) {
  const calls = [];
  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return handler(sql, params, calls);
    },
  };
}

const rule = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "No reply 24h",
  trigger_event: "conversation.no_reply",
  conditions: { hours_since_last_customer_reply: 24, only_open_conversations: true },
  actions: [{ type: "ai_draft_followup" }],
  requires_approval: false,
};
const candidate = (conversation_id, requires_template = false) => ({
  conversation_id,
  channel: "wa",
  conversation_status: "open",
  message_id: "m-last-agent",
  last_customer_at: "2026-07-07T08:00:00.000Z",
  last_agent_at: "2026-07-07T09:00:00.000Z",
  hours_since_last_customer_reply: 25,
  requires_template,
});

await (async () => {
  const pool = makePool(() => ({ rows: [] }));
  await findNoReplyCandidates(pool, rule);
  const q = pool.calls[0];
  assert("no_reply query requires last outbound message", /lm\.last_sender IN \('agent', 'bot'\)/.test(q.sql));
  assert("no_reply enqueues the last customer message as AI prompt input", /lc\.message_id/.test(q.sql) && /m\.id AS message_id/.test(q.sql));
  assert("no_reply query keeps open-conversation filter by default", /c\.status = 'open'/.test(q.sql));
  assert("no_reply query suppresses pending suggestions for same rule", /omni_suggestions/.test(q.sql) && /automation_rule_id/.test(q.sql));
  assert("no_reply query suppresses pending AI jobs for same rule", /omni_ai_jobs/.test(q.sql) && /status IN \('pending', 'running'\)/.test(q.sql));
  assert("no_reply query uses configured hours", q.params[0] === 24 && q.params[1] === rule.id);
})();

await (async () => {
  let runInsertCount = 0;
  const aiJobInputs = [];
  const idempotencyKeys = [];
  const pool = makePool((sql, params) => {
    if (/FROM omni_automation_rules/.test(sql)) return { rows: [rule] };
    if (/WITH last_messages/.test(sql)) return { rows: [candidate("c-wa-1", true)] };
    if (/INSERT INTO omni_automation_runs/.test(sql)) {
      idempotencyKeys.push(params[1]);
      runInsertCount += 1;
      return runInsertCount === 1 ? { rows: [{ id: "run-1" }] } : { rows: [] };
    }
    if (/INSERT INTO omni_ai_jobs/.test(sql)) {
      aiJobInputs.push(JSON.parse(params[4]));
      return { rows: [{ id: "job-1" }] };
    }
    if (/UPDATE omni_automation_runs/.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  await runSequenceTick(pool);
  await runSequenceTick(pool);

  assert("sequence idempotency key uses seq:<rule>:<conversation>:<bucket>", idempotencyKeys[0]?.startsWith(`seq:${rule.id}:c-wa-1:`));
  assert("idempotent re-evaluation does not enqueue duplicate AI jobs", aiJobInputs.length === 1);
  assert("ai_draft_followup enqueues HITL suggest job with requires_approval=true", aiJobInputs[0]?.requires_approval === true);
  assert("WA >24h window marks requires_template metadata flag", aiJobInputs[0]?.requires_template === true);
  assert("AI job metadata carries automation rule id", aiJobInputs[0]?.automation_rule_id === rule.id);
})();

await (async () => {
  const mixedRule = { ...rule, actions: [{ type: "ai_draft_followup" }, { type: "create_deal" }] };
  const pool = makePool((sql) => {
    if (/FROM omni_automation_rules/.test(sql)) return { rows: [mixedRule] };
    return { rows: [{ should_not_be_read: true }] };
  });
  const warnings = [];
  await runSequenceTick(pool, { warn: (meta) => warnings.push(meta) });
  assert("sequence worker rejects mixed side-effect actions in HITL v1", pool.calls.length === 1 && warnings[0]?.rule_id === mixedRule.id);
})();

await (async () => {
  const dslRule = { ...rule, conditions: { ...rule.conditions, all: [{ field: "channel", op: "eq", value: "email" }] } };
  const pool = makePool((sql, params) => {
    if (/FROM omni_automation_rules/.test(sql)) return { rows: [dslRule] };
    if (/WITH last_messages/.test(sql)) return { rows: [candidate("c-wa-2")] };
    if (/FROM omni_automation_rules/.test(sql) && params[1] === dslRule.id) return { rows: [dslRule] };
    if (/INSERT INTO omni_ai_jobs/.test(sql)) return { rows: [{ id: "unexpected" }] };
    return { rows: [] };
  });
  await runSequenceTick(pool);
  assert("sequence worker still honors DSL conditions when present", !pool.calls.some((c) => /INSERT INTO omni_ai_jobs/.test(c.sql)));
})();

await (async () => {
  let ruleSelects = 0;
  const pool = makePool((sql) => {
    if (/FROM omni_automation_rules/.test(sql)) {
      ruleSelects += 1;
      return { rows: [ruleSelects === 1 ? rule : { ...rule, actions: [{ type: "ai_draft_followup" }, { type: "create_deal" }] }] };
    }
    if (/WITH last_messages/.test(sql)) return { rows: [candidate("c-wa-3")] };
    if (/INSERT INTO omni_automation_runs/.test(sql) || /INSERT INTO omni_ai_jobs/.test(sql)) {
      return { rows: [{ id: "unexpected" }] };
    }
    return { rows: [] };
  });
  await runSequenceTick(pool);
  assert("automation engine re-fetch is still constrained to draft-only actions", !pool.calls.some((c) => /INSERT INTO omni_ai_jobs|INSERT INTO omni_automation_runs/.test(c.sql)));
})();

console.log(`\nomniSequenceWorker: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
