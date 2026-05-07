# Email Administrator — rol y gobierno del canal correo

Actor responsable de **configuración y operación segura** del flujo PANELSIM / IMAP → API → CRM (`CRM_Operativo` en Sheets): snapshots, ingest automático o manual, revisión de reportes y uso de herramientas de borrador (sin envío SMTP desde la API).

No sustituye al director financiero ni a otros roles Panelin salvo que se les delegue explícitamente en documentación operativa.

## Superficie técnica

| Recurso | Auth | Notas |
|---------|------|--------|
| `POST /api/crm/ingest-email` | Bearer obligatorio | Ver abajo: `EMAIL_INGEST_TOKEN` y/o `API_AUTH_TOKEN` |
| `GET /api/email/panelsim-summary` | Cockpit (`API_AUTH_TOKEN`) | Resumen PANELSIM desde disco (`BMC_EMAIL_INBOX_REPO`) |
| `POST /api/email/draft-outbound` | Cockpit | Borrador para copiar a Thunderbird; no envía mail |

Política RBAC declarativa (cuando se enforce en middleware): rutas `/api/email/*` con rol mínimo `admin` — ver [`server/lib/panelinInternalRbac.js`](../../../server/lib/panelinInternalRbac.js).

## Autenticación de ingest (variante B)

Implementación en [`server/lib/emailIngestAuth.js`](../../../server/lib/emailIngestAuth.js):

- Debe existir al menos uno de: **`API_AUTH_TOKEN`** (o `API_KEY`) o **`EMAIL_INGEST_TOKEN`**. Si ninguno está configurado, el servidor responde **503** en ingest.
- Request sin Bearer / `X-Api-Key` / `?key=` válido → **401**.
- Si **`EMAIL_INGEST_TOKEN`** está definido, el servidor acepta ese valor **o** `API_AUTH_TOKEN` (migración y scripts legacy).
- Si solo está **`API_AUTH_TOKEN`**, solo ese valor autoriza ingest.

Recomendación producción: definir **`EMAIL_INGEST_TOKEN`** para el bridge machine (`npm run email:ingest-snapshot`, cron, repo IMAP) y reservar **`API_AUTH_TOKEN`** para operadores humanos / cockpit.

## Comandos habituales

1. **Sync IMAP y reporte** (repo hermano): `npm run panelsim:email-ready` — ver skill panelsim-email-inbox y [`EMAIL-WORKSPACE-SETUP.md`](./EMAIL-WORKSPACE-SETUP.md).
2. **Ingest a CRM** (esta repo, requiere API + keys IA + Sheets): `npm run email:ingest-snapshot` — usa `EMAIL_INGEST_TOKEN` si existe; si no, `API_AUTH_TOKEN`. Ver [`scripts/email-snapshot-ingest.mjs`](../../../scripts/email-snapshot-ingest.mjs).

Auditoría sugerida: conservar `messageId` / dedupe en `.email-ingest/processed-ids.json` (local, gitignored).

## Fase 3 (opcional, no implementada)

Paridad con WA Cockpit (`wa_operators`): tabla Postgres **`email_operators`**, magic link / JWT y CLI tipo `wa-admin` quedan **diferidas**. El modelo actual es **token de servicio + cockpit**; si en el futuro se requiere multi-usuario con trazabilidad por persona, migrar a ese esquema y documentar revocación.

## Referencias

- [`EMAIL-GPT-THUNDERBIRD-WORKFLOW.md`](./EMAIL-GPT-THUNDERBIRD-WORKFLOW.md)
- OpenAPI correo: [`docs/openapi-email-gpt.yaml`](../../openapi-email-gpt.yaml)
- [`AGENTS.md`](../../AGENTS.md) — `npm run email:ingest-snapshot`
