---
name: voice-xia
description: >
  Connect xAI Voice (Grok Realtime speech-to-speech) to the Panelin BMC agent with the
  same brain, tools, and calculator context as chat. Persist one conversation across
  Voice on/off so the operator can continue as text-to-text, speech-to-text, or
  speech-to-speech without losing history. Use when the user runs /voice-xia, says
  VoiceXia, conectá la voz al agente, historial voz→texto, apagó voice mode y seguir
  en chat, or wants Grok Live fused with Panelin AGENT_TOOLS.
---

# voice-xia

You are wiring **xAI Voice Mode** as the **spoken channel of Panelin BMC**, not a second bot. One agent, one thread, two I/O modes (speech vs text). Iterate **local first**, then the same script on **prod**.

## Load (in order)

1. [references/agent-spec.md](references/agent-spec.md) — what Panelin is today
2. [references/voice-mode-docs.md](references/voice-mode-docs.md) — xAI Voice rules (prompt shape, tool hygiene, resumption)
3. [references/voice-gap.md](references/voice-gap.md) — chat vs voice desfase
4. [references/implementation-plan.md](references/implementation-plan.md) — phases A–D
5. [references/local-prod.md](references/local-prod.md) — how to run and improve locally vs prod
6. [references/improvements.md](references/improvements.md) — backlog only; do not start these unless asked

Do not copy tool lists or instructions into new files. SoT is the code paths in agent-spec.

## Identity (non-negotiable)

- **Agente:** Panelin BMC — vendedor interno BMC Uruguay / METALOG SAS.
- **Voz consola/teléfono:** `agent_WDdcfWOG9NLd59zL`. Browser Speech-to-Speech **cannot** send `agent_id`.
- **Voz flotante:** Grok Realtime `wss://api.x.ai/v1/realtime` + `session.update` from Voice Brain Pack. Tools execute via `POST /api/agent/voice/action`. Never put `PANELI_MCP_SECRET` on bootstrap.
- Voice **is** that agent. If chat can do X and voice says it cannot, that is a bug (see voice-gap), not a product split.

## Modes — one thread

| Mode | Transport | History |
|------|-----------|---------|
| **S2S** | Grok Realtime (`useVoiceSession`) | Same `messages` store as chat |
| **S2T** | Hands-free / Whisper → `send()` | Same store |
| **T2T** | Panelin flotante text | Same store |

Turning Voice **off** must not wipe the thread. Turning it **on** must seed Realtime (items or `session.resumption`) from that store. Operator can go S2S → T2T → S2T → S2S at will.

Today Realtime keeps a local `transcript` and does not merge into chat `messages`. Hands-free already uses `send`/`messages`. Closing that split is phase A.

## When invoked

Match the user ask:

| Ask | Do |
|-----|----|
| Diagnose / “por qué no puede…” | Diff voice-gap vs live code; cite files |
| Implement / “unificá el hilo” / paridad tools | Follow implementation-plan A→B→C then **local-prod D** |
| Fine-tune speech | Prompting Guide critique on `panelinBmcInstructions.js`; tools named **===** tools attached |
| Improve locally | Change pack/UI, run local-prod local column, then same script on prod |

Always run the **local → prod** loop in local-prod.md before claiming done. New Cloud Run revision ⇒ **new voice session** (old WS keeps old tools).

## Guardrails

- HITL writes stay HITL (`user_confirmed` / spoken confirmation). Parity means the tool **exists** on voice, not that it auto-fires.
- Do not mint a parallel allowlist of 22 if the goal is zero skill gap — derive from `AGENT_TOOLS`.
- Do not tell the model it has a tool that is not on `session.update`.
- Do not edit xAI console as the in-app SoT; in-app SoT is `panelinBmcInstructions.js`.
