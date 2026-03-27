# Run 55 — checklist operador (WhatsApp / ML / correo)

**Contexto:** Bloque **run 55** en [`PROMPT-FOR-EQUIPO-COMPLETO.md`](./PROMPT-FOR-EQUIPO-COMPLETO.md). Gates humanos paso a paso: [`HUMAN-GATES-ONE-BY-ONE.md`](./HUMAN-GATES-ONE-BY-ONE.md) (**cm-0**, **cm-1**, **cm-2**).

---

## 1. WhatsApp Cloud API (cm-0)

- Verificar webhook y suscripción `messages` en Meta Developers.
- Probar mensaje de teléfono → logs Cloud Run `POST /webhooks/whatsapp` → fila en CRM_Operativo (evidencia en planilla).
- Guía: [`WHATSAPP-META-E2E.md`](./WHATSAPP-META-E2E.md).

## 2. Token WA permanente

- Sustituir token de corta duración por token de sistema / flujo documentado en Meta y variable `WHATSAPP_ACCESS_TOKEN` en Cloud Run (sin pegar secretos en el repo).

## 3. Cloud Run — `min-instances` (opcional)

- Si el auto-trigger por inactividad no dispara por cold start, evaluar `gcloud run services update panelin-calc --region=us-central1 --min-instances=1` (costo vs disponibilidad).

## 4. Mercado Libre OAuth + GCS (cm-1)

- Navegador: `/auth/ml/start` en prod según [`docs/ML-OAUTH-SETUP.md`](../ML-OAUTH-SETUP.md).
- Verificar: `npm run ml:verify` contra API local o `GET /auth/ml/status` en prod cuando corresponda.
- Bucket tokens: IAM para la service account que usa el runtime (ver entradas **GCS — ML tokens** en [`PROJECT-STATE.md`](./PROJECT-STATE.md)).

## 5. Bridge correo → CRM (cm-2)

- **CLI en repo:** `npm run email:ingest-snapshot` → [`scripts/email-snapshot-ingest.mjs`](../../scripts/email-snapshot-ingest.mjs). Requiere snapshot en repo IMAP hermano (`BMC_EMAIL_SNAPSHOT_PATH` o ruta por defecto) y API con auth/Sheets según endpoint.
- Primera ingesta real: **dry-run** (`--dry-run`), luego `--limit 1` con revisión humana en CRM antes de masa.

## 6. Evidencia automática ya vigente en prod

- `npm run smoke:prod` (health, capabilities, MATRIZ CSV, suggest-response).
- Tabla actualizada: [`E2E-VALIDATION-CHECKLIST.md`](./E2E-VALIDATION-CHECKLIST.md) (sección 2026-03-27).

---

Al cerrar ítems humanos, actualizar [`PROJECT-STATE.md`](./PROJECT-STATE.md) **Cambios recientes** y el bloque run 55 en **PROMPT-FOR-EQUIPO-COMPLETO.md**.
