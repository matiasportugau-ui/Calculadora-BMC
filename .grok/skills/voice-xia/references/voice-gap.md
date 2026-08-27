# Chat vs Voice — capability gap

Target: **same skills as the flotante text agent**. Reduced voice allowlist is desfase, not a feature.

## Tools

SoT names: `AGENT_TOOLS` in `server/lib/agentTools.js` vs `VOICE_BRAIN_TOOL_ALLOWLIST` in `server/lib/voiceBrainPack.js`.

**On voice today (allowlist + form + web_search):** calc/catalog, `aplicar_estado_calc`, Admin **read** (`sheets_get_pending_admin`, list/read/find), `generar_pdf`, `admin_cargar_pdfs_fila`, `archivar_pdfs_drive`, `set*` form tools.

**On text, not on voice (typical):** `agregar_extraordinario`, `obtener_informe_completo`, CRM (`guardar_en_crm`, `buscar_cliente_crm`, `formatear_resumen_crm`, taxonomía), WhatsApp (`enviar_whatsapp_link`, `wa_lead_to_admin`), Wolfboard `*`, email `*`, Traktime `*`, `sheets_propose_write` / `sheets_write_range`, `cancelar_cotizacion`, `obtener_pdf_html`, `programar_seguimiento`, `recuperar_casos_similares`, `list_bug_reports`, `pea_explain_gap`.

Writes stay HITL (`user_confirmed` or spoken confirm). Parity = the tool is **callable** after the operator says so.

## Thread

| Path | History |
|------|---------|
| Text | `messages` in chat hook |
| Hands-free | Uses `send` + `messages` |
| Realtime S2S | Local `transcript` in `PanelinVoicePanel`; **not** appended to `messages` |
| Voice off | WS torn down; transcript not shown in text UI |

No `conversationId` persistence, no Realtime item seed, no `session.resumption`.

## Prompt vs tools

Instructions already tell the model to call PDF / planilla / Drive. They do **not** list CRM/WA/email. After expanding allowlist, Assist + CRITICAL must mention only attached tools (Voice Mode hygiene).

## SDD debt

`docs/sdd/panelin-voice-agent/SDD.md`: one shared brain, two transports. Chat HF already hits the full text agent; Live/Grok must not stay a subset.
