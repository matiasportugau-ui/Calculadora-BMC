# CRM_Operativo — Cockpit operador (arquitectura AG–AK)

**Propósito:** Una sola grilla para **ver → aprobar → enviar**: mismas columnas para Mercado Libre, WhatsApp, email y futuros canales. **Cabeceras en fila 3**, datos desde **fila 4**.

**Código:** `server/lib/crmOperativoLayout.js` — defaults al crear filas; ML sync (`server/ml-crm-sync.js`), WhatsApp (`server/index.js` → `processWaConversation`), email (`POST /api/crm/ingest-email`).

---

## 1. Mapa de columnas (letras)

| Col | Nombre sugerido (fila 3) | Uso |
|-----|--------------------------|-----|
| B | Fecha | Entrada / creación |
| C | Cliente | |
| … | *(columnas existentes del CRM)* | Ver mapper dashboard / planilla |
| AF | Respuesta sugerida | Texto listo para revisar o enviar |
| **AG** | **Provider IA** | Modelo que generó AF (ej. `grok`) — WA; ML sync deja vacío si no aplica |
| **AH** | **Link presupuesto** | URL (PDF, calculadora, Drive). Clicable en Sheets |
| **AI** | **Aprobado enviar** | `Sí` \| `No` — gate antes de envío automático (futuro) |
| **AJ** | **Enviado el** | Vacío hasta que exista envío automático; luego ISO o fecha/hora |
| **AK** | **Bloquear auto** | `Sí` \| `No` — si `Sí`, scripts no modifican la fila |

**Defaults al crear fila nueva (código):** AG vacío, AH vacío, AI=`No`, AJ vacío, AK=`No` (salvo WA que solo escribe **AH–AK** tras **AF:AG** con los mismos defaults en AH–AK).

---

## 2. Flujo de interacción (operador)

1. Filtrar **Estado** (col. J) = `Pendiente` o `Pendiente revisión precio`.
2. Leer **Consulta** (G) y **Observaciones** (W).
3. Abrir **Link presupuesto** (AH) si existe.
4. Editar **Respuesta sugerida** (AF) si hace falta.
5. Poner **Aprobado enviar** (AI) = `Sí` y llamar **`POST /api/crm/cockpit/send-approved`** (con `API_AUTH_TOKEN`) o enviar a mano.

---

## 3. Qué escribe cada pipeline

| Origen | Rango escrito | Notas |
|--------|----------------|-------|
| **ML sync** (`syncUnansweredQuestions`) | `B:AK` | Incluye `defaultTailAGAK_ML()` (AG–AK) |
| **WhatsApp** (`processWaConversation`) | `B:K`, `R:T`, `V:W`, `AF:AG` (si IA OK), siempre **`AH:AK`** | |
| **Email** (`ingest-email`) | `B:K`, `R:T`, `V:W`, **`AG:AK`** | AF no lo rellena este endpoint aún |

---

## 4. API HTTP (cockpit) — `API_AUTH_TOKEN`

Todas las rutas bajo **`/api/crm/cockpit/*`** requieren **`API_AUTH_TOKEN`** (o `API_KEY`) en el entorno del servidor. Enviar:

- Header **`Authorization: Bearer <token>`**, o  
- Header **`X-API-Key: <token>`**

Si el token no está configurado, las mutaciones devuelven **503**.

| Método | Ruta | Body (JSON) | Efecto |
|--------|------|-------------|--------|
| GET | `/api/crm/cockpit/row/:rowNum` | — | Devuelve la fila parseada (A→AK). `rowNum` ≥ 4. |
| POST | `/api/crm/cockpit/quote-link` | `{ "row": 12, "url": "https://..." }` | Escribe **AH** (link presupuesto). |
| POST | `/api/crm/cockpit/approval` | `{ "row": 12, "approved": true }` | Escribe **AI** (`Sí` / `No`). |
| POST | `/api/crm/cockpit/mark-sent` | `{ "row": 12, "sentAt": "2026-03-24T12:00:00.000Z" }` | Escribe **AJ** (opcional `sentAt`, default ahora ISO). |
| POST | `/api/crm/cockpit/send-approved` | `{ "row": 12 }` | Si **AI** = Sí, **AJ** vacío, **AK** ≠ Sí, y **F/W** indican ML con `Q:id` en W o WA: envía respuesta (ML API o WhatsApp Cloud) y rellena **AJ**. |

**send-approved — reglas:** Texto enviado = **AF** (o **G** si AF vacío). **ML:** `Q:<id>` en observaciones (W) y OAuth ML válido en el servidor. **WhatsApp:** **F** debe sugerir WA y **D** = teléfono; requiere `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`. Llamada ML interna usa `PUBLIC_BASE_URL` o `http://127.0.0.1:PORT` en local.

---

## 5. Pendientes / mejoras

1. **Planilla:** Títulos en **fila 3** para **AG–AK** si aún no están.
2. **Contrato:** Opcional — incluir cockpit en `scripts/validate-api-contracts.js` con token de prueba.
3. **Generación de cotización:** Automatizar rellenado de **AH** desde `/calc` o Drive (además del POST manual `quote-link`).

---

## 6. Referencias

- [`CRM-COCKPIT-AUTONOMOUS-RUNBOOK.md`](./CRM-COCKPIT-AUTONOMOUS-RUNBOOK.md) — plan recorrible (AUTO vs HUMAN), fases y comandos para agentes sin intervención hasta el gate explícito.
- [`PANELSIM-FULL-PROJECT-KB.md`](./PANELSIM-FULL-PROJECT-KB.md) — superficie HTTP y CRM.
- [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md) — reglas de respuesta ML.
- `docs/google-sheets-module/` — inventario de planillas si hace falta alinear nombres.
