# GO-LIVE — Runbook de items manuales (2026-05-13)

**Para qué:** cerrar las filas ☐ de [`GO-LIVE-DASHBOARD-CHECKLIST.md`](./GO-LIVE-DASHBOARD-CHECKLIST.md) que requieren interacción humana (clicks en Google Sheets, Apps Script editor, UI del dashboard). Cada sección es independiente; ejecutalas en el orden listado para evitar dependencias rotas.

**Quien ejecuta:** Matias (cuenta Google con permisos de edición en los 5 workbooks BMC).

**Cómo reportar progreso:** marcar el checkbox `[ ]` de cada sección a medida que la completás y avisar — yo flipeo la fila correspondiente en `GO-LIVE-DASHBOARD-CHECKLIST.md` en un commit `docs(go-live): tick X.Y`.

**Alternativa automatizada:** [`docs/ATLAS-BROWSER-PROMPT-GO-LIVE.md`](../ATLAS-BROWSER-PROMPT-GO-LIVE.md) tiene un prompt para Atlas Browser que cubre 1.4 + 3.x. Si lo querés usar, pegalo en Atlas (agent mode) y saltá las secciones 1.4 / 3.x de este runbook. Para 6.x igual hay que ojear el dashboard a ojo.

---

## Sección 1.4 — Compartir workbook con la service account

- [ ] **Hecho** — avisame para que tilde la fila 1.4 en el checklist.

**Qué:** dar permiso de Editor a la service account `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` en los workbooks que el dashboard lee/escribe.

**Por qué:** sin permiso de Editor, el server tira 503 `sheets_unavailable` al intentar `GET /api/cotizaciones`, `POST /api/marcar-entregado`, etc.

**Workbooks que necesitan share:**

| Workbook (nombre humano) | Workbook ID | Rol mínimo |
|---|---|---|
| BMC crm_automatizado | `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` | **Editor** |
| Pagos Pendientes 2026 | `1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI` | **Editor** |
| 2.0 - Ventas | `1IMZr_qEyVi8eIlNc_Nk64eY63LHUlAue` | **Editor** |
| Stock E-Commerce | (ver `docs/google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md` §4) | **Editor** |
| Calendario vencimientos | (ver `docs/google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md` §5) | **Editor** |

**Pasos (por workbook):**

1. Abrí el workbook por ID: `https://docs.google.com/spreadsheets/d/<WORKBOOK_ID>/edit`
2. Click en botón verde **"Compartir"** (arriba derecha).
3. En el campo de email pegá: `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com`
4. Seleccioná rol **"Editor"** (NO "Viewer" — escribir filas requiere Editor).
5. **Desactivá** "Notificar a las personas" (la SA no tiene inbox).
6. Click **"Enviar"** (o "Compartir" — el botón cambia según UI).
7. Confirmá que la SA aparece en la lista de personas con permiso, con badge "Editor".

**Verificación final (cuando termines todos):**

```bash
npm run verify-tabs
```

Debe imprimir cada workbook + cada tab esperado con ☑. Si alguno tira 403, falta share en ese workbook.

---

## Sección 2.x — Tabs (probable ☑ ya, ejecutar verify-tabs después de 1.4)

- [ ] **Verificado** — avisame los resultados de `npm run verify-tabs` para que tilde las filas que correspondan.

**Qué:** los tabs `CRM_Operativo`, `Pagos_Pendientes`, `Metas_Ventas`, `AUDIT_LOG` deben existir en los workbooks correctos.

**Estado esperado:** el script `npm run setup-sheets-tabs` ya se corrió el 2026-03-19 (ver [`IMPLEMENTATION-PLAN-POST-GO-LIVE.md`](./IMPLEMENTATION-PLAN-POST-GO-LIVE.md) — "creadas vía `npm run setup-sheets-tabs`"). Sólo hace falta confirmar contra la realidad.

**Pasos:**

1. Después de completar 1.4 (todos los workbooks compartidos), correr en local:
   ```bash
   npm run verify-tabs
   ```
2. Mandame el output.
3. Si todos los tabs aparecen ☑ → tildo filas 2.1, 2.2, 2.3, 2.4 en el checklist.
4. Si alguno falta → corro `npm run setup-sheets-tabs` para crearlos, y luego verifico de nuevo.

---

## Sección 3.1 — Pegar Code.gs en el Apps Script del workbook crm_automatizado

- [ ] **Hecho**

**Qué:** copiar el contenido de [`docs/bmc-dashboard-modernization/Code.gs`](./Code.gs) al proyecto Apps Script del workbook **BMC crm_automatizado**.

**Pasos:**

1. Abrí `https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit`
2. Menú **Extensions → Apps Script**.
3. Si el proyecto se llama "BMC_Dashboard_Automation" (per [`AUTOMATIONS-BY-WORKBOOK.md`](../google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md) §1) ya existe — abrirlo. Si no, crear nuevo y renombrar.
4. En el archivo `Code.gs` del proyecto, **borrar** todo el contenido existente.
5. Pegar **todo el contenido** del archivo local `docs/bmc-dashboard-modernization/Code.gs` (en tu IDE: copiar archivo entero).
6. **Guardar** (Ctrl+S o icono 💾) — Apps Script pedirá nombre si es proyecto nuevo: usar **BMC_Dashboard_Automation**.

**Confirmación:** el editor muestra el código y el icono de guardado deja de pulsar.

---

## Sección 3.2 — Pegar DialogEntregas.html

- [ ] **Hecho**

**Qué:** agregar el HTML del diálogo de entregas al mismo proyecto Apps Script.

**Pasos:**

1. En el editor Apps Script abierto en 3.1, click **"+"** al lado de "Files" → **"HTML"**.
2. Nombrar el archivo **`DialogEntregas`** (sin extensión — Apps Script agrega `.html` solo).
3. Borrar el HTML por defecto.
4. Pegar todo el contenido de [`docs/bmc-dashboard-modernization/DialogEntregas.html`](./DialogEntregas.html) (archivo local).
5. **Guardar**.

**Confirmación:** el archivo aparece en la sidebar del proyecto como `DialogEntregas.html`.

---

## Sección 3.3 — Ejecutar runInitialSetup

- [ ] **Hecho**

**Qué:** correr una vez la función `runInitialSetup()` del Code.gs para crear los tabs si todavía no están y verificar que el script puede leer/escribir el workbook.

**Pasos:**

1. En el editor Apps Script, panel izquierdo → "Functions" → seleccionar **`runInitialSetup`**.
2. Click ▶ **Run**.
3. Primera vez Apps Script va a pedir autorización OAuth → aceptar con tu cuenta Google.
4. Esperar el output en el panel inferior **"Execution log"**.

**Confirmación esperada:**
- Log dice algo tipo `"Setup completo: 5/5 tabs OK"` (o similar — ver el código Code.gs para el mensaje exacto).
- Sin errores rojos.

**Si falla con "Authorization required":** repetir paso 3 (a veces el primer OAuth se cuelga).

**Si falla con "Permission denied on tab X":** el workbook no está compartido con tu propia cuenta como Editor — chequear share settings.

---

## Sección 3.4 — Configurar triggers

- [ ] **Hecho**

**Qué:** instalar los time-triggers para que las automatizaciones corran solas.

**Triggers requeridos (referencia: [`AUTOMATIONS-BY-WORKBOOK.md`](../google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md)):**

| Workbook | Función | Tipo | Schedule |
|---|---|---|---|
| BMC crm_automatizado | `sendWeeklyAlarmDigest` | Time-driven | Weekly · Monday · 9–10 AM |
| Pagos Pendientes 2026 | `alertarPagosVencidos` | Time-driven | Daily · 8–9 AM |
| Pagos Pendientes 2026 | `onEdit` | From spreadsheet | On edit |
| 2.0 - Ventas | `consolidarVentasDiario` | Time-driven | Daily · 7–8 AM |
| 2.0 - Ventas | `alertarVentasSinFacturar` | Time-driven | Weekly · Monday · 9–10 AM |
| Stock E-Commerce | `alertarBajoStock` | Time-driven | Daily · 8:30–9:30 AM |

**Pasos (repetir por cada workbook):**

1. En el editor Apps Script del workbook, panel izquierdo → icono ⏰ **Triggers**.
2. Click **"+ Add Trigger"** (abajo derecha).
3. **Choose which function to run:** seleccionar la función de la tabla arriba.
4. **Select event source:** `Time-driven` (o `From spreadsheet` para `onEdit`).
5. **Type of time-based trigger:** `Day timer` (diario) o `Week timer` (semanal) según corresponda.
6. **Time of day:** elegir el rango de la tabla (ej. `8am to 9am`).
7. **Failure notification:** dejar en "Notify me daily" (default).
8. **Save**.

**Confirmación:** el trigger aparece en la lista con la última ejecución vacía (próxima ejecución = mañana 8 AM por ejemplo).

---

## Sección 6.1 — KPIs cargan con datos reales

- [ ] **Hecho**

**Qué:** verificar que el dashboard muestra KPIs con números reales de los workbooks.

**Pasos:**

1. Abrir https://calculadora-bmc.vercel.app/finanzas
2. En la sección "Resumen financiero" verificar 4 KPI cards:
   - **Total pendiente** — número en USD/UYU (no "—" o "0,00")
   - **Esta semana**
   - **Próxima semana**
   - **Este mes**

**Confirmación:**
- Todos los KPIs muestran un número > 0 si hay pagos reales en `Pagos_Pendientes`.
- Si todos están en "—": revisar console del navegador (F12) → pestaña Network → buscar el request a `/api/kpi-financiero` → si responde 503, el workbook no está compartido con la SA (sección 1.4 incompleta).

---

## Sección 6.2 — Trend muestra vencimientos

- [ ] **Hecho**

**Qué:** verificar que el gráfico de barras "Vencimientos próximos" renderiza con fechas.

**Pasos:**

1. En el mismo dashboard, scrollear a la sección "Trend".
2. Verificar que hay barras (verticales o horizontales según diseño) con fechas en el eje X y montos en el eje Y.

**Confirmación:** hasta 8 fechas visibles, ordenadas cronológicamente.

---

## Sección 6.3 — Breakdown con filtros

- [ ] **Hecho**

**Qué:** verificar la tabla "Pagos pendientes" + sus filtros.

**Pasos:**

1. Sección "Pagos pendientes (Breakdown)".
2. Verificar que la tabla muestra columnas **Cliente | Pedido | Monto | Vencimiento | Estado**.
3. Click filtro **"Esta semana"** → la tabla se reduce a vencimientos de los próximos 7 días.
4. Click filtro **"Vencidos"** → muestra sólo filas con fecha de vencimiento anterior a hoy.
5. Click filtro **"Todos"** → vuelve a mostrar todo.

**Confirmación:** los 3 filtros funcionan; la tabla se actualiza al click sin recargar la página.

---

## Sección 6.4 — Entregas listadas

- [ ] **Hecho**

**Qué:** verificar que la sección "Entregas y logística" muestra próximas entregas.

**Pasos:**

1. Scrollear a sección **#operaciones** o "Entregas y logística".
2. Verificar lista con entregas de la semana.

**Confirmación:** al menos 1 entrega visible (si hay entregas programadas), o mensaje "No hay entregas pendientes esta semana" si genuinamente está vacío.

---

## Sección 6.5 — Copiar WhatsApp funciona

- [ ] **Hecho**

**Qué:** verificar que los botones de WhatsApp generan el mensaje correcto.

**Pasos:**

1. En la sección Entregas → click **"Copiar WhatsApp"** (botón global) o **"WhatsApp"** (por fila).
2. Pegar (Ctrl+V) en cualquier campo de texto.

**Confirmación:** el texto pegado contiene cliente, dirección, pedido, fecha. Si pegás texto vacío o el botón no responde, hay un bug — reportarlo.

---

## Sección 6.6 — Marcar entregado actualiza sheet

- [ ] **Hecho**

**Qué:** verificar que clickear "Marcar entregado" persiste el cambio en Google Sheets.

**Pasos:**

1. En la sección Entregas, identificá una entrega de prueba (ideal: una vieja ya entregada, o creá una temporal en CRM_Operativo).
2. Click **"Marcar entregado"** en esa fila.
3. (Opcional) escribí comentarios en el dialog y click OK.
4. Abrir el workbook en otra pestaña → tab `CRM_Operativo` → ubicar la fila → verificar que la columna `Estado` cambió a "Entregado" (o equivalente) y la fecha de entrega quedó hoy.
5. Verificar también el tab `AUDIT_LOG` → debería tener una fila nueva con `action=mark_delivered`.

**Confirmación:** Estado actualizado + fila en AUDIT_LOG presente.

---

## Sección 6.7 — Toast visible tras acciones

- [ ] **Hecho**

**Qué:** verificar el feedback visual de las acciones del dashboard.

**Pasos:**

1. Después de cada acción que ejecutaste en 6.5 / 6.6, mirar la esquina inferior (o superior, según diseño) — debería aparecer un toast verde con mensaje tipo **"Marcado como entregado"** o **"Copiado al portapapeles"**.
2. Si una acción falla (forzar un error desconectando wifi rápido), el toast debería ser rojo con mensaje de error.

**Confirmación:** toast verde visible al menos 2 s después de cada acción exitosa.

---

## Cuando terminés todo

Avisame con un resumen tipo:
> "Terminé runbook 1.4 / 2.x / 3.1-3.4 / 6.1-6.7. Verify-tabs OK. Solo 6.5 no pude probar (no había entregas)."

Y yo:
1. Tildo cada fila correspondiente en `GO-LIVE-DASHBOARD-CHECKLIST.md`.
2. Hago commit `docs(go-live): tick remaining manual rows after Matias runbook execution`.
3. PROJECT-STATE entry final.
4. Push.

---

**Referencias:** [`GO-LIVE-DASHBOARD-CHECKLIST.md`](./GO-LIVE-DASHBOARD-CHECKLIST.md) · [`AUTOMATIONS-BY-WORKBOOK.md`](../google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md) · [`Code.gs`](./Code.gs) · [`DialogEntregas.html`](./DialogEntregas.html) · [`ATLAS-BROWSER-PROMPT-GO-LIVE.md`](../ATLAS-BROWSER-PROMPT-GO-LIVE.md)
