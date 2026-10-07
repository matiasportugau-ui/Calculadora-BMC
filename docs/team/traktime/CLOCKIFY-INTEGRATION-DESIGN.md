# Clockify ↔ TraKtiMe — Diseño de integración

> **Estado:** propuesta para revisión (no implementado).
> **Decisión tomada (16/06/2026):** **Integrar Clockify vía API** — Clockify es el
> motor de captura de tiempo (el equipo ya lo usa); BMC consume sus datos por API
> y aporta la capa de negocio (jornada/gaps, PDF BMC, CRM, facturación).
> **Fuentes verificadas:** docs.clockify.me (API REST + Reports API + webhooks).

---

## 1. Objetivo y no-objetivos

**Objetivo:** que **todos los logs de tiempo de los operarios** (capturados en las
apps de Clockify: desktop/mobile/web) aparezcan dentro de BMC `/hub/traktime`,
espejados en nuestro Postgres, para reaplicar nuestra lógica de jornada/gaps,
generar el PDF mensual con marca BMC, cruzar con CRM y facturar.

**No-objetivos:**
- ❌ Reverse-engineering del binario de Clockify (ilegal/ToS; innecesario — la API es pública).
- ❌ Reemplazar la captura: Clockify sigue siendo donde el operario arranca/para el timer.
- ❌ Escribir tiempo *hacia* Clockify en Fase 1 (lectura primero; escritura es opcional y posterior).

---

## 2. Arquitectura

```
OPERARIOS ── Clockify Desktop/Mobile/Web ──▶ CLOCKIFY CLOUD (workspace BMC)
                                                  │            │
                              webhooks (realtime) │            │ Reports API (pull, admin key)
                                                  ▼            ▼   = TODOS los usuarios
                                   ┌──────────────────────────────────────┐
                                   │  BMC API (Cloud Run)                  │
                                   │  • POST /webhooks/clockify  (realtime)│
                                   │  • clockifySyncWorker (reconcile poll)│
                                   │  • clockifyClient (wrapper API)       │
                                   │            │ upsert idempotente       │
                                   │            ▼                          │
                                   │   Postgres traktime_* (espejo)        │
                                   └────────────┬─────────────────────────┘
                                                ▼
                                   BMC FRONTEND /hub/traktime
                                   • Horas por operario  • Jornada+gaps+pausa
                                   • PDF mensual BMC      • Cruce CRM/cotización  • Facturación
```

**Principio clave:** el **DB de BMC es la fuente de verdad para lectura/negocio**;
Clockify es la fuente de verdad para captura. El sync mantiene el espejo. Si
Clockify cae, los datos históricos y los reportes BMC siguen funcionando.

---

## 3. Modelo de datos — mapeo a tablas existentes

Reusamos `traktime-package/migrations/` (clients, projects, tasks, entries, tags,
invoices). Solo agregamos **identidad externa** + **estado de sync**.

| Entidad Clockify | Tabla BMC existente | Mapeo |
|---|---|---|
| `workspace` | (tenant único BMC) | `CLOCKIFY_WORKSPACE_ID` en config |
| `user` | operario | match por email; tabla `traktime_users`/`project_members` (confirmar en `000_init`) |
| `client` | `clients` | match por nombre o `external_id` |
| `project` / `task` | `projects` / `tasks` | `external_id` |
| `time entry` | `entries` | `external_id` (clave de idempotencia) |
| gap entre entries | (derivado) | **nuestra lógica de pausa/coordinación, umbral 30 min** |

### Migración nueva `011_clockify_link.sql` (propuesta)
```sql
-- Identidad externa idempotente en cada tabla espejable
ALTER TABLE entries   ADD COLUMN external_source text, ADD COLUMN external_id text;
ALTER TABLE projects  ADD COLUMN external_source text, ADD COLUMN external_id text;
ALTER TABLE clients   ADD COLUMN external_source text, ADD COLUMN external_id text;
-- (usuarios: agregar external_id donde viva la identidad de operario)

CREATE UNIQUE INDEX ux_entries_external  ON entries (external_source, external_id)
  WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX ux_projects_external ON projects (external_source, external_id)
  WHERE external_id IS NOT NULL;

-- Estado/watermark del sync (un row por recurso)
CREATE TABLE clockify_sync_state (
  resource     text PRIMARY KEY,        -- 'entries' | 'projects' | 'users' | ...
  cursor_ts    timestamptz,             -- watermark de última reconciliación
  last_run_at  timestamptz,
  last_status  text,                    -- 'ok' | 'error'
  last_error   text
);
```
> `external_source = 'clockify'`. La unicidad `(source,id)` hace que el upsert sea
> idempotente: webhooks y poll pueden pisar el mismo entry sin duplicar.

---

## 4. Estrategia de sincronización (doble vía)

**A) Reconciliación por poll (base, robusta).**
`clockifySyncWorker` corre cada N min (ej. 5): pide el **detailed report** de la
ventana `[watermark − solape, ahora]` y hace upsert por `external_id`. El solape
(ej. 48 h) atrapa ediciones tardías. Garantiza consistencia aunque se pierda un
webhook.

**B) Webhooks (realtime, encima del poll).**
Registramos `NEW_TIME_ENTRY`, `TIME_ENTRY_UPDATED`, `TIME_ENTRY_DELETED` →
`POST /webhooks/clockify`. Verificamos **firma** del webhook (HMAC) antes de
procesar — mismo patrón que `/webhooks/whatsapp`/`shopify`. Actualiza el entry al
instante; el poll es la red de seguridad.

**Idempotencia:** todo entra por `upsert ON CONFLICT (external_source, external_id)`.

---

## 5. Contrato de API (nuevos endpoints BMC)

Los reads salen **del espejo Postgres** (no de Clockify en vivo) → respetan la
semántica del proyecto (`503` solo si DB caída; `200 + []` si no hay datos).

| Método | Ruta | Qué devuelve |
|---|---|---|
| `GET` | `/api/traktime/operators` | horas por operario (rango día/semana/mes) |
| `GET` | `/api/traktime/operators/:userId/day-report` | jornada + gaps + pausas de un operario |
| `GET` | `/api/traktime/month-report` | (ya existe) ahora alimentado por el espejo |
| `POST`| `/api/traktime/admin/clockify-sync-now` | dispara reconciliación manual (admin) |
| `POST`| `/webhooks/clockify` | ingestión realtime (firma verificada) |

---

## 6. Config / secretos (en `server/config.js`, nunca hardcode)

| Var `.env` | Uso |
|---|---|
| `CLOCKIFY_API_KEY` | key **admin/owner** del workspace (ve a todos los usuarios) |
| `CLOCKIFY_WORKSPACE_ID` | workspace BMC |
| `CLOCKIFY_WEBHOOK_SECRET` | verificación de firma de webhooks |
| `CLOCKIFY_BASE_URL` | `https://api.clockify.me/api/v1` (default) |
| `CLOCKIFY_REPORTS_URL` | `https://reports.api.clockify.me/v1` (default) |

Auth a la API: header `X-Api-Key`. Detalle de endpoints en §10.

---

## 7. Capa de negocio (lo nuestro, intacto)

Se reaplica **sobre el espejo**, sin depender de Clockify:
- **Jornada / gaps / pausa (umbral 30 min):** sobre `entries` espejadas.
- **PDF mensual BMC:** mismo pipeline (`/api/traktime/month-report` → Playwright/Chromium).
- **Facturación:** `billable → invoice` con el esquema `invoices`/`invoice_lines` existente.
- **CRM:** cruce `clients` Clockify ↔ CRM BMC.

---

## 8. Fases

1. **Fase 1 — Lectura (días):** `clockifyClient` + `clockifySyncWorker` (poll) +
   migración 011 + `GET /api/traktime/operators` + tab UI "Operarios (Clockify)".
   *DoD: ver horas reales de todos los operarios en `/hub/traktime`.*
2. **Fase 2 — Realtime:** registrar webhooks + `/webhooks/clockify` con firma.
3. **Fase 3 — Negocio:** gaps/pausa + PDF mensual + facturación sobre el espejo.
4. **(Opcional) Fase 4 — Escritura bidireccional:** crear/editar entries en Clockify desde BMC.

---

## 9. Riesgos / caveats

- **Scope de la key:** debe ser **admin/owner** para ver a todos (una key personal solo ve lo propio).
- **Plan de Clockify:** webhooks free = **3** (alcanza para new/update/delete entry). Más eventos → Basic+.
- **Rate limit:** ~50 req/s — sobra para poll + webhooks.
- **Dependencia de tercero:** Clockify pasa a ser crítico para la captura; mitigado porque el espejo conserva el histórico en BMC.
- **Match de identidad:** usuarios/clientes se linkean por email/nombre la primera vez; definir resolución de duplicados.
- **Borrados:** `TIME_ENTRY_DELETED` debe propagar soft-delete en el espejo (no perder el audit).

---

## 10. Endpoints de Clockify referenciados

> Verificar paths exactos contra docs.clockify.me al implementar (esta sección es de diseño).

- **Auth:** header `X-Api-Key: <admin key>`.
- **Todos los usuarios (clave):** `POST {reports}/workspaces/{wsId}/reports/detailed` — detailed report, todas las entries de todos los operarios, filtrable por fecha/proyecto/usuario.
- **Timers activos ahora:** `GET {base}/workspaces/{wsId}/timeEntries/in-progress`.
- **Por usuario:** `GET {base}/workspaces/{wsId}/user/{userId}/time-entries`.
- **Usuarios:** `GET {base}/workspaces/{wsId}/users`.
- **Proyectos:** `GET {base}/workspaces/{wsId}/projects`.
- **Webhooks:** `POST {base}/workspaces/{wsId}/webhooks` (eventos `NEW_TIME_ENTRY`, `TIME_ENTRY_UPDATED`, `TIME_ENTRY_DELETED`, …).

---

## 11. Decisiones abiertas para Matías

1. **Reconciliación:** ¿cada cuánto poll? (sugerido: 5 min + solape 48 h).
2. **Webhooks ya o después:** ¿arrancamos solo con poll (Fase 1) y agregamos realtime en Fase 2, o querés realtime desde el día 1?
3. **Match de operarios:** ¿linkeamos por **email** de Clockify ↔ usuario BMC? (recomendado).
4. **Escritura bidireccional:** ¿alguna vez vas a querer editar tiempo desde BMC, o Clockify es siempre el único punto de captura? (define si vale Fase 4).
5. **Históricos:** ¿importamos todo el historial existente en Clockify, o desde una fecha de corte?
