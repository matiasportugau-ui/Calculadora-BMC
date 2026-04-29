# cm-1 (MercadoLibre OAuth full-cycle) — Verification Checklist

> **Acción humana.** Esta verificación NO se puede automatizar — confirma que una respuesta nuestra llega y aparece visiblemente en MercadoLibre.

**Cuándo:** después de cualquier cambio en OAuth ML, ML routes (`server/routes/bmcDashboard.js` `/ml/*`), o token persistence (`gs://bmc-ml-tokens`). También de control mensual.

**Pre-requisitos:**
- Acceso a la cuenta ML de BMC.
- Bearer interno (`$API_AUTH_TOKEN`) con permisos de cockpit.
- API en Cloud Run respondiendo. Verificar:
  ```bash
  curl -s "https://panelin-calc-<PROJECT>.us-central1.run.app/health" | jq
  ```

---

## Paso 1 — Confirmar que hay tokens válidos

```bash
curl -s "https://panelin-calc-<PROJECT>.us-central1.run.app/auth/ml/status" | jq
```

**Esperado (token válido, 200):**
```json
{ "ok": true, "userId": "...", "scope": "...", "updatedAt": "...", "expiresAt": "..." }
```

**Si devuelve 404 con `"No token stored yet"`:** completar el flujo OAuth abriendo `/auth/ml/start` en el navegador antes de continuar.
**Si devuelve 503 con `"Token store unavailable"`:** el bucket `gs://bmc-ml-tokens` no es accesible desde Cloud Run — revisar credenciales de la service account.

---

## Paso 2 — Listar preguntas pendientes

```bash
npm run ml:pending-workup
```

El script imprime las preguntas sin responder con: `item_id`, `question_id`, `from`, `text`, link a la publicación.

**Si la lista está vacía:** hacer una pregunta de prueba a una de tus propias publicaciones desde otra cuenta ML, o pedirle a un colaborador. Sin pregunta real no hay verificación posible.

Anotar el `question_id` y `item_id` que vas a usar como caso de prueba.

---

## Paso 3 — Pre-llenar la fila CRM correspondiente

`POST /api/crm/cockpit/send-approved` no recibe el texto ni el `question_id` directamente — los **lee de la fila de `CRM_Operativo`**. Antes de publicar, asegurar que la fila tenga:

| Columna | Campo | Valor requerido |
|---------|-------|-----------------|
| F (`origen`) | Origen | `ML` |
| L (`observaciones`) | Observaciones | debe contener `Q:<question_id>` |
| AF (`respuestaSugerida`) | Respuesta sugerida | texto final, en español rioplatense, cierre `Saludos, BMC URUGUAY!` |
| AE (`aprobadoEnviar`) | Aprobado enviar | `Sí` |
| AD (`bloquearAuto`) | Bloquear auto | vacío o `No` |
| AG (`enviadoEl`) | Enviado el | **debe estar vacío** (si tiene timestamp, el envío está bloqueado) |

> Si la fila no existe (pregunta nueva), el ingest automático debería crearla. Si no aparece tras 1 minuto, verificar `/ml/questions/search` o forzar refresh desde el cockpit.

**Precio:** tomar de MATRIZ (no inventar). Tolerancia vs MATRIZ = 0.

Anotar el **número de fila** que vas a publicar.

---

## Paso 4 — Publicar vía API

```bash
curl -s -X POST \
  -H "Authorization: Bearer $API_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://panelin-calc-<PROJECT>.us-central1.run.app/api/crm/cockpit/send-approved" \
  -d '{ "row": <NUM_FILA> }' | jq
```

**Éxito (200):**
```json
{ "ok": true, "channel": "ml", "questionId": "...", "sentAt": "ISO8601", "ml": { /* respuesta cruda de ML */ } }
```

**Errores comunes:**

| Status | Body / motivo | Acción |
|--------|---------------|--------|
| 400 `Invalid row` | Row inválido o demasiado bajo | Revisar número de fila |
| 400 `Bloquear auto is Sí — row locked` | AD = Sí | Vaciar AD o poner `No` |
| 400 `Aprobado enviar must be Sí` | AE no es `Sí` | Marcar AE = Sí |
| 400 `Already marked sent (Enviado el)` | AG ya tiene timestamp | Limpiar AG si es prueba |
| 400 `No text (AF/G empty)` | AF y G vacíos | Llenar AF con la respuesta |
| 401 (middleware) | Bearer inválido | Verificar `API_AUTH_TOKEN` |
| 502 `ML answer failed` | ML rechazó | Inspeccionar `details` del body |

---

## Paso 5 — Confirmar visualmente en MercadoLibre

1. Abrir el link de la publicación (`https://articulo.mercadolibre.com.uy/MLU...`).
2. Bajar a la sección **"Preguntas y respuestas"**.
3. Ver tu respuesta publicada con timestamp reciente (≤ 1 minuto desde el POST).
4. Tomar **captura de pantalla** mostrando pregunta + respuesta + fecha.

**Si la respuesta no aparece tras 2 minutos:** revisar logs Cloud Run filtrando por `questionId`, y consultar `/ml/questions/<id>` directamente para ver si quedó en `answered`.

---

## Paso 6 — Registrar verificación

Editar `docs/team/PROJECT-STATE.md`:

- Marcar cm-1 como `✅ DONE — verificado YYYY-MM-DD por <nombre>`.
- Adjuntar (o linkear) la captura de pantalla del Paso 5 en `docs/team/panelsim/cm-1-evidencia-YYYY-MM-DD.png`.
- Si hubo cambios desde la última verificación (deploy ML route, secrets sync, OAuth re-flow), mencionarlo en el commit message.

Commit:
```
docs(cm-1): verificación full-cycle ML — YYYY-MM-DD
```

---

## Falla → Triaje rápido

| Síntoma | Probable causa | Próximo paso |
|---------|----------------|--------------|
| `/auth/ml/status` 404 | No hay token persistido | Re-correr OAuth desde `/auth/ml/start` |
| `/auth/ml/status` 503 | Token store inaccesible | Permisos de bucket `gs://bmc-ml-tokens` |
| 401 desde send-approved | `API_AUTH_TOKEN` mal sincronizado | Ver `CLOUD-RUN-SECRETS-SYNC.md` |
| 502 `ML answer failed` | ML rechazó (token expirado, scope, payload inválido) | Re-autorizar app ML, revisar `details` |
| Respuesta no aparece en ML | Eventual consistency (raro) | Esperar 5 min + verificar `/ml/questions/<id>` |

## Referencias

- `server/routes/bmcDashboard.js:2810` — `handleCrmCockpitSendApproved` (lee `body.row`, valida flags AE/AD/AG, llama internamente `POST /ml/questions/<qid>/answer`)
- `server/index.js:240` — `/auth/ml/status`
- `server/index.js:201` — `/auth/ml/start` (entrada OAuth)
- `scripts/ml-pending-workup.mjs` — script de pendientes (`npm run ml:pending-workup`)
- `docs/team/ROADMAP.md` §4 — contexto del gate
- `docs/team/PROJECT-STATE.md` — estado de gates cm-0 / cm-1 / cm-2
