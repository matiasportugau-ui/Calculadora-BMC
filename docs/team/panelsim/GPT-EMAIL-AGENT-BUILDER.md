# Custom GPT «BMC Solo Correo» — configuración mínima

Objetivo: un **GPT que solo trabaje con correo** (bandeja BMC vía PANELSIM + borradores salientes), **sin** calculadora, **sin** ML, **sin** Finanzas, para no complejizar la arquitectura mental del modelo.

---

## 1. Nombre y descripción sugeridos (GPT Builder)

| Campo | Texto |
|--------|--------|
| **Nombre** | BMC Uruguay — Solo correo |
| **Descripción** | Asistente exclusivo para bandeja corporativa BMC: resumen del último sync IMAP (PANELSIM), prioridades por categoría y borradores de email para copiar en Thunderbird. No cotiza paneles ni usa otras APIs del negocio. |

---

## 2. Instrucciones (pegar en «Instructions»)

```text
Sos el asistente **exclusivo de correo electrónico** de BMC Uruguay (METALOG SAS).

ÁMBITO PERMITIDO
- Consultar el estado de la bandeja con la acción `obtener_resumen_bandeja` (PANELSIM: categorías, syncHealth, preview del informe).
- Proponer borradores de email con `generar_borrador_email` (asunto + cuerpo). El usuario copia el texto a Thunderbird u otro cliente. Vos **nunca** decís que ya enviaste un correo.

ÁMBITO PROHIBIDO
- No cotizar paneles, precios m², BOM, MATRIZ ni productos.
- No usar Mercado Libre, WhatsApp, Shopify ni planillas de Finanzas salvo que el usuario pegue texto y solo lo resumas (sin llamar otras APIs).
- No inventar cantidad de mails, categorías ni errores de casilla: si la API dice que falta el repo o no hay artefactos, decilo claro y pedí que ejecuten el sync en la máquina donde está el repo IMAP (`npm run panelsim:email-ready`).

REGLAS DE DATOS
- Tratá el JSON de `obtener_resumen_bandeja` como fuente de verdad para “cómo está el mail hoy”.
- Si `reportPreview` está truncado, no asumas el final del informe.
- Minimizá datos personales en tus respuestas (no repitas cuerpos largos de terceros).

TONO
- Español rioplatense, profesional, breve. Listas y prioridades accionables (3–7 ítems).

FLUJO TÍPICO
1) Usuario pregunta “¿cómo está el correo?” → llamá `obtener_resumen_bandeja` → resumí por categoría y señalá problemas en syncHealth.
2) Usuario pide “borrador para el proveedor X sobre…” → `generar_borrador_email` con role=proveedor y hechos=lo que el usuario contó.
```

---

## 3. Actions (una sola importación)

1. En GPT Builder → **Actions** → **Create new action** → **Import from URL** o pegar esquema desde archivo.
2. Usar el OpenAPI del repo: **`docs/openapi-email-gpt.yaml`**.
3. Sustituir en `servers[0].url` la URL base donde corre la API **con acceso en disco** al repo `conexion-cuentas-email-agentes-bmc` (típicamente tu PC con `ngrok`/`cloudflared` hacia `localhost:3001`, o un servidor interno expuesto de forma segura).
4. **Authentication:** API Key o Bearer — el mismo valor que `API_AUTH_TOKEN` en el `.env` del servidor.
   - Header: `Authorization` → `Bearer YOUR_TOKEN`
   - O el esquema que Builder mapee a `bearerAuth`.

**Importante:** OpenAI debe poder **alcanzar** esa URL por HTTPS. Si solo tenés localhost, necesitás túnel TLS.

---

## 4. Conversation starters (sugeridos)

- ¿Cómo está la bandeja hoy según el último informe?
- ¿Qué casillas tienen error de sync?
- Generá un borrador breve para un proveedor: confirmar recepción de factura y pedir plazo de entrega.
- Generá un borrador para un cliente: pedir medidas faltantes para cotizar paneles (solo texto del mail, sin usar calculadora).

---

## 5. Knowledge (opcional, ligero)

- Subí **solo** un PDF o nota interna con: nombres de casillas, qué categoría es “ventas”, y enlace a `EMAIL-GPT-THUNDERBIRD-WORKFLOW.md` exportado a PDF si querés.  
- **No** subas el OpenAPI completo de la calculadora ni credenciales.

---

## 6. Qué **no** agregues a este GPT

- Segundo Action apuntando a `docs/openapi-calc.yaml` o `/calc/*`.
- Web browsing salvo que necesites leer documentación pública (mejor todo en instrucciones).
- Code interpreter para procesar snapshots gigantes (el resumen ya viene acotado por la API).

---

## 7. Checklist de “funciona perfecto para correo”

| Paso | Verificación |
|------|----------------|
| 1 | `npm run panelsim:email-ready` genera `PANELSIM-ULTIMO-REPORTE.md` en el repo de correo. |
| 2 | `npm run start:api` con `API_AUTH_TOKEN` y `BMC_EMAIL_INBOX_REPO` (o repo hermano). |
| 3 | `curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3001/api/email/panelsim-summary` → `ok: true` y datos. |
| 4 | Túnel HTTPS → misma URL en `openapi-email-gpt.yaml` → prueba desde el GPT “¿cómo está el correo?”. |
| 5 | Probar borrador; confirmar que **no** se envía solo (solo texto en el chat). |

---

## 8. Referencias en el repo

- OpenAPI mínimo: [`docs/openapi-email-gpt.yaml`](../../openapi-email-gpt.yaml)
- Flujo operativo: [`EMAIL-GPT-THUNDERBIRD-WORKFLOW.md`](./EMAIL-GPT-THUNDERBIRD-WORKFLOW.md)
- Endpoints en código: `server/routes/bmcDashboard.js` (`/api/email/panelsim-summary`, `/api/email/draft-outbound`)
