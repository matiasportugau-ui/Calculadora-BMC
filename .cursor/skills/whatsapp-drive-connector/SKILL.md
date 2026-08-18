---
name: whatsapp-drive-connector
description: >-
  Knowledge pack for a WhatsApp Drive connector in Calculadora BMC: read
  MANIFEST + source map + blueprint before designing or coding WA+Drive
  context. Use when the user says WhatsApp Drive, conector WhatsApp Drive,
  WA+Drive knowledge, Drive as WhatsApp context, or knowledge pack for
  the WhatsApp connector.
---

# WhatsApp Drive connector — knowledge first

**Not** an implementation skill for a new sync product. Ground in the pack, then code only if the user asked to build the connector.

## Read first (strict order)

1. [`docs/team/connectors/whatsapp-drive/README.md`](../../../docs/team/connectors/whatsapp-drive/README.md)
2. [`docs/team/connectors/whatsapp-drive/MANIFEST.json`](../../../docs/team/connectors/whatsapp-drive/MANIFEST.json)
3. [`SOURCE-MAP.md`](../../../docs/team/connectors/whatsapp-drive/SOURCE-MAP.md)
4. [`BLUEPRINT.md`](../../../docs/team/connectors/whatsapp-drive/BLUEPRINT.md)
5. [`CONTEXT-RECIPE.md`](../../../docs/team/connectors/whatsapp-drive/CONTEXT-RECIPE.md)
6. `knowledge/` files for the **layer** you need (`always` / `on_quote` / `on_media` / `on_ops`)

Verify: `node tests/waDriveKnowledgePack.test.js`

## When to use

- WhatsApp Drive connector, conector WhatsApp Drive
- Knowledge folder so the WhatsApp connector can build context
- WA + Google Drive together (quotes, PDF links, archive, media confusion)
- Designing Drive-backed context for cockpit / Omni suggest

## When not to use

- GIS Client ID / `invalid_client` only → `bmc-google-drive-oauth`
- Meta webhook cm-0 clicks only → `docs/team/WHATSAPP-META-E2E.md` + `human-gates-bmc`
- PANELSIM email inbox → `panelsim-email-inbox`
- Changing calc prices → `bmc-calculadora-specialist`

## Invariants

- Human gate on every customer WhatsApp send (`user_confirmed` / send-approved).
- Inbound WA has **no** tool loop.
- Drive scope is **`drive.file` only**.
- WA chat media = **GCS** `wa-media/`, not Drive.
- Do **not** inject this pack into `data/knowledge/` (global chat prompt).
- Never paste token values. Env **names** only.
- Unverified prod flags → `#ZonaDesconocida`.

## Complements

- Rule: `.cursor/rules/bmc-whatsapp-drive-company-knowledge-first.mdc`
- Role stub: `docs/team/knowledge/WhatsAppDrive.md`
- Drive OAuth SOP: `.cursor/skills/bmc-google-drive-oauth/SKILL.md`
- Meta playbook: `.cursor/skills/meta-social-api-config-agent/SKILL.md`
