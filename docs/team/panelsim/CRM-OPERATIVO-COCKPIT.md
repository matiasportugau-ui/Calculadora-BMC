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
| **AL** | **Tipo contacto** | Convención Panelin: `cliente` \| `proveedor` \| `lead` \| `interno` \| `otro` (minúsculas en escritura API) |
| **AM** | **Tags taxonomía** | Lista separada por comas (ej. `obra, urgente, materia-prima`) |
| **AN** | **Notas taxonomía** | Texto libre — contexto de clasificación para operador / agente |

**Defaults al crear fila nueva (código):** AG vacío, AH vacío, AI=`No`, AJ vacío, AK=`No` (salvo WA que solo escribe **AH–AK** tras **AF:AG** con los mismos defaults en AH–AK). **AL–AN** no las rellenan los pipelines ML/WA/email por defecto; el operador, el viewer de clasificación o el agente pueden escribirlas vía `POST /api/crm/cockpit/taxonomy-row`.

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
| **Email** (`ingest-email`) | `B:W` (un solo write) + **`AG:AK`** | AF no lo rellena este endpoint aún |
| **Cotización** (`appendQuoteToCrm`) | append `B:AK` | Fila nueva; col A (correlation_id) en update aparte |

> **Contrato key-based (anti column-shift).** Los writers de leads anclan cada
> valor por **nombre de cabecera** (fila 3) vía `server/lib/crmRowMapper.js`
> (`buildCrmRow`/`validateCrmRow`), nunca por posición de array. Un campo vacío
> (ej. `telefono`) queda `""` en su columna y **no desplaza** las columnas
> siguientes. Si la estructura no valida (faltan cabeceras, fila más ancha que la
> hoja), el ingest de email **no escribe** y enruta el lead a "Pendiente" para
> revisión manual.

---

## 4. API HTTP (cockpit) — auth dual (S5 Phase B)

Rutas bajo **`/api/crm/cockpit/*`** aceptan **una** de:

1. **JWT de identidad** con grant `canales:read` (GET) o `canales:write` (POST) — flujo hub tras login.
2. **`API_AUTH_TOKEN`** / **`API_KEY`** estático — CI, scripts, MCP, Custom GPT.

Enviar **`Authorization: Bearer <jwt-o-token>`** o **`X-API-Key: <token>`**. Sin credencial válida → **401**; sin `API_AUTH_TOKEN` en servidor y sin JWT → mutaciones pueden devolver **503**.

`GET /api/crm/cockpit-token` fue **eliminado** (PR3); el hub no debe fetchear el token desde el browser.

| Método | Ruta | Body (JSON) | Efecto |
|--------|------|-------------|--------|
| GET | `/api/crm/cockpit/row/:rowNum` | — | Devuelve la fila parseada (A→AK). `rowNum` ≥ 4. |
| GET | `/api/crm/cockpit/ml-queue` | Query opcional: `?estado=` (substring en columna Estado) | Lista filas **CRM_Operativo** (aprox. filas 4–500) con `Q:<id>` en **W** y origen ML; cada ítem: `{ row, parsed, questionId }`. |
| POST | `/api/crm/cockpit/sync-ml` | `{}` | Ejecuta `syncUnansweredQuestions` (ML → planilla). Requiere tokens ML en el servidor y `BMC_SHEET_ID`. Respuesta: `{ ok, synced }`. |
| POST | `/api/crm/cockpit/quote-link` | `{ "row": 12, "url": "https://..." }` | Escribe **AH** (link presupuesto). |
| POST | `/api/crm/cockpit/approval` | `{ "row": 12, "approved": true }` | Escribe **AI** (`Sí` / `No`). |
| POST | `/api/crm/cockpit/mark-sent` | `{ "row": 12, "sentAt": "2026-03-24T12:00:00.000Z" }` | Escribe **AJ** (opcional `sentAt`, default ahora ISO). |
| POST | `/api/crm/cockpit/send-approved` | `{ "row": 12 }` | Si **AI** = Sí, **AJ** vacío, **AK** ≠ Sí, y **F/W** indican ML con `Q:id` en W o WA: envía respuesta (ML API o WhatsApp Cloud) y rellena **AJ**. |
| POST | `/api/crm/cockpit/taxonomy-row` | `{ "row": 12, "tipoContacto": "proveedor", "tags": "ladrillos, obra", "notas": "…" }` | Actualiza solo los campos enviados en **AL–AN** (`tipoContacto` ∈ cliente/proveedor/lead/interno/otro). |

**send-approved — reglas:** Texto enviado = **AF** (o **G** si AF vacío). **ML:** `Q:<id>` en observaciones (W) y OAuth ML válido en el servidor. **WhatsApp:** **F** debe sugerir WA y **D** = teléfono; requiere `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`. Llamada ML interna usa `PUBLIC_BASE_URL` o `http://127.0.0.1:PORT` en local.

**UI (Calculadora Vite):** ruta **`/hub/ml`** (Wolfboard) — cola, copiar AF, aprobar y enviar con JWT de identidad (`BmcAuthProvider`); override dev: `bmc_cockpit_token` en `localStorage`.

---

## 5. Pendientes / mejoras

1. **Planilla:** Títulos en **fila 3** para **AG–AK** si aún no están; añadir **AL–AN** con los nombres sugeridos arriba para taxonomía.
2. **Contrato:** `GET /api/crm/cockpit/ml-queue` está incluido en `scripts/validate-api-contracts.js` cuando `API_AUTH_TOKEN` está definido y el servidor responde 200.
3. **Generación de cotización:** Automatizar rellenado de **AH** desde `/calc` o Drive (además del POST manual `quote-link`).

---

## 6. Referencias

- [`CRM-COCKPIT-AUTONOMOUS-RUNBOOK.md`](./CRM-COCKPIT-AUTONOMOUS-RUNBOOK.md) — plan recorrible (AUTO vs HUMAN), fases y comandos para agentes sin intervención hasta el gate explícito.
- [`PANELSIM-FULL-PROJECT-KB.md`](./PANELSIM-FULL-PROJECT-KB.md) — superficie HTTP y CRM.
- [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md) — reglas de respuesta ML.
- `docs/google-sheets-module/` — inventario de planillas si hace falta alinear nombres.
