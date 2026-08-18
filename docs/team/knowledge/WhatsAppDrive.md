# WhatsApp Drive

**Stub:** the connector knowledge pack lives in:

**[`../connectors/whatsapp-drive/README.md`](../connectors/whatsapp-drive/README.md)**

Read order: `MANIFEST.json` → `SOURCE-MAP.md` → `BLUEPRINT.md` → `CONTEXT-RECIPE.md` → `knowledge/`.

Skill: `.cursor/skills/whatsapp-drive-connector/SKILL.md`.  
Rule: `.cursor/rules/bmc-whatsapp-drive-company-knowledge-first.mdc`.

## Entradas

- Pack README + MANIFEST (always).
- `docs/team/PROJECT-STATE.md` for live WA/Drive flags.
- Do not treat this stub as the facts file.

## Salidas

- Context assembled per `CONTEXT-RECIPE.md` layers.
- If implementing connector code: tests + SOURCE-MAP update in the same PR.

## Convenciones

- Human send gate. `drive.file` only. WA media = GCS. No secrets in the pack.

## Handoffs

- GIS OAuth breakage → skill `bmc-google-drive-oauth`.
- Meta cm-0 → `docs/team/WHATSAPP-META-E2E.md` + human-gates.

## Referencias

- [`../connectors/whatsapp-drive/SOURCE-MAP.md`](../connectors/whatsapp-drive/SOURCE-MAP.md)
- [`../../wa-cockpit/README.md`](../../wa-cockpit/README.md)
