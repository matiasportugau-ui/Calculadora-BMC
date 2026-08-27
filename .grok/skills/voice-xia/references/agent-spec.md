# Panelin BMC — agent spec (as-built)

Counts and lists below can drift; verify with `AGENT_TOOLS` / `VOICE_BRAIN_TOOL_ALLOWLIST` in code.

## Surfaces

| Surface | Path | Brain |
|---------|------|-------|
| Text chat | `PanelinChatPanel` → `/api/agent/chat` | Full `AGENT_TOOLS` via `executeTool` |
| In-app Voice (VoiceXia) | Mic on flotante → `useVoiceSession` Grok WS | `buildVoiceBrainPack` → `session.update`; actions `POST /api/agent/voice/action` |
| Hands-free / Whisper | Same flotante fallback | STT → `send()` into **text** agent → TTS |
| `/panelin/live` | Full-screen duplex | Same Realtime stack as flotante |
| Phone / xAI console | `agent_WDdcfWOG9NLd59zL` | Console instructions + remote MCP `/mcp` |

Docs: `docs/team/voice/XAI-VOICE-AGENT-PANELIN-BMC.md`, `docs/sdd/grok-voice-agent/SDD.md`, `docs/sdd/panelin-voice-agent/SDD.md`.

## Code SoT

| Piece | File |
|-------|------|
| Voice instructions | `server/lib/voice/panelinBmcInstructions.js` (human mirror: `docs/team/voice/PANELIN-BMC-INSTRUCTIONS.md`) |
| Pack (tools, voice, keyterms) | `server/lib/voiceBrainPack.js` |
| Mint + `/voice/action` | `server/routes/agentVoice.js` |
| Grok WS PCM | `src/utils/grokRealtimeTransport.js` |
| Session hook | `src/hooks/useVoiceSession.js` |
| UI voice | `src/components/PanelinVoicePanel.jsx` |
| `voiceMode` + `messages`/`send` | `src/components/PanelinChatPanel.jsx` |
| All tools | `server/lib/agentTools.js` (`AGENT_TOOLS`) |
| Sheets JSON vs path | `server/lib/googleSheetsAuth.js` |

## Config

| Key | Role |
|-----|------|
| Doppler `bmc-backend/prd` | Local API secrets (`GROK_API_KEY` / `XAI_API_KEY`, Sheets, Drive OAuth) |
| Doppler `bmc-frontend/prd` | Vercel SPA |
| Cloud Run `panelin-calc` | Prod API; GCP Secret Manager |
| `VOICE_PROVIDER=grok` | Prod pin (Grok WS, not OpenAI SDP) |
| `VITE_FEATURE_BRAIN` | Shared IAlfred lessons via `brainKB.js`; **off** in Doppler backend unless HITL |
| `PANELI_MCP_SECRET` | Bearer for `/mcp` only — never in browser `session.update` |

## Voice pack (current)

From `buildVoiceBrainPack`: `voice: eve`, `language_hint: es-ES`, `VOICE_KEYTERMS`, pronunciation `replace`, `web_search` allowed_domains `bmcuruguay.com.uy`, function tools = **allowlist 22** + form tools (`setScenario`, `setLP`, `setTecho`, `setPared`, `setCamara`, `setFlete`, `setProyecto`).

`VOICE_WRITE_AUTOCONFIRM`: `generar_pdf`, `admin_cargar_pdfs_fila`, `archivar_pdfs_drive`.

Form still goes through `onAction` / `aplicar_estado_calc`. `calcState` is sent on every `/voice/action`.

## Chat thread wiring

`PanelinChatPanel` passes `messages` and `send` into `PanelinVoicePanel`. Hands-free uses them. Realtime path keeps its own `transcript` state. `voiceMode` false hides voice (`display:none`) and **stops the WS**; the component stays mounted. `onSwitchToText` = `setVoiceMode(false)` only.

## Admin / Drive (voice writes that already work)

- Admin 2.0 workbook allowlisted as `"admin"`; pending = col I filled, col M empty; PDF links col M 🧾.
- Drive archive: user OAuth, not the service account.
