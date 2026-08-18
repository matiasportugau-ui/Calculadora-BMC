# Context recipe — WhatsApp Drive connector

WhatsApp replies are short. Channel rules cap the **customer-facing** answer at **800 characters**. `callAgentOnce({ channel: "wa" })` defaults to **`maxTokens: 400`**. Training KB surface `whatsapp` truncates at **700** (`kbSurface.SURFACE_LIMITS`).

Dumping this whole folder into the system prompt will drown the model and still produce a 800-char answer. Load **layers**.

---

## Layers (`MANIFEST.json` → `layers`)

| Layer | When | Files |
|-------|------|--------|
| `always` | Every WA+Drive context build | identity/gates, AI stack, gaps |
| `on_quote` | Thread mentions cotización, PDF, código BMC, Drive, abrir proyecto | archive, folder tree, export paths |
| `on_media` | Image, audio, voice note, adjunto | GCS vs Drive |
| `on_ops` | Flags, webhook, cockpit, env, OAuth, operator how-to | inbound, outbound, Omni, env, Drive auth, playbook |

**Connector algorithm**

1. Read `MANIFEST.json`.
2. Concatenate `layers.always` (full text).
3. Classify the current thread (quote / media / ops / none).
4. Append matching extra layers.
5. Optionally append last 5 Omni messages + RAG quotes (`kbBridge.buildOmniRetrievalContext`) — that is **runtime**, not this pack.
6. Call `callAgentOnce` with `channel: "wa"`. Do **not** enable tools on inbound webhook / enricher / Omni suggest.

---

## What to inject vs what to retrieve

| Source | Inject? | Notes |
|--------|---------|--------|
| This pack (`knowledge/*.md`) | File-read / future loader | Grounding for connector agents. **Not** wired into `data/knowledge/` (that dump goes into **all** chat prompts). |
| `data/knowledge/*.md` | Already in chat system prompt | Product facts (fichas, FAQ). Shared across channels. |
| Training KB `goodAnswerWA` | Runtime few-shot | Prefer WA-specific answers; auto-learn from WA with human-approved entries. |
| pgvector RAG | Runtime, flag `RAG_ENABLED` | Similar quotes. Often off / skipped if embeddings are stub. |
| Drive `.bmc.json` | On demand | Load via `GET /api/quotes/drive-project?folderId=` (server OAuth) or GIS `loadProjectFromFolder`. Not a corpus. |
| WA media bytes | Signed GET | Private GCS. Never treat as Drive files. |

---

## Budget

| Surface | Limit |
|---------|--------|
| Customer WA text (channel rule) | 800 characters |
| Graph API hard cap | 4096 characters (`whatsappOutbound` slices) |
| Training KB `whatsapp` surface | 700 characters |
| Mercado Libre (do not mix) | 350 characters, no URLs, no markdown |
| Panelin chat | No length cap; tools allowed |

Closing line for WA: `¡Saludos! BMC Uruguay`

---

## Do not

- Inject `SOURCE-MAP.md` or `BLUEPRINT.md` into the **customer** prompt (too long). Those are for the **connector/agent** building or operating the system.
- Put Drive folder IDs or OAuth tokens in the prompt.
- Assume inbound WA has a tool loop (it does not).
- Use full `https://www.googleapis.com/auth/drive` scope to “fix” listing. Product decision is `drive.file`.
