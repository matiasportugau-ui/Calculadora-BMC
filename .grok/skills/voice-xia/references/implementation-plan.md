# Implementation plan (VoiceXia = one agent)

Do not start this from the skill scaffold itself — execute when the user asks to implement. After each phase: [local-prod.md](local-prod.md).

## A — One thread

1. Single store: the chat `messages` array (do not keep a second source of truth).
2. Every Realtime user ASR + assistant transcript → append as chat turns (ids, roles).
3. Text UI shows those turns when `voiceMode` is false.
4. On Voice on: seed `conversation.item.create` for prior turns (or a short summary if over a cap) **and/or** `session.resumption` if reconnecting inside the xAI session TTL.
5. Pass the same `conversationId` as the chat id on `/voice/action`.
6. Tests: toggling `voiceMode` does not drop messages; S2S → T2T → S2S round-trip.

Hands-free already writes through `send`; do not fork a third history.

## B — Tool parity

1. Voice function tools = `AGENT_TOOLS` names (filter/map), not a hand-maintained list of 22.
2. Keep `VOICE_WRITE_AUTOCONFIRM` only for writes the operator already asked in speech (PDF, Admin M, Drive). All other writes: spoken / `user_confirmed` like chat.
3. Rewrite Assist + CRITICAL in `panelinBmcInstructions.js` from the **attached** tool names only.
4. Goldens: “sumalo fuera de lista”, “guardalo en CRM”, “mandale WhatsApp” must not yield “no tengo esa herramienta”.

## C — Prompt fine-tune

1. Critique `PANELIN_BMC_VOICE_INSTRUCTIONS` with the xAI Prompting Guide meta-prompt.
2. Keep Role→CRITICAL order; rioplatense; money spoken; product hyphenation (already in `replace` / keyterms).
3. Mirror human copy in `docs/team/voice/PANELIN-BMC-INSTRUCTIONS.md`.

## D — Local then prod

See [local-prod.md](local-prod.md). Script: quote → PDF → planilla; Voice off → text has turns; type a follow-up; Voice on → continues. Fail the phase if only one environment was checked.
