# As-Built note — API Key Readiness (2026-07-26)

## Implementation shipped (Phases A–D)

| Phase | Artifacts |
|-------|-----------|
| A | `server/lib/providerProbes.js`, `server/lib/providerReadiness.js`, `tests/providerProbes.test.js`, `tests/providerReadiness.test.js` |
| B | `server/routes/providerStatus.js`, mount in `server/index.js`, `buildAiOptionsResponseWithReadiness`, `assistantHealth` compose, chat `markReadyFromTraffic` |
| C | `src/hooks/useProviderReadiness.js`, `src/components/ai/ProviderStatusLights.jsx`, PanelinChatPanel header lights, CoWork readiness line |
| D | Unit suite green; live probes return correct reasonCodes; chat ×2 with gemini returned non-empty `OK` |

## Live observations (local Doppler)

| Provider | Probe result (sample) |
|----------|----------------------|
| claude | red / `billing` (credit balance) |
| openai | red / `billing` (insufficient_quota) |
| grok | red / `invalid_key` |
| gemini | green when under free-tier RPM; amber `rate_limited` when free_tier_requests exceeded |
| openrouter | red / `missing_key` |

Chat `aiProvider=gemini` succeeded twice with assistant `"OK"` even when aggregate probe was red due to free-tier 429 — fail-open + traffic path remain valid.

## Deviation from design SDD

- **GET status is public** (rate-limited), not auth-gated, so SPA `apiClient` (no JWT) can show lights. Payload still has no full secrets (prefix only). POST probe remains admin.
- Gemini probe uses `maxOutputTokens ≥ 64` (thinking models empty at 8).

## Scorecard

Design SDD was **92/100 pass**. As-built: same architecture with CONFIRMED implementations. Full re-audit optional; no schema regression intended.

## Verify commands

```bash
node tests/providerProbes.test.js
node tests/providerReadiness.test.js
doppler run --project bmc-backend --config prd -- node server/index.js
curl -s http://127.0.0.1:3001/api/agent/providers/status | jq '.ready,.light,.providers[]|{id,light,reasonCode}'
```
