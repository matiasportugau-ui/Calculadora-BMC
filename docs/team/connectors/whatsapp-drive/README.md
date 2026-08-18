# WhatsApp Drive connector — knowledge pack

**Purpose:** one folder of **accessible files** so a WhatsApp connector (Cursor agent, Omni/WA enricher, or a future Drive-aware WA bot) can **build context** without hunting the rest of the repo.

This pack is **knowledge**, not the connector implementation. WhatsApp and Google Drive are separate systems today. There is **no** Drive-indexed WhatsApp corpus.

**Pattern:** company-knowledge-first, same idea as Email (`docs/team/EMAIL-SOURCE-MAP.md` + `INBOX-AI-FIRST-BLUEPRINT.md`).

---

## Read order (agents and connectors)

1. This `README.md`
2. [`MANIFEST.json`](./MANIFEST.json) — machine list, layers, paths
3. [`SOURCE-MAP.md`](./SOURCE-MAP.md) — verified inventory of live files, routes, env, tables
4. [`BLUEPRINT.md`](./BLUEPRINT.md) — as-built vs intended connector; gaps explicit
5. [`CONTEXT-RECIPE.md`](./CONTEXT-RECIPE.md) — how to assemble WA context without flooding the 800-char budget
6. [`knowledge/`](./knowledge/) files listed in the manifest layer you need

Do **not** dump the whole pack into a WhatsApp reply prompt. Use layers (`always` / `on_quote` / `on_media` / `on_ops`).

---

## What lives here vs elsewhere

| Here | Elsewhere (do not duplicate) |
|------|------------------------------|
| Synthesized facts + verified index | Full cockpit docs: `docs/wa-cockpit/` |
| Connector context recipe | Meta E2E checklist: `docs/team/WHATSAPP-META-E2E.md` |
| Drive + WA intersection | GIS setup: `docs/GOOGLE_DRIVE_SETUP_PROMPT.md` |
| Gaps / non-goals | Runtime Training KB: `data/training-kb.json` (GCS in prod) |

**Never** put tokens, refresh tokens, or live folder IDs in this folder. Env **names** only.

---

## Quick facts (always true)

- Inbound Cloud API auto-reply to the customer is **not** the default. Suggestions go to CRM / cockpit / Omni for a human.
- Outbound Graph send is gated: operator approve, Omni reply, or tool `enviar_whatsapp_link` with `user_confirmed`.
- Drive scope is **`drive.file` only** (files this app created or the user granted). Cannot browse an arbitrary company knowledge library.
- WA media lives in **private GCS** (`wa-media/`), not Google Drive.
- Quote PDFs / `.bmc.json` live in Drive under a client → code tree.
- Prices are **USD without IVA**; 22% IVA applied once at the total. Operator copy is Spanish.

---

## Skill / rule

- Skill: `.cursor/skills/whatsapp-drive-connector/SKILL.md`
- Rule: `.cursor/rules/bmc-whatsapp-drive-company-knowledge-first.mdc`
- Role stub: `docs/team/knowledge/WhatsAppDrive.md`

Verify pack integrity: `node tests/waDriveKnowledgePack.test.js`
