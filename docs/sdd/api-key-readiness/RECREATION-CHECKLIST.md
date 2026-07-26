# RECREATION-CHECKLIST — API Key Readiness

**SDD:** `docs/sdd/api-key-readiness/SDD.md` v1.1  
**Purpose:** An implementer can rebuild the readiness subsystem using only SDD + this checklist + repo.

## Prerequisites

- [ ] Repo `~/calculadora-bmc` clone with Node 20+
- [ ] Doppler CLI authenticated (`bmc-backend` / `prd`)
- [ ] Read SDD §§1–12 + Appendix C

## Layer 0–1 (already shipped — verify)

- [ ] `isUsableApiKey` rejects placeholders (`node tests/apiKeyUtils.test.js`)
- [ ] `getApiKey` returns empty for placeholders (`node tests/aiProviderConfigKeys.test.js`)
- [ ] Circuit breaker module present (`server/lib/providerCircuitBreaker.js`)
- [ ] `assistantHealth` documents no synthetic ping (lines 10–12)

## Phase A — Backend readiness

- [ ] Create `server/lib/providerProbes.js` per SDD §6.5
- [ ] Create `server/lib/providerReadiness.js` (cache TTL, aggregate, reason map)
- [ ] Wire `recordProviderSuccess` / `recordProviderFailure` on probe results
- [ ] Unit tests: placeholder, 401→auth_failed, 200→ready (real exports)

## Phase B — HTTP

- [ ] Create `server/routes/providerStatus.js`
- [ ] Mount: `app.use("/api", createProviderStatusRouter())` near `index.js:1014`
- [ ] Auth: status = chat class; probe = `requireServiceOrUser({ role: "admin" })`
- [ ] Extend ai-options with `readiness` envelope
- [ ] Compose assistants status `providers.readiness`

## Phase C — UI

- [ ] `useProviderReadiness` poll ≤60s
- [ ] Lights near Panelin chat / provider select (`useChat` ai-options path)
- [ ] Disable not_ready in picker when `AI_OPTIONS_REQUIRE_LIVE=1`
- [ ] Admin Reprobar → POST probe

## Phase D — Live verify

- [ ] Local: `doppler run --project bmc-backend --config prd -- node server/index.js`
- [ ] `GET /api/agent/providers/status` → gemini green if key live
- [ ] `POST /api/agent/chat` twice with gemini → non-empty assistant text
- [ ] Red light for claude if still no credits (billing reasonCode)

## Deploy notes (do not invent secrets)

- [ ] Local secrets: Doppler only
- [ ] Prod keys: GSM / Cloud Run env (names in SDD §8.3)
- [ ] Optional env: `PROVIDER_READY_TTL_MS`, `AI_OPTIONS_REQUIRE_LIVE`

## Done when

- [ ] All Phase A–D checks green
- [ ] SDD acceptance criteria (§ Appendix C) satisfied
- [ ] HANDOFF / PROJECT-STATE note: Ready lights shipped
