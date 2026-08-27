# xAI Voice Mode — rules for this agent

Read upstream when behavior is wrong; do not fork the docs into this repo.

| Doc | Use |
|-----|-----|
| [Speech to Speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech) | `wss://api.x.ai/v1/realtime`, `session.update`, function vs server tools |
| [Prompting Guide](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/prompting-guide) | Instruction shape and tool hygiene |
| [SIP / resumption](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip) | `session.resumption.enabled` |

BMC in-app Grok path is **WebSocket PCM** (`grokRealtimeTransport.js`), not OpenAI-style SDP POST (that 405s). Ephemeral mint: `POST /api/agent/voice/session`.

## Prompt shape (must stay)

Second person, H2 in this order:

1. Role & Persona  
2. Objective  
3. Conversation Flow  
4. Guardrails & Escalation  
5. Voice & Communication Style  
6. Optional: Business Facts, CRITICAL INSTRUCTIONS  

In-app file already follows this: `panelinBmcInstructions.js`.

**Tool hygiene (highest leverage):** only name tools that are **on the session**. A tool in the prompt but not in `session.update.tools` makes the model claim it can / cannot incorrectly. After any allowlist change, regenerate the Assist/CRITICAL bullets from the attached names.

Other Voice Mode facts that map to BMC:

- Custom **function** tools: client executes → `conversation.item.create` `function_call_output` → `response.create`. BMC: `/voice/action`.
- Server tools (`web_search`, `x_search`, collections, MCP): xAI runs them. In-app MCP with secret is **forbidden** on bootstrap; console/phone MCP is separate.
- Text and audio share the same WS: seed history with `conversation.item.create` (role user/assistant).
- Native reconnect: `session.resumption.enabled` (session cap ~120 min).
- `conversation.item.truncate` is **unsupported** on xAI; barge-in is cancel, not truncate.
- Input transcription is cumulative snapshots (may correct earlier text), not OpenAI-style deltas.

## Fine-tune loop

When speech is wrong (repetition, skipped tools, ASR garbage):

1. Confirm the tool is actually attached.
2. Run the Prompting Guide **critique** meta-prompt on the current instructions.
3. Patch `panelinBmcInstructions.js` + the markdown mirror.
4. Prove on **local** then **prod** ([local-prod.md](local-prod.md)).
