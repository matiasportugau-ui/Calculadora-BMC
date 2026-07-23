# Evidence — AI cost $/day query path

**Date:** 2026-07-23  
**Closes (docs):** IMP-06 procedure · G-P1-01  
**Status:** Query path **CONFIRMED** in code; operator rollup procedure documented. Live dollar total for a given day remains **ops-run** (not a hub card yet).

## Event sources (as-built)

| Event | Emitter | Module | Fields (key) |
|-------|---------|--------|--------------|
| `agent_core_call` | `callAgentOnce` | `server/lib/agentCore.js` → `logAgentCost` | `provider`, `model`, `channel`, `latency_ms`, `estimated_cost_usd`, tokens, `source: agentCore` |
| `ai_completion` | shared completions | `server/lib/aiCompletion.js` → `logAgentCost` | `provider`, `model`, `estimated_cost_usd`, tokens, `source: aiCompletion` |
| `agent_tool_call` | tool runtime | `server/lib/agentTools.js` | `tool`, `ok`, `latency_ms` (not USD) |
| `superagent_ai_call` | SuperAgent | `server/routes/superAgent.js` → `logAgentCost` | `provider`, `model`, `estimated_cost_usd`, `call` context, `source: superAgent` |
| `agent_turn` | SSE + agentCore | `server/lib/logAgentTurn.js` | Normalized turn + cost parity fields |
| `chat_turn_cost` | SSE chat | `logAgentTurn` → `logAgentCost` | Same shape as `agent_core_call` |

`logAgentCost` shape: `server/lib/costTelemetry.js` — always includes `event`, `ts`, `estimated_cost_usd`, `source`.

## Cloud Logging — yesterday’s AI $ (v1 SQL-style filter)

Service: Cloud Run **`panelin-calc`**, region **`us-central1`**, project **`chatbot-bmc-live`**.

```bash
# Last 24h structured cost events (stdout JSON lines)
gcloud logging read '
  resource.type="cloud_run_revision"
  AND resource.labels.service_name="panelin-calc"
  AND (
    jsonPayload.event="agent_core_call"
    OR jsonPayload.event="ai_completion"
    OR jsonPayload.event="superagent_ai_call"
    OR textPayload:"\"event\":\"agent_core_call\""
    OR textPayload:"\"event\":\"ai_completion\""
    OR textPayload:"\"event\":\"superagent_ai_call\""
  )
' --project=chatbot-bmc-live --freshness=1d --limit=500 --format=json \
  | node -e '
    const fs=require("fs");
    const rows=JSON.parse(fs.readFileSync(0,"utf8"));
    let sum=0, n=0;
    for (const r of rows) {
      let o = r.jsonPayload;
      if (!o && r.textPayload) {
        try { o = JSON.parse(r.textPayload); } catch { continue; }
      }
      if (!o || o.estimated_cost_usd == null) continue;
      const c = Number(o.estimated_cost_usd);
      if (!Number.isFinite(c)) continue;
      sum += c; n++;
    }
    console.log(JSON.stringify({ events: n, estimated_cost_usd_sum: +sum.toFixed(6) }, null, 2));
  '
```

**Notes:**
- Logs may land as `jsonPayload` (pino) **or** single-line JSON in `textPayload` (raw `console.log` / SuperAgent).
- Estimates only (`estimateCostUSD`); not provider invoices.
- Omni job costs live separately in Postgres `omni_ai_jobs.cost_usd` (see Omni runbooks).

## Hub / analytics (not full $/day)

- `GET /api/ai-analytics/trends` — **knowledge environment** trends from `events-log.jsonl`, **not** live LLM $ (requires `API_AUTH_TOKEN`).
- Tool volume: `GET /api/agent/tool-stats` (dev/auth) + durable `agent_tool_calls` when `DATABASE_URL`.
- Hub UI: **Costo IA** card in Agent Admin → Estadísticas (copy gcloud filter; no live $ total).

## Acceptance (operator)

Operator can answer “approximate yesterday’s AI $ from agent events?” with the gcloud + node snippet above (or Ops §10 in `PANELIN-IA-OPS.md`).
