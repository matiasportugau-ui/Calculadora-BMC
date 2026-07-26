# Evidence inventory — Panelin voice (2026-07-26)

## Surfaces (two parallel stacks)

| Stack | UI entry | Hook | Backend | LLM path |
|-------|----------|------|---------|----------|
| **A. Chat embedded** | `PanelinChatPanel` → `PanelinVoicePanel` | `useHandsFreeVoice` / `useDictation` | `POST /api/agent/chat` (+ optional `/agent/transcribe`) | Text agent chain (claude/gemini/…) via `send()` |
| **B. Live Realtime** | `/panelin/live` `PanelinLivePage` | `usePanelinCharacterVoice` → `useVoiceSession` | `POST /api/agent/voice/session` + `/voice/action` | OpenAI Realtime WebRTC only |

## Files

| Path | Role |
|------|------|
| `server/routes/agentVoice.js` | session mint, action validate, health, errors |
| `src/hooks/useVoiceSession.js` | WebRTC + ephemeral key + function-call relay |
| `src/hooks/useHandsFreeVoice.js` | Wake word + Web Speech + browser TTS |
| `src/hooks/useDictation.js` | Whisper fallback (referenced) |
| `src/hooks/voiceSupport.js` | Capability gates |
| `src/hooks/usePanelinCharacterVoice.js` | Emotion + Realtime composition |
| `src/components/PanelinVoicePanel.jsx` | Chat voice UI |
| `src/components/PanelinLivePage.jsx` | Full-screen Realtime character |
| `src/utils/resolveRealtimeModel.js` | Chat selection → Realtime model |
| `server/lib/resolveRealtimeModel.js` | Server allowlist twin |

## Confirmed limitations

1. Two stacks do **not** share one intelligence path.
2. Chat voice intelligence = same as text agent (good for tools via chat tools).
3. Realtime intelligence = OpenAI tool list in `agentVoice.js` (subset of calc actions).
4. Safari blocked for Realtime; Hands-free needs Web Speech.
