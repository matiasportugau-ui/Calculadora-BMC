# Cambio en el chat Panelin — Confirmaciones explícitas (2026-05-06)

> **TL;DR:** El chat Panelin (calculadora-bmc.vercel.app) ahora **necesita que vos lo digas con tus propias palabras** para guardar en CRM, mandar por WhatsApp al cliente, cancelar cotizaciones o programar recordatorios. La IA ya no puede "deducir" tu intención — el servidor lee directamente lo que escribís. Si la IA dice "esperá que confirmes", repetí la acción con una frase imperativa clara.

---

## ¿Qué cambió?

Antes el modelo seteaba un flag interno (`user_confirmed: true`) para autorizar cada acción que tocaba sistemas (CRM, WhatsApp, cancelaciones, recordatorios). Si el modelo se "convencía" solo de que vos querías la acción, la ejecutaba. Esto era un riesgo real: una alucinación o un prompt ambiguo podía traducirse en una fila accidental en CRM o un WhatsApp enviado al cliente equivocado.

Desde hoy el servidor **clasifica server-side la intención del último mensaje del usuario** con un patrón de frases. Si esa clasificación no incluye la acción que la IA quiere ejecutar, la tool se **rechaza** y la IA recibe un mensaje pidiendo confirmación explícita.

## ¿Qué frases cuentan?

Lista no exhaustiva — el clasificador hace match case-insensitive y tolera acentos:

| Acción | Frases que la activan |
|---|---|
| **Guardar en CRM** | "guardalo en CRM", "pegalo al CRM", "metelo al CRM", "agregalo a la planilla", "anotalo en el CRM" |
| **Mandar por WhatsApp al cliente** | "mandale por WhatsApp", "mandale por WA", "envialo al cliente", "mandale el link" |
| **Cancelar cotización** | "cancelá la cotización X", "borrá la cotización", "el cliente declinó", "dejar sin efecto", "dar de baja" |
| **Programar seguimiento** | "recordame en 3 días", "agendá seguimiento", "avisame cuando expire", "ponele recordatorio" |
| **Sincronizar Wolfboard** | "sincronizá Wolfboard", "propagá las respuestas", "sync wolfboard" |
| **Editar fila Admin Wolfboard** | "actualizá la fila X", "editá la respuesta", "cambiá el estado" |
| **Marcar enviado en Wolfboard** | "marcá como enviada", "ya la envié", "movela a enviados" |
| **Generar respuestas IA en batch (Wolfboard)** | "generá las respuestas con IA", "cotizá todas las pendientes", "batch quoting" |

**Negaciones se respetan** — si decís "no lo guardes en CRM" o "no quiero mandarlo por WA", el clasificador suprime la intención correspondiente. Combinaciones como **"no canceles, mandale por WA"** funcionan: la negación del primer verbo no afecta a la segunda acción.

## Ejemplos del flujo nuevo

### Caso 1 — frase imperativa clara → todo funciona como antes

```
Operador:  cotizame 200 m² techo ISODEC EPS 80mm para Juan Pérez
Panelin:   [hace el cálculo] Total USD 12.480 c/IVA. ¿Generamos PDF?
Operador:  dale, generá el PDF
Panelin:   [genera PDF, devuelve link GCS]
Operador:  guardalo en CRM
Panelin:   [✓ guardar_en_crm ejecuta] Listo, fila 47 en CRM_Operativo.
```

### Caso 2 — frase ambigua → la IA pide confirmación

```
Operador:  ¿podrías guardarlo en el CRM?
Panelin:   Antes de guardarlo necesito que me confirmes con una frase imperativa
           clara — algo como "guardalo en CRM" o "agregalo a la planilla". ¿Lo
           guardo?
Operador:  dale, guardalo
Panelin:   [✓ guardar_en_crm ejecuta]
```

### Caso 3 — acción combinada en una sola frase

```
Operador:  guardalo en CRM y mandale por WhatsApp al 099123456
Panelin:   [✓ guardar_en_crm ejecuta] [✓ enviar_whatsapp_link ejecuta]
           Guardado en fila 48 + WhatsApp enviado al 099123456.
```

### Caso 4 — negación parcial

```
Operador:  no canceles la cotización todavía, pero mandale por WA al cliente
Panelin:   [✗ cancelar_cotizacion bloqueado por negación]
           [✓ enviar_whatsapp_link ejecuta]
           OK, no la cancelo. Mandé el link al cliente por WhatsApp.
```

## Si la IA rechaza algo que vos sí querés hacer

1. **Re-leé tu mensaje** — ¿usaste una frase interrogativa ("¿podrías…?") en lugar de imperativa ("dale, hacelo")?
2. **Probá una frase de la tabla de arriba** — son las que el clasificador conoce.
3. **Si sigue rechazando**, el patrón puede no estar cubierto. Reportalo por el canal interno (slack/issue) con la frase exacta que usaste — ampliar el clasificador es un cambio de una línea en [`server/lib/userIntentClassifier.js`](../../server/lib/userIntentClassifier.js).

## Acceso para operadores administradores (modo desarrollador)

Si necesitás que la IA ejecute lecturas sensibles (`listar_cotizaciones_recientes`, `obtener_cotizacion_por_id`, `obtener_pdf_html`, `buscar_cliente_crm`, `historial_cliente`) sin pasar por el clasificador de intención, **activá el modo desarrollador**:

1. En el chat, presioná `Ctrl+Shift+D` (o `Cmd+Shift+D` en Mac).
2. Pegá el `API_AUTH_TOKEN` cuando lo pida.
3. El chat queda autenticado y la IA puede ejecutar tools sensibles directamente. El clasificador de intención sigue activo pero el modo dev pre-aprueba los reads.

## Fundamento técnico (para quien quiera el detalle)

- Clasificador: [`server/lib/userIntentClassifier.js`](../../server/lib/userIntentClassifier.js) (regex per-tool, normalización Unicode, manejo de negación con stop en conjunción/puntuación).
- Gate del chat: [`server/routes/agentChat.js`](../../server/routes/agentChat.js) — función `shouldBlockToolForUnauthenticatedChat(name, devMode)` chequea cada tool antes de ejecutarla.
- Auth en rutas HTTP del registry: [`server/routes/calc.js`](../../server/routes/calc.js) — `requireAuth` middleware en `GET /calc/cotizaciones`, `GET /calc/cotizaciones/:id`, `POST /calc/cotizaciones/:id/cancelar`.
- Sanitizador CSV-injection en escrituras Sheets: [`server/lib/crmAppend.js`](../../server/lib/crmAppend.js) — prefija `'` en valores que arrancan con `=`/`+`/`-`/`@`/tab/CR antes del `valueInputOption: USER_ENTERED`.

## Histórico

Cambio desplegado el **2026-05-06** vía PRs #110 + #144 + #147. Verificación de producción en [`PROJECT-STATE.md`](./PROJECT-STATE.md) sección "2026-05-06 (Deploy …)".
