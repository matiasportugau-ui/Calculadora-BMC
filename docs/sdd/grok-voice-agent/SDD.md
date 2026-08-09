---
title: System Design Document — Grok Voice Agent Option for Panelin
version: 1.0
date: 2026-07-26
status: Accepted
author: sdd-kit (Grok)
source: greenfield-feature-on-existing-stack
related:
  - docs/sdd/panelin-voice-agent/SDD.md
  - docs/sdd/panelin-agent-selector/SDD.md
---

# System Design Document: Grok Voice Agent Option

## 1. Introduction & Goals

### 1.1 Problem
Operators want **Grok** as a voice agent option. Today Live duplex is **OpenAI Realtime only**; chat hands-free already can use Grok **text** via selector → `send()`, but Live never minting xAI.

### 1.2 Goals
| # | Goal | Priority |
|---|------|----------|
| G1 | Select **Grok** → Live uses **Grok Voice Agent API** | P0 |
| G2 | Ephemeral tokens (no long GROK key in browser) | P0 |
| G3 | Same Panelin tools via `/voice/action` | P0 |
| G4 | Chat HF path: Grok text model when selector = grok (already largely true) | P0 |
| G5 | Readiness: grok key must be usable for Live | P1 |

### 1.3 Non-goals
- Replacing OpenAI Realtime (keep as parallel option)
- LiveKit-only path (optional later)
- Multi-provider simultaneous sessions

## 2. Context

xAI Grok Voice Agent API (Dec 2025+): speech-to-speech, tool calling, **OpenAI Realtime–compatible**.

| Endpoint | Role |
|----------|------|
| `POST https://api.x.ai/v1/realtime/client_secrets` | Ephemeral token |
| `wss://api.x.ai/v1/realtime?model=…` | Realtime session |
| WebRTC SDP | Same pattern as OpenAI (cookbook WebRTC agent) |

Auth: `GROK_API_KEY` / `XAI_API_KEY` → Bearer for mint.

## 3. Constraints
- Browser: Chrome/Edge for WebRTC (same as OpenAI Live)
- Body for xAI client_secrets: `{ expires_after: { seconds } }` — **not** full OpenAI `session` embed
- Browser WS uses `xai-client-secret.${token}` protocol if WS; WebRTC uses SDP POST with Bearer

## 4. Solution Strategy

**Extend voice session mint + client SDP base URL by `voiceProvider`.**

| Selector `aiProvider` | Chat HF/Whisper brain | Live duplex engine |
|----------------------|----------------------|--------------------|
| `auto` | failover chain | OpenAI Realtime (default) |
| `openai` | OpenAI text | OpenAI Realtime |
| `grok` | Grok text | **Grok Voice** |
| `claude` / `gemini` | that text model | OpenAI Realtime default + UI note |

## 5–7. Design (summary)

1. Server `POST /agent/voice/session` body: `aiProvider`, `aiModel`, optional `realtimeModel`, optional `voiceProvider`.
2. If effective provider is **grok**: mint with `GROK_API_KEY` at xAI `client_secrets`; model `grok-voice-latest` (or allowlist).
3. Response includes `provider: "grok"|"openai"`, `realtime_base` (HTTPS for SDP), `model`, `client_secret`.
4. Client `useVoiceSession` POSTs SDP to `realtime_base?model=` with Bearer ephemeral.
5. Tools: same calc function list + `/voice/action` relay.

## 8. Deploy
Env: `GROK_API_KEY` (already), optional `GROK_VOICE_MODEL=grok-voice-latest`.

## 9–12. Crosscutting / ADRs
- ADR: Prefer OpenAI-compat xAI Realtime over LiveKit for v1 (reuse WebRTC code).
- Risk: API shape drift; invalid GROK key → red readiness.

## Implementation phases
- **P1 (this ship):** Server dual mint + client dual SDP base + selector UX when grok. ✅
  - `server/lib/voiceRealtimeProviders.js` — resolve + mint OpenAI/Grok
  - `server/routes/agentVoice.js` — dual provider session response (`provider`, `realtime_base`, `session_bootstrap`)
  - `src/hooks/useVoiceSession.js` — SDP to server `realtime_base`; Grok `session.update` bootstrap
  - `AgentModelSelector` / `PanelinVoicePanel` — Live notes for Grok
  - Tests: `tests/voiceRealtimeProviders.test.js`, extended `panelinLiveVoice.test.js`
- **P2:** Voices (eve), language_hint es-ES/es-MX, keyterms isopanel.
- **P3:** Expand tools + web_search optional.

---
**End v1.0**
