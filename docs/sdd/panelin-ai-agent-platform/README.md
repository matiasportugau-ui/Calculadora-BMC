# SDD — Panelin AI Agent Platform

**Slug:** `panelin-ai-agent-platform`  
**Status:** As-Built **v1.2** (2026-07-23) — post IMP-07/11/12  
**Purpose:** Recreation-grade SPEC of the **real** AI agent stack for SDD-driven development.  
**Audit:** composite **97 PASS** — [`audit/SCORECARD.json`](audit/SCORECARD.json)

## Start here

| Doc | Use |
|-----|-----|
| [`SDD.md`](SDD.md) | As-built architecture §1–12 (SoT) |
| [`SDD-TARGET.md`](SDD-TARGET.md) | North-star / ideal state |
| [`evidence/actual-vs-goal.md`](evidence/actual-vs-goal.md) | Actual vs objective matrix |
| [`IMPLEMENTATION-GUIDE.md`](IMPLEMENTATION-GUIDE.md) | Step-by-step IMP-XX TODOs |
| [`RECREATION-CHECKLIST.md`](RECREATION-CHECKLIST.md) | Can a new team rebuild? |
| [`evidence/tools-manifest.md`](evidence/tools-manifest.md) | **55** tools (local HEAD) |
| [`audit/GAP-PLAN.md`](audit/GAP-PLAN.md) | Gaps & severity |

## Related

- Child slice (chat/voice UI): [`../panelin-chat-agent/`](../panelin-chat-agent/) — defer tool counts to this platform SDD.
- Parent monolith SDD: [`../calculadora-bmc/SDD.md`](../calculadora-bmc/SDD.md)
- Calc contract: [`../../team/panelsim/AE-AGENT-CALC-CONTRACT.md`](../../team/panelsim/AE-AGENT-CALC-CONTRACT.md)
- Ops: [`../../team/runbooks/PANELIN-IA-OPS.md`](../../team/runbooks/PANELIN-IA-OPS.md)

## Quick facts (CONFIRMED 2026-07-23)

- Local tools: **55** · Prod tools: **55**
- Goldens: **22** (IMP-11)
- Provider order: claude → grok → gemini → openai → openrouter
- Chat rate limit: **10**/min public · **30**/min dev · exec-tool **60**/min
- RAG: code ready, **default OFF**
- SSE `done`: `provider_used` / `latency_ms` / optional `ttft_ms` (IMP-12)
- AI runtime: Cloud Run API only (not Vercel)
- Audit: **97 PASS** · P0 docs **0**

## Next command for agents

```text
1. Read SDD.md §1, §5, §6, §10
2. Read audit/SCORECARD.json + audit/GAP-PLAN.md
3. Pick next unchecked IMP-XX from IMPLEMENTATION-GUIDE.md
   (GAP-PLAN order: IMP-02 → IMP-04/08 → IMP-09 …)
4. Implement → npm run test:agent → test:agent-golden → update PROJECT-STATE
```
