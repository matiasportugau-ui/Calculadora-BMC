# Correo BMC — GPT, PANELSIM y Thunderbird (mismo IMAP)

**Estado:** fase 1 implementada en API (resumen PANELSIM + borrador saliente sin envío). **Fase 2** (control IMAP/SMTP desde GPT) queda explícitamente fuera hasta definición de seguridad y colas.

---

## 1. Principio

- Thunderbird y el repo `conexion-cuentas-email-agentes-bmc` usan **las mismas cuentas IMAP** que ya confirmó el equipo (ventas / administración / etc.).
- La **fuente de verdad** del contenido es el servidor de correo; PANELSIM hace **sync + clasificación** y escribe artefactos en disco.
- GPT (Cursor, Custom GPT con Actions, u otro cliente) consume **resúmenes** vía API; **no** reemplaza Thunderbird para enviar en esta fase.

---

## 2. Flujo operativo diario

1. **Refrescar bandeja** (misma data que verá Thunderbird):

   ```bash
   npm run panelsim:email-ready
   ```

2. **Arrancar API** (local o Cloud Run con acceso al disco del repo IMAP — en producción típicamente solo la máquina que tiene el repo montado; ver §5).

3. **Obtener resumen para el asistente** (requiere `API_AUTH_TOKEN` en el servidor y header `Authorization: Bearer <token>`):

   ```http
   GET /api/email/panelsim-summary?reportMaxChars=24000
   ```

   Respuesta incluye `status` (JSON PANELSIM si existe), `reportPreview` (Markdown truncable) y `workflow` con comandos sugeridos.

4. **Cotizaciones / ventas → CRM** (sin enviar mail):

   ```bash
   npm run email:ingest-snapshot -- --dry-run --limit 5
   ```

   Luego ingest real cuando el operador confirme (gate **cm-2** en [`HUMAN-GATES-ONE-BY-ONE.md`](../HUMAN-GATES-ONE-BY-ONE.md)).

5. **Borrador para proveedor o cliente** (solo texto; copiar a Thunderbird):

   ```http
   POST /api/email/draft-outbound
   Content-Type: application/json
   Authorization: Bearer <API_AUTH_TOKEN>

   {
     "role": "proveedor",
     "hechos": "Recibimos factura F-123 por X. Pedimos confirmar plazo de entrega.",
     "tono": "breve",
     "asunto_contexto": "Re: Factura F-123"
   }
   ```

   Respuesta: `{ "ok": true, "asunto", "cuerpo", "provider" }`. **No envía** correo.

---

## 3. Variables de entorno

| Variable | Uso |
|----------|-----|
| `BMC_EMAIL_INBOX_REPO` | Ruta absoluta al repo `conexion-cuentas-email-agentes-bmc` (opcional si el repo es carpeta hermana de Calculadora-BMC). |
| `API_AUTH_TOKEN` | Misma auth que CRM cockpit; obligatoria para `/api/email/*` nuevos. |
| `BMC_EMAIL_SNAPSHOT_PATH` | Override del snapshot para `email:ingest-snapshot` (opcional). |

---

## 4. Módulos de negocio (ventas, proveedores, DGI, BPS)

La **taxonomía** vive en el repo de correo (`config/classification.json` y reglas). El informe Markdown refleja categorías; GPT debe **priorizar** según ese texto, no inventar conteos.

Roadmap recomendado: añadir categorías explícitas `fiscal_dgi`, `bps`, `proveedores_factura`, `proveedores_logistica` en el repo IMAP y regenerar reportes.

---

## 5. Cloud Run vs local

- En **Cloud Run** el contenedor **no** incluye por defecto el repo hermano de correo. Para usar `GET /api/email/panelsim-summary` en la nube hace falta volumen montado, artifact sincronizado, o proxy interno; hasta entonces usar **API local** tras `panelsim:email-ready` o pegar el reporte en el chat.
- **Local:** con repo en disco y `.env` con `BMC_EMAIL_INBOX_REPO`, el endpoint refleja el último sync.

---

## 6. Fase 2 (pendiente de diseño)

- Acciones GPT sobre **IMAP APPEND** (borradores en servidor), **SMTP** con cola, o integración Thunderbird vía complemento — todas requieren **auditoría, rate limits y aprobación humana**.
- No activar envío automático sin política escrita y prueba en staging.

---

## 7. Referencias

- Skill Cursor: `.cursor/skills/panelsim-email-inbox/SKILL.md`
- Ingest CRM: `npm run email:ingest-snapshot`, `server/lib/emailSnapshotIngest.js`
- Endpoints CRM correo: `POST /api/crm/parse-email`, `POST /api/crm/ingest-email`
- Manifiesto agente: `GET /capabilities`, `docs/api/AGENT-CAPABILITIES.json` (regenerar con `npm run capabilities:snapshot` si aplica)
