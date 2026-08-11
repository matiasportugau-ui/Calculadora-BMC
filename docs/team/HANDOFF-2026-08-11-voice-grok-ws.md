# HANDOFF — 2026-08-11 — Grok Voice: fix SDP 405 via WebSocket transport

## Goal condition

`/panelin/live` with `VOICE_PROVIDER=grok` must not fail with **`SDP negotiation failed: 405`**. Grok duplex uses **WebSocket PCM**, OpenAI keeps **WebRTC SDP**.

## Root cause (confirmed)

| Step | Result |
|------|--------|
| `POST /api/agent/voice/session` (mint) | 200 OK |
| Browser `POST https://api.x.ai/v1/realtime?model=…` `Content-Type: application/sdp` | **405** body: `Request method must be GET` |

xAI Grok Voice is **WebSocket-first** (`wss://api.x.ai/v1/realtime?model=…` + ephemeral subprotocol `xai-client-secret.<token>`). BMC incorrectly reused OpenAI’s browser SDP POST for Grok after pinning `VOICE_PROVIDER=grok`.

## What shipped (this session)

| File | Change |
|------|--------|
| `src/utils/grokRealtimeTransport.js` | **NEW** — WS URL, protocols, PCM16 helpers, session.update builder |
| `src/hooks/useVoiceSession.js` | Branch: **Grok → WebSocket + mic PCM**; **OpenAI → WebRTC SDP** |
| `vercel.json` | CSP `connect-src` adds **`wss://api.x.ai`** |
| `tests/grokRealtimeTransport.test.js` | **NEW** pure unit tests |
| `tests/voiceConversationContract.test.js` | Contract expects Grok WS, not Grok SDP |

## How to verify (operator)

1. Deploy frontend (Vercel) so SPA + CSP land.
2. Chrome → login → `https://calculadora-bmc.vercel.app/panelin/live`
3. Allow mic → click start.
4. Network: **no** SDP POST to `api.x.ai/v1/realtime` with 405.
5. Expect **WS** `wss://api.x.ai/v1/realtime?model=grok-voice-latest` open + audio.

Local unit:

```bash
node tests/grokRealtimeTransport.test.js
node tests/voiceConversationContract.test.js
```

## Residual / follow-ups

- Live browser E2E still needs human mic on prod after Vercel deploy.
- Optional: binary WS audio transport for lower overhead.
- Optional: CI probe that opens WS after mint (not only health/session).
- Chat “modo voz” remains Web Speech (hands-free) — separate from duplex.

## Next prompt

```
Deploy calculadora-bmc SPA (vercel) and verify /panelin/live in Chrome:
WS to api.x.ai opens, no SDP 405, can speak with Panelin.
```
