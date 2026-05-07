# Wolfboard `/quote-batch` — Análisis y propuesta de arquitectura

**Estado:** Propuesta para discusión · sin implementar
**Autor:** Claude (sesión 2026-05-06) · revisar con `bmc-orchestrator` antes de elegir tier
**Alcance:** `POST /api/wolfboard/quote-batch` (server/routes/wolfboard.js:645) y su superficie UI (BmcAdminCotizacionesModule.jsx)

---

## 1. Flujo actual (resumen)

```
[UI Admin Cotizaciones]
  ↓ POST /api/wolfboard/quote-batch  body={force,syncToCrm,createCrmRows,syncQuoteLink}
[server/routes/wolfboard.js:645]
  ├─ read Admin sheet A2:M (FORMATTED_VALUE)
  ├─ filter: rows con respuesta vacía OR (force && respuesta.startsWith("⚠"))
  ├─ if pending == 0 → early return
  ├─ load CRM A4:AK (best-effort match cache)
  ├─ FOR EACH row (sequential):
  │    ├─ Anthropic Haiku #1 → param-extract JSON
  │    ├─ runBatchCalc() → BOM/totales (sólo si extracción ok)
  │    │    └─ on success: format text response, marca calcQuoted=true
  │    ├─ Anthropic Haiku #2 (fallback) → texto libre si no calcQuoted
  │    ├─ uploadQuoteToGcs() + uploadQuoteToDrive() (Promise.allSettled)
  │    ├─ uploadQuoteJsonToGcs(replaySnapshot)
  │    ├─ findCrmRowForWolfboard() / appendQuoteToCrm() (best-effort)
  │    └─ acumular {valueUpdates, formatRequests, crmUpdates}
  ├─ batchUpdate Admin Sheet (J=respuesta, K=link, M=replayUrl)
  ├─ batchUpdate Admin formato (rojo si error)
  └─ batchUpdate CRM Sheet (AF=respuesta, AH=link)
```

**Ejecución hoy (2026-05-06):** 223 filas en sheet, todas con `respuesta` no vacía, `force=false` → `processed:0, skipped:223` en 3s. Pipeline funcional pero sin tráfico de prueba.

---

## 2. Riesgos por categoría

| # | Riesgo | Dónde duele hoy | Probabilidad de que duela mañana |
|---|--------|-----------------|----------------------------------|
| 1 | **Timeout HTTP** — Cloud Run corta a 60min; con N rows × ~3s/row (2 calls Anthropic + GCS + Drive + Sheets) crítico arriba de ~1000 rows | No (0 pending) | Media — depende de cuán seguido se backlog |
| 2 | **Observabilidad por fila** — éxito/falla/método/modelo/coste sólo deja huella en col J + console logs efímeros del server | Sí — debug de `⚠` exige inspeccionar logs Cloud Run en vivo | Alta |
| 3 | **Re-entrancia** — dos operadores click "Ejecutar batch IA" en simultáneo procesan la misma fila dos veces | Real — sin lock | Media |
| 4 | **Recuperación parcial** — si Anthropic 503 en row 47/100, el resto sigue, pero no hay reintento automático: requiere `force:true` rerun manual | Real — y `force:true` reprocesa **todos** los `⚠`, no sólo los rotos esta corrida | Alta |
| 5 | **Modelo único / sin fallback** — `claude-haiku-4-5` hardcoded; ante outage Anthropic, todo el batch rompe | No (Haiku estable) | Baja-Media |
| 6 | **Sprawl de estado** — verdad parcial en Admin sheet (col J/K/M), parcial en CRM_Operativo (AF/AH), parcial en GCS (HTML), parcial en Drive | Real — reconciliación entre 4 superficies | Crónico |
| 7 | **`Promise.allSettled` silencioso** — fallo de GCS o Drive no se ve; quoteLink puede quedar `""` y nadie se entera | Real | Media |
| 8 | **No idempotencia formal** — `correlationId` se genera pero no se usa como dedupe key; un re-run con `force:true` reescribe toda la fila | Real | Media |

**Lo que NO es problema (todavía):**
- Latencia del happy path (3s con 0 pending; ~3-5s/row cuando sí hay).
- Costo Anthropic — Haiku ≈ USD 0.004/row, irrelevante hasta volúmenes 10k+.
- `generatePrintHTML` server-side — verificado: no toca DOM (`window.open` está en otra función del mismo archivo).

---

## 3. Constraints y no-objetivos

**Constraints duros:**
- **Backend = Cloud Run** (no Vercel Functions). AI Gateway, Workflow DevKit, Vercel Queues no aplican.
- **Sheets es superficie UX, no sólo storage.** Operadoras editan filas a mano en Admin. Cualquier propuesta que mueva la "verdad" exclusivamente a Postgres rompe el workflow.
- **Sin nuevas dependencias innecesarias.** El proyecto ya tiene `pg`, patrón worker maduro (`transportistaOutboxWorker`, `waEnricherWorker`), SSE en `agentChat.js`. Reusar antes de instalar.
- **Idempotencia debe respetar `correlationId` existente** (formato `WBK-<uuid>` o cliente externo).

**No-objetivos de esta propuesta:**
- Reemplazar Sheets como source of truth.
- Agregar fallback multi-provider AI (puede entrar como capa horizontal después; orthogonal).
- Migrar `/sync`, `/row`, `/enviados`, `/export`, `/pendientes` (esos están bien — son CRUD sincrónico).
- Resolver el "best-effort GCS+Drive silencioso" — se trata por separado en §6.

---

## 4. Patrones existentes para reusar (sin inventar)

El proyecto ya tiene tres piezas que cubren 90% de lo que la propuesta necesita:

### 4.1 `transportistaOutboxWorker` (server/lib/transportistaOutboxWorker.js)
- `setInterval` + `BEGIN tx + SELECT … FOR UPDATE SKIP LOCKED LIMIT N`
- SAVEPOINT por fila → error de una no rompe el batch
- Backoff exponencial con jitter, `max_retries = 12` → estado `failed`
- Idempotencia vía `(trip_id, idempotency_key)` UNIQUE
- AbortController para SIGTERM coordinado

### 4.2 `agentChat.js` SSE (server/routes/agentChat.js:533)
- `text/event-stream`, `X-Accel-Buffering: no` (Cloud Run/nginx safe)
- Heartbeat cada 15s para mantener conexión
- Cliente: `EventSource` sigue progreso

### 4.3 `quoteStore.js` + `waDb.js` (server/lib/)
- Pool PG vía `getWaPool(config.databaseUrl)`
- Allowlist de URLs confiables (storage.googleapis.com, drive.google.com, *.run.app)
- Test-only pool injection

---

## 5. Propuesta tier-1 → tier-3 (incremental, condicional)

> Cada tier resuelve riesgos específicos y se decide independientemente. **No avanzar a tier N+1 sin evidencia desde tier N de que el problema persiste.**

### Tier 1 — Audit + lock (1-2 días, sin schema PG nuevo)

**Resuelve:** #2 observabilidad · #3 re-entrancia · parcial #6 sprawl

**Cambios:**
1. **Audit log a `AUDIT_LOG` sheet** (ya existe — `config.bmcAuditTab`). Por cada row procesada en `/quote-batch`, append fila:
   ```
   timestamp | batch_id | admin_row | corr_id | status | method | model | latency_ms | error | quote_link
   ```
   - `batch_id` = uuid generado al inicio del POST.
   - Append en bulk al final (1 sola escritura, no por-fila).
2. **Advisory lock vía Postgres** — al entrar al handler:
   ```js
   await pool.query("SELECT pg_try_advisory_lock(hashtext('wolfboard_quote_batch'))");
   ```
   - Si lock no se adquiere: `409 Conflict` con `{ ok:false, error:"batch_in_progress" }`.
   - Liberar en `finally`.
   - Si no hay pool PG disponible (env sin `DATABASE_URL`), fallback a lock por archivo en `/tmp` o saltar el guard con warning.
3. **Telemetría inline** — agregar `model: HAIKU_MODEL`, `latency_ms`, `attempt: 1` al `results[]` que ya retorna el endpoint. Cliente ya consume `data.successful/failed/skipped`; agregar visibilidad sin romper contrato.

**No cambia:** topología sincrónica HTTP, Sheets como verdad principal, modelo único.

**Coste:** ~150 LOC nuevas, sin migration. Reusa `appendBmcAuditLog()` si existe (chequear `lib/`).

### Tier 2 — Streaming progress (1 semana, +SSE)

**Resuelve:** #1 timeouts percibidos · #4 visibilidad de fallo a tiempo · UX

**Cambios:**
1. **Nuevo endpoint paralelo `POST /api/wolfboard/quote-batch/stream`** que clona el handler pero responde `text/event-stream`:
   ```
   event: started   data: { batch_id, total }
   event: row       data: { row_num, status, method, latency_ms, quote_link? }
   event: done      data: { successful, failed, skipped }
   ```
2. **Heartbeat 15s** (patrón `agentChat.js:551`).
3. **UI:** `runBatch()` usa `EventSource` cuando hay >50 pending, `fetch()` POST normal cuando hay <50. Switch automático según `/pendientes` count.
4. **`/quote-batch` legacy queda como wrapper sincrónico** que internamente consume SSE y agrega — preserva compatibilidad para clientes externos.

**No cambia:** ejecución sigue siendo "sincrónica" desde el punto de vista del cliente (un click → un stream que dura X minutos), pero el cliente ve progreso row-by-row.

**Coste:** ~250 LOC + cambios UI. No requiere PG si Tier 1 ya está con audit a Sheets.

### Tier 3 — Cola persistente (2-3 semanas, +schema PG)

**Resuelve:** #1 timeouts duros · #4 retry automático · #5 fallback futuro · #8 idempotencia formal

**Cambios:**
1. **Migración PG** — clonar shape de `outbox_notifications`:
   ```sql
   create table wb_quote_jobs (
     job_id        uuid primary key default gen_random_uuid(),
     batch_id      uuid not null,
     admin_row     int not null,
     correlation_id text not null,
     status        text not null check (status in ('pending','running','succeeded','failed')),
     attempt_count int not null default 0,
     next_attempt_at timestamptz not null default now(),
     consulta_hash text not null,             -- sha256 de col I (idempotencia)
     payload       jsonb not null,            -- {force, syncToCrm, …}
     result        jsonb,                     -- {response, method, model, quote_link, crm_row}
     last_error    jsonb,
     created_at    timestamptz not null default now(),
     started_at    timestamptz,
     finished_at   timestamptz,
     unique (batch_id, admin_row),
     unique (consulta_hash, status) deferrable initially deferred  -- prevenir dup en pending
   );
   create index on wb_quote_jobs (status, next_attempt_at) where status = 'pending';
   create index on wb_quote_jobs (batch_id);
   ```
2. **Producer endpoint `POST /quote-batch/enqueue`** — reemplaza el handler sincrónico:
   - Lee Admin sheet, filtra pending, INSERT bulk a `wb_quote_jobs` con `batch_id`.
   - Retorna `{ batch_id, total_enqueued }` en <500ms.
   - Idempotente por `(consulta_hash, status='pending')`.
3. **Consumer `wolfboardQuoteWorker.js`** — clonar `transportistaOutboxWorker.js`:
   - Loop `setInterval` (intervalo 5s, batch 5 jobs).
   - `BEGIN + SELECT … FOR UPDATE SKIP LOCKED LIMIT 5`.
   - Por job: SAVEPOINT, ejecutar pipeline existente (extract + calc + format + GCS + CRM), UPDATE status.
   - Backoff exponencial en fallo, max 5 attempts (Anthropic raramente justifica más).
   - Sheets writes batched al final del batch (no por-job).
4. **Endpoint de status `GET /quote-batch/:batch_id`** — devuelve agregado para UI.
5. **UI poll cada 3s o SSE sobre `wb_quote_jobs` cambios** — botón "Ejecutar" se vuelve "En cola: 47 pending, 3 running, 12 done".
6. **`POST /quote-batch` legacy** mantenido como facade sincrónico que enqueue + espera con timeout 30s, fallback a 202 con `batch_id`.

**Trade-off:** introduce scheduler interno (worker corriendo siempre); ya hay 5 workers similares en producción, no es novedad operativa.

**Coste:** ~600-800 LOC + migración + start hook en `server/index.js`.

---

## 6. Decisiones ortogonales (no parte del tier)

Estas pueden hacerse en cualquier momento y no dependen del camino elegido:

- **GCS+Drive `Promise.allSettled` silencioso** → cambiar a logging estructurado de fallos en `last_error` del job (Tier 3) o columna `K_warning` del Admin sheet (Tier 1).
- **Anthropic SDK directo** → abstraer a `lib/aiCompletion.js` (ya existe el wrapper). Habilita futura Tier-1.5: rotar a Sonnet en outage. **No es Vercel AI Gateway** — sólo refactor interno.
- **`generatePrintHTML` server-side** → safe hoy, pero importar todo `helpers.js` arrastra `~100KB` de utilidades cliente. Considerar extraer la rama PDF a `server/lib/pdfHtml.js` para minimizar superficie del bundle.

---

## 7. Recomendación

**Empezar por Tier 1.** Bajo esfuerzo, alto ROI en observabilidad. Después de 2-4 semanas con audit log corriendo:

- Si los logs muestran <10 fallos/mes y batches <100 rows → quedarse en Tier 1, no avanzar.
- Si hay racks frecuentes de `⚠` o batches que duran >5 minutos → ir a Tier 2.
- Si hay batches >500 rows o necesidad de auditar costos AI por cliente / por mes → ir a Tier 3.

**No saltar al Tier 3 sin evidencia desde Tier 1.** El patrón completo (PG + worker + SSE + cola) es atractivo arquitectónicamente pero hoy nadie está sufriendo timeouts ni reintentos manuales en escala.

---

## 8. Preguntas abiertas para validar

1. ¿Cuántas veces por semana se corre `/quote-batch` hoy y cuál es el N típico de pending?
2. ¿Hay operadoras editando col J a mano post-IA, o el flujo es 100% IA → aprobar?
3. ¿El requisito "Sheets como UX" es absoluto, o aceptable que el operador vea filas "en cola" sin poder editarlas hasta que termine el job?
4. ¿`force:true` se usa? ¿Con qué frecuencia las filas terminan en `⚠` y necesitan re-run?
5. ¿Hay límite de cuota Anthropic en la cuenta actual? (rate limit definiría batchSize del worker en Tier 3)

Sin esos datos, Tier 1 es la apuesta segura porque entrega justamente la telemetría para responderlos.
