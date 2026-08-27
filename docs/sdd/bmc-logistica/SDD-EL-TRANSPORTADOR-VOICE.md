---
title: System Design Document — El Transportador Voice (Grok Speech-to-Speech)
version: 1.0
date: 2026-08-27
status: As-Built Final (main)
system_slug: bmc-logistica-transportador-voice
evidence_policy: CONFIRMED
---

# El Transportador — Voice agent spec (as-is + Grok S2S)

## As-built (text)

CONFIRMED on `main`: `LogisticaTruckerAgent.jsx` + `truckerAgent.js` + `server/lib/voice/logisticaTruckerInstructions.js`. Text chat via `/api/agent/chat` with `LOGISTICA_TRUCKER_IDENTITY`. ACTION_JSON HITL. Visor loop MP4. Mic: **Grok Voice** (`useVoiceSession` `surface=logistica`), not browser SpeechRecognition. No `setTecho` tool.

## Target (this cycle)

Grok **Speech-to-Speech** (`wss://api.x.ai/v1/realtime?model=grok-voice-latest`), ephemeral `xai-client-secret.`, `session.update` after connect. **No SDP POST** (405).

| session.update | Value |
|----------------|-------|
| voice | `rex` |
| instructions | Prompting Guide order: Role → Objective → Flow → Guardrails → Voice → Facts → CRITICAL |
| tools | setStopField, setEnviosInfo, setEnviosTruck, setLogisticaWizard, advanceLogisticaWizard, proposeTripPlan — **never** setTecho |
| turn_detection | server_vad, threshold 0.75, silence 900ms, idle 30s |
| audio | PCM 24 kHz in/out, json transport |
| transcription.language_hint | es-MX (regional; bare `es` invalid) |
| keyterms | Kingspan, Montfrío, OSRM, … |
| replace | BMC → be em ce, etc. |
| reasoning.effort | high |

Mint: `POST /api/agent/voice/session` `{ surface: "logistica", voiceProvider: "grok", calcState: snapshot }`.

## Non-goals

Panelin Live identity · auto-WA · merge to main · calculator tools.
