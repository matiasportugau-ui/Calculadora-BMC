# Meta Business Agent + WhatsApp as BMC customer nexus

**Date:** 2026-10-11  
**Status:** Investigation complete for architecture; **eligibility blocked** (expired Cloud API token).  
**Decisions locked with Matias:** compare Architectures A/B/C side-by-side; **HITL before quote send**.  
**Repo:** `calculadora-bmc` · Cloud Run `panelin-calc` · Meta app `chatbo2` · Phone Number ID `857133467479731`

---

## 1. Executive answer

Yes — Meta’s stack can act as the **customer-facing nexus** for: collect data → BMC registers/quotes/approves → agent receives speech guidelines + deliver-or-ask instructions → finishes the contact.

The product that matches that loop is **Meta Business Agent (MBA)** on the **WhatsApp Cloud API**, using:

- **Instructions** = standing speech / brand guidelines  
- **Connectors** = BMC APIs the agent calls while chatting (intake, missing fields, quote status)  
- **Agent Events** = BMC pushes `quote_ready` / `need_fields` after HITL approve  

**WhatsApp Business Tools MCP** is only for *developer setup* (WABA, templates, webhooks via Claude/Cursor/Grok). It is not the customer agent.

**Recommended path:** Architecture **C (hybrid)** — keep today’s BMC Cloud API + Omni + HITL for production; pilot MBA on an allowlist once a **permanent System User token** exists and `agent_eligibility` returns `true`.

---

## 2. Glossary (do not mix these)

| Name | What it is | Customer-facing? |
|---|---|---|
| **WhatsApp Business app AI** | Phone Tools → “Meta Business Agent”; limited countries / waitlist | Yes, but **app** path — not BMC’s Cloud API number workflow |
| **WhatsApp Business Tools MCP** | `https://mcp.facebook.com/whatsapp_business_tools` — AI coding agents manage WABA/setup | No |
| **Meta Business Agent (MBA)** | Meta-hosted AI; primary responder on Cloud API number; knowledge + instructions + connectors + events | **Yes** |
| **Cloud API custom agent** | Our webhook + `callAgentOnce` / Panelin / Omni | **Yes** (current) |

Sources: [MBA capabilities](https://developers.facebook.com/documentation/meta-business-agent/capabilities) (updated 2026-09-18), [Connectors](https://developers.facebook.com/documentation/meta-business-agent/reference/configure/connectors), [Agent Event](https://developers.facebook.com/documentation/meta-business-agent/reference/operate/agent-event), [WhatsApp Business Tools MCP](https://developers.facebook.com/documentation/mcp/whatsapp-business-tools-mcp).

---

## 3. Desired BMC loop → Meta primitives

```text
Customer WhatsApp message
        │
        ▼
 Meta Business Agent (primary)
   • Instructions = speech guidelines (ES-UY BMC)
   • Connectors → BMC /api/meta-agent/*
        │
        ▼
 BMC: register lead → calc/quote → Admin/Omni HITL approve
        │
        ├─ approved  → Agent Event type=quote_ready  (PDF URL + talking points)
        ├─ incomplete→ Agent Event type=need_fields  (field list)
        └─ escalate  → Thread control / handoff → Omni human
```

| Requirement | Primitive | Notes |
|---|---|---|
| Collect customer info | MBA conversation + connector `intake_upsert` | Structured JSON into CRM / omni |
| Register / quote / approve | **BMC only** | Never let MBA invent m² prices |
| Speech guidelines | Agent Instructions API | Standing brand voice |
| Per-quote send brief | Agent Event `payload` | Opaque JSON ≤4096 chars |
| Deliver quotation | Event `quote_ready` | Requires **existing** conversation |
| Ask pending info | Event `need_fields` or connector `{missing:[…]}` | System-driven |
| HITL before send | Approve in Admin/Omni **then** fire event | Locked decision |

---

## 4. Architecture A vs B vs C

### A — MBA primary (Meta front door)

MBA answers first; BMC on **standby webhooks**; connectors + Agent Events.

| Pros | Cons |
|---|---|
| Strong multi-turn UX without owning NLU | AI reply billing (~US$0.04–0.05/interaction reported; confirm Billing Hub) |
| Instructions + Events match “speech + deliver/ask” | Eligibility per phone ID; ToS + payment for open audience |
| Allowlist ≤20 numbers for free test | Must disable our auto-replies or we double-answer |
| | Less word-level control than Panelin |

### B — BMC / Panelin primary (current trajectory)

`POST /webhooks/whatsapp` → `wa_*` → flush→CRM → Omni HITL → `whatsappOutbound` / templates.

| Pros | Cons |
|---|---|
| Already in repo (`ARCHITECTURE.md` §4.3, Omni, agent tools) | We own all conversation quality |
| Full HITL + “one brain” (`INBOX-AI-FIRST-BLUEPRINT.md`) | More work for polished intake UX |
| Aligns with 24h window + templates policy | Parallel WhatsApp Web HITL path still separate |

### C — Hybrid (recommended)

1. Production quotes stay on **B** + HITL.  
2. Pilot **A** on allowlist: intake + FAQ via MBA; quote send only via Agent Event after approve.  
3. Omni ingests standby so `/hub/canales` sees MBA threads.  
4. One primary responder per number — never MBA + auto outbound together.

---

## 5. Fit to calculadora-bmc today

**Present**

- Secrets (Doppler `bmc-backend/prd`): `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
- Phone Number ID: `857133467479731` (API-dedicated number from Run 55 / PROJECT-STATE)
- Webhook: `POST /webhooks/whatsapp` on Cloud Run `panelin-calc`
- CRM auto-parse after idle; Omni WA adapters; `enviar_whatsapp_link` write-gated
- Refresh helper: `scripts/wa-refresh-access-token.sh` (GSM + Cloud Run mount)

**Missing for A**

1. Thin connector API (`/api/meta-agent/*`, API key): `intake_upsert`, `quote_status`, `list_missing_fields`  
2. Agent Event publisher on approve-send  
3. Standby webhook + thread-control when ops reply  
4. Instructions pack (ES-UY) + knowledge (non-price FAQs)  
5. Permanent System User token with `whatsapp_business_messaging` + `whatsapp_business_management`  
6. Confirmed `agent_eligibility` + MBA Terms in WhatsApp Manager  

---

## 6. Phase 0 live probe (2026-10-11)

| Check | Result |
|---|---|
| Doppler secrets present | Yes (4 WHATSAPP_* keys) |
| `WHATSAPP_PHONE_NUMBER_ID` | `857133467479731` |
| Graph `GET /{PHONE_ID}` | **401** — token expired **2026-10-02 22:00 PDT** (`OAuthException` 190 / subcode 463) |
| `GET /{PHONE_ID}/agent_eligibility` (`X-API-Version: 2.0.0`) | **401** Authentication Error (same dead token) |
| `GET /{PHONE_ID}/agent_settings` | **404** path (unreliable while unauthenticated; re-check after token) |

**Blocker (human):** Create a **permanent System User** token in Meta Business Suite for app `chatbo2` (ID `4144439239205293`) with scopes `whatsapp_business_messaging` + `whatsapp_business_management`, then pipe into Doppler + GSM via existing refresh script. Already flagged in `HANDOFF-2026-10-03-0215.md`.

Until that lands, **Go/No-Go on MBA eligibility is UNKNOWN**.

---

## 7. Proposed connector + event contract (pilot)

### Connector tools (MBA → BMC)

| Tool | Method | Purpose |
|---|---|---|
| `intake_upsert` | POST | Name, phone, obra, measures, city, notes → CRM/omni |
| `list_missing_fields` | GET | What BMC still needs for a quote |
| `quote_status` | GET | `pending_intake` \| `quoting` \| `awaiting_approval` \| `approved` \| `sent` |

Auth: `API_KEY` header. No tool that sends a commercial PDF without a server-side HITL grant.

### Agent Events (BMC → MBA)

| `event.type` | When | Payload ideas |
|---|---|---|
| `need_fields` | Calc/CRM incomplete | `{ missing: ["largo_m","ubicacion"], speech: "…" }` |
| `quote_ready` | After HITL approve | `{ cotizacion_id, pdf_url, total_uyu, speech: "…" }` |
| `quote_rejected` | Ops decline | `{ reason, speech }` |
| `handoff` | Need human | `{ reason }` |

Meta: `POST https://api.facebook.com/{phone_number_id}/agent_event` with `to` (E.164), `event.{type,description,payload}`; poll status. Consumer must already be in conversation; thread must be owned by agent.

---

## 8. Policy constraints (non-negotiable)

- HITL before commercial quote delivery  
- Pricing authority = BMC calc only  
- Cloud API 24h window / templates after close (`~/.ialfred/kb/wa-protocol-vs-meta.md`)  
- WhatsApp Web HITL (`ia wa`) stays a separate lane  
- Production HMAC: keep `WHATSAPP_APP_SECRET` mounted  

---

## 9. Recommendation + next steps

**Recommend Architecture C** once eligibility is known.

| Step | Owner | Action |
|---|---|---|
| 1 | Matias | Mint permanent System User token; update Doppler `bmc-backend/prd` + GSM `WHATSAPP_ACCESS_TOKEN` (`scripts/wa-refresh-access-token.sh`) |
| 2 | Agent | Re-run `GET /{PHONE_ID}/agent_eligibility` → write Go/No-Go |
| 3 | Agent | If eligible: WhatsApp Manager MBA checklist + allowlist pilot design (Phase 2) |
| 4 | Agent | If not eligible: deepen Architecture B (intake quality + HITL send + templates) only |

### Resume prompt

```text
Continue META-BUSINESS-AGENT-NEXUS: WHATSAPP_ACCESS_TOKEN was refreshed.
cd ~/calculadora-bmc
1) Re-probe GET /{PHONE_NUMBER_ID}/agent_eligibility and agent_settings
2) Update docs/team/investigation/META-BUSINESS-AGENT-NEXUS-2026-10.md with Go/No-Go
3) If eligible, draft Phase 2 connector + Agent Event pilot spec (HITL-gated quote_ready)
```

---

## 10. References

- Meta: [MBA capabilities](https://developers.facebook.com/documentation/meta-business-agent/capabilities), [Get API key](https://developers.facebook.com/documentation/meta-business-agent/get-started), [Eligibility](https://developers.facebook.com/documentation/meta-business-agent/reference/onboard/agent-eligibility), [Connectors](https://developers.facebook.com/documentation/meta-business-agent/reference/configure/connectors), [Agent Event](https://developers.facebook.com/documentation/meta-business-agent/reference/operate/agent-event), [WhatsApp Business Tools MCP](https://developers.facebook.com/documentation/mcp/whatsapp-business-tools-mcp)
- BMC: `docs/team/ARCHITECTURE.md` §4.3, `docs/team/INBOX-AI-FIRST-BLUEPRINT.md`, `docs/team/WHATSAPP-META-E2E.md`, `docs/team/HANDOFF-2026-10-03-0215.md`, memory `wa-protocol-vs-meta`
