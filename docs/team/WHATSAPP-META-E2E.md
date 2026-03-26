# WhatsApp Cloud API — checklist E2E (Meta + teléfono + Cloud Run)

**Objetivo:** que un mensaje del cliente llegue al webhook, se acumule en memoria y, tras **5 minutos sin mensajes** (o al mandar **🚀** en el texto), se ejecute `processWaConversation` → `POST /api/crm/parse-conversation` → filas en **Form responses 1** y **CRM_Operativo** (Google Sheets).

**URL base canónica del servicio (2026-03):**  
`https://panelin-calc-q74zutv7dq-uc.a.run.app`

**Webhook completo (suscribir en Meta):**  
`https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp`

**Modo “solo clics” (mapa de URLs + qué botón tocar):** [`HUMAN-GATES-ONE-BY-ONE.md`](./HUMAN-GATES-ONE-BY-ONE.md) — sección *Mapa rápido* y bloque **cm-0**.

---

## 0. Si partís de cero (no sabés qué tocar primero)

**Qué estamos haciendo (una frase):** Meta tiene que **avisarle a tu servidor en Google Cloud** cada vez que llega un WhatsApp; el servidor **lee el mensaje** y **escribe en la planilla** de CRM. Vos no programás eso: ya está en el código; falta **conectar Meta con la URL del servidor** y **poner las mismas claves** en Meta y en Cloud Run.

**Orden recomendado (no invertir):**

1. **Elegí un texto secreto** (como una contraseña) solo para Meta y el servidor — por ejemplo `BmcWaVerify2026MiClave` (cualquier string que recuerdes). Eso va a ser el **Verify token**. **Aún no lo pegues en Meta.**
2. **Google Cloud Console** → **Cloud Run** → servicio **`panelin-calc`** (o el nombre que uses) → **Editar y desplegar nueva revisión** → **Variables y secretos** → agregá o editá:
   - `WHATSAPP_VERIFY_TOKEN` = el texto secreto del paso 1.
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` = los que te da Meta (más abajo).
   - `BMC_SHEET_ID`, credenciales Google, claves IA = como ya tenés para el resto del dashboard.
   - Guardá / **Deploy**. Esperá a que termine.
3. **Meta** (developers.facebook.com o Business Suite, según cómo tengas la app):
   - Entrá a tu **app** → producto **WhatsApp** → **Configuration** (o **API Setup**).
   - **Webhook** → **Callback URL:** pegá exactamente  
     `https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp`
   - **Verify token:** el **mismo** string del paso 1 (debe coincidir **carácter por carácter** con `WHATSAPP_VERIFY_TOKEN` en Cloud Run).
   - Tocá **Verify and save** (o equivalente). Si falla: revisá que el deploy de Cloud Run terminó y que el token es idéntico.
   - En **Webhook fields**, activá al menos **`messages`** (mensajes entrantes).
4. **Copiá a Cloud Run** (si aún no están) el **Phone number ID** y el **Access token** de prueba o de producción que muestra Meta, en `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_ACCESS_TOKEN`. Volvé a **Deploy** si los cambiaste.
5. **Probá sin teléfono** el GET de la §3 (más abajo). Si devuelve `OK_META`, Meta y el servidor “hablan” el mismo idioma en el verify.
6. **Con el teléfono:** desde otro número, escribí al **número de WhatsApp Business** que está conectado a esa API (el que figura en Meta como número de prueba o producción). Esperá 5 minutos sin mandar nada más, o mandá un mensaje que incluya **🚀** para que procese al instante.
7. **Abrí la planilla** y buscá **WA-Auto** en CRM / Form.

**Si te trabás:** no hace falta entender todo; hace falta que **tres cosas coincidan**: URL del webhook, **Verify token** en Meta = **Verify token** en Cloud Run, y deploy aplicado. Los logs de Cloud Run con `[WA]` confirman que llegó el POST.

Documentación oficial Meta (inglés): [Webhooks — Getting Started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started).

---

## 1. Variables en Cloud Run (o `.env` local)

| Variable | Uso |
|----------|-----|
| `WHATSAPP_VERIFY_TOKEN` | Mismo string que pegás en Meta como **Verify Token** (GET webhook). |
| `WHATSAPP_ACCESS_TOKEN` | Token de la app de WhatsApp (Graph API). |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de la API (no el número en sí). |
| `PORT` | Lo asigna Cloud Run (no hace falta tocarlo). |
| `BMC_SHEET_ID` + `GOOGLE_APPLICATION_CREDENTIALS` | Obligatorio para escribir en Sheets. |
| Claves IA (`GROK_API_KEY`, etc.) | Para rellenar col **AF** (respuesta sugerida). |

Tras cambiar vars: **nuevo deploy** o revisión del servicio en Cloud Run.

---

## 2. Meta Developer / Business Suite

1. **WhatsApp → Configuration → Webhook**  
   - **Callback URL:** `https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp`  
   - **Verify token:** el mismo valor que `WHATSAPP_VERIFY_TOKEN` en el servicio.

2. Suscribir el campo **`messages`** (y lo que pida tu flujo; mínimo mensajes entrantes).

3. **Phone number ID** y **Access token** copiados a las env vars anteriores.

---

## 3. Verificación GET (sin teléfono)

Sustituí `TU_TOKEN` por `WHATSAPP_VERIFY_TOKEN`:

```bash
curl -sS "https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=OK_META"
```

**Esperado:** cuerpo de respuesta exactamente `OK_META` y HTTP **200**. Si ves **403**, el token no coincide con Cloud Run.

---

## 4. Prueba con el teléfono (cliente → tu número API)

1. Desde un **WhatsApp de cliente**, escribí al número conectado a la API (el de la app `chatbo2` / Phone Number ID configurado).

2. **Disparo automático:** enviá un mensaje de prueba (ej. cotización techo 5×4). **No envíes otro mensaje durante 5 minutos.** El servidor agrupa y, por inactividad, llama a `parse-conversation` y escribe en Sheets.

3. **Disparo inmediato (opcional):** si el mensaje del cliente incluye el emoji **🚀**, se procesa en el acto (sin esperar 5 min).

4. Abrí la planilla **2.0 Administrador**: pestañas **Form responses 1** y **CRM_Operativo** — debería aparecer origen **WA-Auto** y el diálogo en la columna correspondiente.

---

## 5. Si no escribe en Sheets

- Revisá **Logs** de Cloud Run: líneas `[WA]` y errores de Google.
- Confirmá que la **service account** tiene la planilla compartida como **Editor**.
- Confirmá que el último código (incl. columnas **AH–AK** si aplica) está **desplegado**.

---

## 6. Tarea de programa maestro

Al verificar fila nueva en CRM con **WA-Auto**, marcá **`cm-0`** como `done` en `docs/team/orientation/programs/bmc-panelin-master.json` y actualizá `updatedAt`.
