# RECREATION-CHECKLIST — Panelin Voice Agent

## As-built understanding

- [ ] Dual stack: chat HF/Whisper vs Live Realtime
- [ ] Files: `useHandsFreeVoice`, `useVoiceSession`, `agentVoice.js`, `PanelinVoicePanel`, `PanelinLivePage`
- [ ] Live tools are a **subset**; chat voice uses full text agent

## Smart default path (Tier 1)

- [ ] HF wake works in Chrome/Safari
- [ ] Whisper fallback when no Web Speech
- [ ] Chat model selector affects `send()` replies
- [ ] Mic blocked when no usable text provider (improvement)

## Live path (Tier 2)

- [ ] `POST /api/agent/voice/session` mints ephemeral key
- [ ] `realtimeModel` allowlisted via `resolveRealtimeModel`
- [ ] `/voice/action` validates buildQuote
- [ ] Tool bridge to agentCore (improvement — not shipped)

## Ops

- [ ] `OPENAI_API_KEY` usable for Live/Whisper
- [ ] Readiness lights show openai state
