# MVP 1 Pantalla — Panel de Clientes 360

**Fecha:** 2026-05-08
**Owner:** Matias Portugau
**Estado:** Propuesta — pendiente aprobación
**Branch:** `claude/add-clientes-360-Pvfuc`

> Documento PM. Acota el alcance del v2 brief de 6 semanas a un demo de 5 días. Si el demo funciona en producción 30 días y mueve las dos métricas de abajo, ampliamos. Si no, cerramos el proyecto.

---

## 1. Por qué este doc existe

El brief v2 (`FEATURE-BRIEF-v2.md`) describe Panel de Clientes 360 completo: 11 agentes, 11 tablas, 9 cards de dashboard, 3 vistas por rol, 6 semanas. Eso es demasiado para validar la hipótesis "vamos a rescatar leads tibios con un panel".

Este doc define el experimento mínimo que prueba o refuta esa hipótesis. Todo lo que no esté acá **no se construye** hasta que el experimento apruebe.

---

## 2. La hipótesis que probamos

> *Si Sandra puede ver una tabla con todos los clientes ordenados por "tiempo desde último contacto", y marcar como "contactado" los que sí abordó, entonces vamos a rescatar al menos 3 cotizaciones por mes que hoy se pierden por falta de follow-up.*

Si esta hipótesis es **falsa**, no necesitamos scoring, ni NBA, ni rankings, ni 11 agentes. Necesitamos otra cosa o nada.

---

## 3. El usuario único

**Sandra.** Admin / contabilidad. Ya recibe pagos, ya entra a `bmcuruguay.com.uy`, no es técnica.

Por qué Sandra y no Matias o Ramiro:
- Matias ya tiene el contexto en la cabeza — el panel le agrega menos.
- Ramiro está en obra, mobile-first, escenario distinto. Phase 2.
- Sandra ve los pagos pendientes pero no tiene contexto comercial. Es la que más rinde por panel agregado.

---

## 4. La pantalla

URL: `/hub/clientes`

```
┌─────────────────────────────────────────────────────────────────────┐
│  Panel de Clientes — 47 clientes con interacción en últimos 6 meses │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Filtro: [ todos ▾ ] [ sin contacto >30d ▾ ]   Buscar: [_______]   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Cliente        │ Último contacto │ Último presup. │ Acción   │ │
│  ├────────────────┼─────────────────┼────────────────┼──────────┤ │
│  │ Pedro Pérez    │ hace 47 días ⚠ │ USD 12.400 ✗  │ [Marcar] │ │
│  │ Metalog SA     │ hace 12 días    │ USD 38.200 ⏳ │ [Marcar] │ │
│  │ Juan García    │ hace 3 días     │ —              │ [Marcar] │ │
│  │ ...                                                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Columnas (4):**
1. Cliente — nombre + click abre WhatsApp con el teléfono normalizado.
2. Último contacto — días relativos. Rojo si > 30, amarillo 7-30, verde < 7.
3. Último presupuesto — monto y estado: `✓` won, `✗` lost, `⏳` pending, `—` ninguno.
4. Acción — botón "Marcar contactado" inserta `customer_followups (status='done', completed_at=now())`.

**Filtros (2):**
- Estado: todos / sin contacto >30d / con presupuesto pendiente.
- Buscar: nombre o teléfono normalizado.

**Eso es todo.** No hay ficha individual, no hay timeline, no hay scoring, no hay rankings, no hay vistas por rol. **Una pantalla.**

---

## 5. Datos

**Fuente única de Phase MVP:** seed de `clientes.customers` + `clientes.customer_events` desde tablas existentes:

```sql
-- Pseudocódigo del seed (un script Node, una vez al instalar):
-- 1. Por cada user en identity.users con quotes, crear customer.
-- 2. Por cada chat_id en wa.conversations con > 1 mensaje, resolver/crear customer.
-- 3. Por cada cotización en identity.quotes, insertar event (channel='calculadora', event_type='quote').
-- 4. Por cada mensaje en wa.messages, insertar event (channel='wa', event_type='message')
--    [solo última semana — no historial completo].
-- 5. customers.last_contact_at = MAX(occurred_at) WHERE channel != 'calculadora'.
```

**No hay agentes ETL en MVP.** Es un seed manual una vez. La data se actualiza cuando re-corremos el script. **Eso alcanza para validar.**

---

## 6. Endpoints (mínimos)

| Verbo | Path | Auth | Body | Response |
|---|---|---|---|---|
| `GET` | `/api/clientes/customers?filter=&search=` | `requireGrant.read('clientes')` | — | `{items: Customer[], total: number}` |
| `POST` | `/api/clientes/followups` | `requireGrant.write('clientes')` | `{customer_id, reason}` | `{id, status: 'done'}` |

**No más.** Sin `/scoring`, sin `/events`, sin `/automation`, sin `/nba`, sin `/customers/:id`.

`Customer` shape:
```ts
{
  id: string;
  display_name: string;
  primary_phone_e164: string | null;
  last_contact_at: string | null;
  last_quote: { total: number; status: string; created_at: string } | null;
  days_since_contact: number | null;
}
```

---

## 7. Métrica que valida o refuta

**Métrica primaria (negocio):**
> Cotizaciones cerradas en mes N+1 que tuvieron al menos 1 click en "Marcar contactado" desde el panel en mes N.

Target: **≥ 3 cotizaciones / mes** atribuidas al panel.

**Métrica secundaria (uso):**
> % de clientes con `days_since_contact > 30` que recibieron al menos 1 click en "Marcar contactado" en una semana.

Target: **≥ 60% en semanas 2-4 post-deploy.**

**Cómo se mide:** `clientes.customer_followups` queda como audit log. Cada lunes, una query de 5 líneas dice si las métricas se mueven.

---

## 8. Definición de Done

El MVP está **DONE** cuando:

- [x] PR #188 mergeado o cerrado (no queda WIP huérfano)
- [ ] Migration aplicada al Postgres (Supabase branch primero, luego prod)
- [ ] Seed script corre y crea ≥ 30 customers reales con eventos
- [ ] `GET /api/clientes/customers` responde JSON válido en < 500ms
- [ ] `/clientes` carga en producción con react-query, sin errores de consola
- [ ] Sandra tiene `clientes.write` grant en `identity.role_grants`
- [ ] Sandra abre `/clientes` y marca al menos 3 clientes como contactados (= recibió onboarding de 5 min)
- [ ] Métricas instrumentadas (query semanal documentada en `MVP-METRICS.md`)

---

## 9. Kill Switch

A los **30 días** post-deploy del MVP:

| Estado | Acción |
|---|---|
| Métrica primaria ≥ 3 cotizaciones rescatadas | Aprobar Phase 2 (scoring, ficha individual, agentes ETL) |
| Métrica primaria entre 1-2 | Iterar UX antes de aprobar Phase 2; otros 30 días |
| Métrica primaria 0 + secundaria < 30% | **Cerrar el proyecto.** Eliminar las tablas `clientes.*`. La hipótesis era falsa. |
| Sandra no usa el panel (< 1 sesión / semana) | Antes de cerrar: 1 entrevista de 15 min para entender por qué. Después decidir. |

---

## 10. Lo que explícitamente NO se hace en MVP

| ❌ Fuera de alcance MVP | Por qué |
|---|---|
| Scoring de 5/8 factores | No probó valor todavía |
| Rankings (7 obligatorios + 10 evaluables) | Ídem |
| Ficha individual con timeline 3-columnas | Una tabla alcanza para validar |
| 11 agentes Cloud Run Jobs | Seed manual alcanza |
| `agent-resolver` en runtime (el código YA existe en repo, solo se usa en el seed) | Sin sync continuo, no necesita correr cada 5 min |
| NBA con Claude API | Caro y no probado |
| 9 cards de dashboard | Una tabla alcanza |
| Vistas por rol (admin/operator/field) | Sandra es la única usuaria |
| 4 bloqueantes de seguridad (HMAC ML, HMAC WA, etc.) | Phase 2 según v2 brief; MVP no expone webhooks |
| Martin / Ramiro como usuarios | Phase 2 — entrar al panel sin entrevistar su workflow corrompe la métrica del experimento (N=1 controlado vs N=2 ambiguo) |
| Migración `followUpStore.json` → Postgres | Legacy sigue funcionando, no la rompas |
| Sync con Sheets / ML / Shopify | Phase 2; MVP usa solo Postgres existente |
| Email digest diario | Phase 3 |
| `customer_field_provenance` con reglas de precedencia | Cuando haya dos fuentes que conflictúen, no antes |
| `automation_rules` engine + DSL | Phase 2 |

---

## 11. Plan de 5 días

| Día | Entregable | Responsable |
|---|---|---|
| 1 | Mergear o cerrar PR #188. Aplicar migration en Supabase branch. Confirmar 1 email real (Sandra). | Matias decide; yo ejecuto |
| 2 | Seed script (`scripts/seed-clientes-from-existing.mjs`) corre local + crea ≥ 30 customers desde `identity.quotes` + `wa.messages`. PR. | Yo |
| 3 | Endpoints `GET /customers` + `POST /followups` con tests. PR. | Yo |
| 4 | `src/modules/clientes/TablaClientesMVP.jsx` + ruta `/clientes`. Instalar `@tanstack/react-query`. PR. | Yo |
| 5 | Aplicar migration a Postgres prod. Deploy. Sandra hace onboarding 5 min. Documentar query de métricas semanal. | Matias |

**Si día 5 no llega operativo, el plan está mal y rehacemos antes de seguir.** No es un objetivo aspiracional.

---

## 12. Decisiones que necesito hoy

Antes de Día 1:

1. **¿Aprobás este alcance?** (Sí / "agregar X" / "cambiar Y" / no)
2. **Email de Sandra** — resolver vía `identity.users` (fuente de verdad). No embeber direcciones reales en docs públicos.
3. **¿Aplico migration en branch Supabase, o creás un proyecto Supabase separado para staging?**
4. **¿Mergeo PR #188 como draft → ready, o lo cierro y rehago en chunks más chicos?**

---

## 13. Después del MVP — solo si el kill switch dice "seguir"

El v2 brief sigue siendo la referencia para Phase 2 y 3. La diferencia es: ahora cada feature pasa por el mismo filtro de "¿qué métrica de negocio mueve y cómo se mide en 30 días?".

No se construye nada que no tenga métrica. Punto.

---

## Apéndice A — Referencias

- `docs/clientes-360/FEATURE-BRIEF-v2.md` — diseño completo (post-MVP)
- `docs/clientes-360/EXISTING-CRM-MAPPING.md` — qué reusar de lo existente
- `supabase/migrations/20260508000001_clientes_360_init.sql` — schema
- `supabase/migrations/20260508000001_clientes_360_init_rollback.sql` — kill switch SQL
- `server/lib/clientes/customerResolver.js` — algoritmo de resolución (ya en repo, usado en el seed del MVP)

---

## Apéndice B — Equipo BMC (referencia, no scope MVP)

Fuente: `docs/bmc-dashboard-modernization/Code.gs` — tab `EQUIPOS` del workbook CRM.

_Identidades reales viven en `identity.users`; aquí solo roles para evitar PII en git._

| Persona | Rol | Departamento | Grant Phase 1 (MVP) | Grant Phase 2 |
|---|---|---|---|---|
| CEO | superadmin | Dirección | `clientes.admin` (vía superadmin) | — |
| **Admin operativa** | **admin** | **Administración** | **`clientes.write`** | — |
| Vendedor mobile-first | operator | Ventas | — | `clientes.read` |
| Vendedor oficina | operator | Ventas | — | `clientes.read` |

Notas:
- Identity superadmin distinto: `matias@bmc.uy` (en `INTERNAL_SUPERADMIN_EMAILS`). Si el login Google de Matias usa `bmc.com`, hay que decidir cuál de los dos es la identidad canónica.
- Sandra Sánchez aparece en `docs/google-sheets-module/FULL-SHEETS-AUDIT-RAW.json` con su nombre completo.
- En Phase 2, antes de dar grant a Martin/Ramiro, **entrevistar 15 min cada uno** para confirmar que el panel les sirve. No asumir.
