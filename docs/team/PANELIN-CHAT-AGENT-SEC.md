# Panelin Chat Agent — SEC (Software Engineering Complete)

> Status: **superseded as index** · Owner: bmc-panelin-chat · Updated: 2026-07-18  
> **Canonical SDD bundle:** [`docs/sdd/panelin-chat-agent/`](../sdd/panelin-chat-agent/) — as-built `SDD.md` (v0.3, audit **92/100 pass**) + target `SDD-TARGET.md`.  
> Purpose (this file): short operator-facing index (browser matrix, defects) — prefer SDD for architecture.

## 1. Scope & surfaces

| Surface | Entry | Voice stack |
|--------|--------|-------------|
| Embedded chat | `PanelinChatPanel` → `useChat` | Hands-free: `useHandsFreeVoice` (Web Speech + TTS) |
| Live character | `/panelin/live` → `PanelinLivePage` | Realtime: `useVoiceSession` (WebRTC + OpenAI) |
| Dictation (text) | mic in composer | Web Speech (`useDictation`), Whisper fallback |
| TTS read-aloud | speaker toggle in chat header | `speechSynthesis` (not Realtime) |

## 2. Architecture

```
Text:   UI → useChat → POST /api/agent/chat (SSE) → agentCore + tools → calc loopback
Hands-free voice: UI → useHandsFreeVoice → send(text) → same SSE chat → speechSynthesis reply
Realtime voice:   UI → useVoiceSession → POST /api/agent/voice/session → WebRTC OpenAI
```

**Do not conflate** embedded “modo voz” with OpenAI Realtime. Realtime is `/panelin/live` only.

## 3. API contracts (voice + chat)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/agent/chat` | optional / rate-limited | SSE: `text`, `tool_call`, `action`, `info`, `error`, `done` |
| POST | `/api/agent/voice/session` | as configured | Mint ephemeral Realtime `client_secret` |
| POST | `/api/agent/voice/action` | as configured | Validate function-call from Realtime |
| GET | `/api/agent/voice/health` | requireAuth | Key usability + recent errors |
| GET | `/api/agent/voice/errors` | requireAuth | In-memory ring buffer |

Ops secrets: [`runbooks/PANELIN-IA-OPS.md`](./runbooks/PANELIN-IA-OPS.md).

## 4. Browser matrix

| Browser | Hands-free (embedded) | Realtime (`/panelin/live`) |
|---------|----------------------|----------------------------|
| Chrome / Edge | Supported | Supported |
| Safari | Supported (Web Speech) | **Blocked** — WebRTC Realtime unreliable |
| Firefox | Whisper push-to-talk (`/api/agent/transcribe`) | Blocked if no RTCPeerConnection |

Helpers: `src/hooks/voiceSupport.js` — `isHandsFreeSupported()`, `canUseWhisperVoice()`, `isBrowserSupported()`, `isSafari()`.

## 5. Known defects (tracked)

| ID | Status | Notes |
|----|--------|-------|
| V1 | Fixed 2026-07-18 | Safari hard-gate showed Realtime error while embedded path is Hands-free |
| V2 | Fixed 2026-07-18 | UI copy claimed OpenAI Realtime on embedded toggle |
| V3 | Fixed 2026-07-18 | Wake-word `onend` exponential backoff + max attempts |
| C1 | Open | Text chat fluency / provider failover latency — needs live traces |

## 6. Test plan

Offline: `npm run test:agent`, `tests/wakeWord.test.js`, `tests/panelinLiveVoice.test.js`, `npm run test:agent-golden`.  
Live checklist: see canvas review / PROJECT-STATE; Chrome for Realtime; Safari+Chrome for Hands-free.

## 7. Security notes

- Long-lived `OPENAI_API_KEY` never sent to the browser; Realtime uses ephemeral token.
- `voice/health` and error buffers require auth.
- Write tools stay behind confirmation / grants (see agent tools + identity).

## 8. Change log

Append product-affecting voice/chat changes under **Cambios recientes** in [`PROJECT-STATE.md`](./PROJECT-STATE.md).
