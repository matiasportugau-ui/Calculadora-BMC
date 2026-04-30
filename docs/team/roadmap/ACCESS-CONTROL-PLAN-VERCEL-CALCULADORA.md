# Plan de Implementación Profundo — Control de Acceso en Calculadora BMC (Vercel)

## 0) Resumen ejecutivo

Este plan implementa **autenticación + autorización por roles + precios segmentados** para que:

- el equipo interno opere con vistas completas,
- los clientes usen la calculadora como autoservicio,
- y nunca se expongan costos/márgenes internos por API/UI.

La implementación propuesta se apoya en **Supabase Auth + Postgres (RLS)**, manteniendo compatibilidad progresiva con el stack actual (`server/` + `src/`) y permitiendo migración por fases sin cortar operación.

---

## 1) Objetivos de negocio y seguridad

## Objetivos de negocio
1. Compartir la calculadora con clientes sin riesgo de fuga de información interna.
2. Delegar cotización a ventas/administración con permisos diferenciados.
3. Asignar listas de precio por usuario/cliente para canales y acuerdos comerciales.
4. Reducir fricción operativa (alta/baja de usuarios, auditoría, trazabilidad).

## Objetivos de seguridad
1. Cero exposición de `costos`, `margen`, `markups internos`, `observaciones internas` a rol `cliente`.
2. Autorización obligatoria en backend para todo endpoint sensible.
3. Menor privilegio por defecto (“deny by default”).
4. Evidencia auditable de accesos y cambios de permisos.

---

## 2) Alcance funcional (v1)

## Incluye
- Login/logout, recuperación de contraseña.
- Gestión de usuarios por `admin`.
- Roles base: `admin`, `ventas`, `administracion`, `cliente`.
- Asignación de **lista de precios** por usuario cliente.
- Restricción de rutas `/hub/*` y endpoints internos según rol.
- Guardado de cotizaciones con ownership (clientes ven solo las suyas).

## No incluye (v1)
- SSO corporativo (SAML/OIDC enterprise).
- ABAC avanzado por atributos complejos.
- Multi-tenant completo con aislamiento por organización en todo el dominio (se deja preparado).

---

## 3) Modelo de roles y permisos

## Roles
- **admin**: control total, IAM interno, listas, auditoría.
- **ventas**: cotización avanzada, CRM comercial, sin cambios de IAM.
- **administracion**: vista administrativa/financiera definida por negocio (ver decisión abierta A1).
- **cliente**: cotiza en modo restringido, sin datos internos.

## Matriz RBAC v1 (base)

| Recurso/Acción | admin | ventas | administracion | cliente |
|---|---:|---:|---:|---:|
| Login / logout | ✅ | ✅ | ✅ | ✅ |
| Crear usuario | ✅ | ❌ | ❌ | ❌ |
| Asignar rol/lista | ✅ | ❌ | ❌ | ❌ |
| Ver costos internos | ✅ | ✅ | ⚠️ decisión A1 | ❌ |
| Crear cotización | ✅ | ✅ | ✅ | ✅ (propias) |
| Ver cotizaciones ajenas | ✅ | ✅ | ⚠️ política | ❌ |
| Exportes internos | ✅ | ✅ | ✅ | ❌ |
| Endpoints `/api/internal/*` | ✅ | según policy | según policy | ❌ |
| Módulos `/hub/*` internos | ✅ | según módulo | según módulo | ❌ |

> ⚠️ A1: cerrar definición de alcance exacto para `administracion` antes de pasar a Fase 2.

---

## 4) Arquitectura propuesta

## 4.1 Identity
- **Supabase Auth** para sesión, recuperación de contraseña y emisión de JWT.
- Frontend (Vercel) mantiene sesión con SDK oficial y refresh automático.
- Backend valida JWT de Supabase en middleware dedicado.

## 4.2 Perfil y autorización
- Tabla `profiles` (1:1 con `auth.users`) con `role`, `status`, `org_id` (nullable v1), metadata mínima.
- Biblioteca RBAC en servidor (`server/lib/rbac.js`) con:
  - `roleHierarchy`
  - `policyMap`
  - `assertPermission(user, action, resource)`

## 4.3 Datos de precio
- Tabla `price_lists`.
- Tabla `user_price_list_assignments` (histórico opcional con vigencia).
- Resolución de lista activa por usuario para cálculo/cotización.

## 4.4 Protección de datos sensibles
- DTO por rol en capa de respuesta:
  - `internalQuoteDTO` (interno)
  - `clientQuoteDTO` (sin costos/márgenes/campos internos)
- Verificación de “campo prohibido” en tests de contrato por rol.

## 4.5 Trazabilidad
- Tabla `audit_events` para:
  - login relevante,
  - cambios de rol,
  - cambios de lista de precios,
  - intentos denegados críticos.

---

## 5) Diseño de datos (SQL orientativo)

```sql
-- profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','ventas','administracion','cliente')),
  status text not null default 'active' check (status in ('active','disabled')),
  org_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- price lists
create table if not exists public.price_lists (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- user ↔ price list assignment
create table if not exists public.user_price_list_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  price_list_id uuid not null references public.price_lists(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  unique(user_id, price_list_id, starts_at)
);

-- audit
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null,
  event_type text not null,
  target_type text null,
  target_id text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## RLS (línea base)
- `profiles`: cada usuario ve su perfil; `admin` gestiona todo vía service role en backend.
- cotizaciones: `cliente` solo own records (`owner_user_id = auth.uid()`).
- asignaciones de listas: lectura limitada por owner o rol interno.

---

## 6) Cambios técnicos por capa

## 6.1 Frontend (`src/`)
1. `AuthProvider` global (sesión + perfil + rol + permisos efectivos).
2. `ProtectedRoute` por rol/permisos para `/hub/*`.
3. UI de login/recovery.
4. “Modo cliente” en calculadora:
   - no renderizar columnas/campos internos,
   - bloquear acciones internas.
5. Panel admin para alta usuario + asignación rol/lista.

## 6.2 Backend (`server/`)
1. Middleware `requireAuth` (JWT Supabase).
2. Middleware `requireRole` / `requirePermission`.
3. Adaptación de rutas sensibles:
   - `server/routes/bmcDashboard.js`
   - rutas internas `/api/internal/*`
4. Sanitización respuesta por rol (DTO).
5. Logging/auditoría con `pino` + `audit_events`.

## 6.3 Infra (Vercel / Cloud Run)
1. Variables nuevas:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo backend)
2. Rotación/secret management según entorno.
3. Checklist de deploy con smoke RBAC post-release.

---

## 7) Plan de entrega por fases

## Fase 0 — Descubrimiento y contrato (2–4 días)
- Cerrar decisión A1 (alcance `administracion`).
- Inventario de endpoints/rutas que exponen campos sensibles.
- Definir contrato público `cliente` (JSON schema).

**Salida:** Documento de contrato + matriz final aprobada por negocio.

## Fase 1 — Auth + RBAC mínimo (4–7 días)
- Integrar login/logout/recovery.
- Implementar `profiles` + middleware auth/role.
- Proteger rutas internas y módulos `/hub/*`.

**DoD:** ningún usuario anónimo accede a rutas protegidas; `cliente` bloqueado en módulos internos.

## Fase 2 — Precio segmentado + ownership (4–8 días)
- `price_lists` + `user_price_list_assignments`.
- Resolver lista en cálculo.
- Ownership de cotizaciones para clientes.

**DoD:** cliente solo ve cotizaciones propias y precios de su lista.

## Fase 3 — Hardening + auditoría (3–6 días)
- `audit_events` + eventos críticos.
- Tests de no-fuga de datos sensibles.
- Alertas básicas ante intentos 403 repetidos.

**DoD:** evidencia auditable + suite de seguridad verde.

## Fase 4 — Rollout controlado (2–5 días)
- Feature flag por cohortes (interno → clientes piloto → general).
- Monitoreo de errores auth y tasa de 403.

**DoD:** rollout completo sin incidentes de fuga de datos.

---

## 8) Estrategia de testing

## Unit
- RBAC engine (`allow/deny` por rol/acción/recurso).
- Sanitizadores DTO por rol.

## Integración
- Endpoints con JWT válido/inválido/expirado.
- Verificación `403` en acciones prohibidas.

## Contrato API
- Snapshot de respuesta `cliente` sin campos restringidos.
- Casos `admin/ventas/cliente` para endpoint críticos de cotización.

## E2E
- Flujo login cliente → cotizar → guardar → ver solo propias.
- Flujo admin → crear usuario cliente → asignar lista → validar efecto.

## Seguridad
- Intento de IDOR (acceso a cotización ajena) debe devolver `403/404` según política.
- Regression test de campos sensibles (`cost`, `margin`, `internalNotes`) ausentes en rol cliente.

---

## 9) Riesgos, trade-offs y mitigaciones

1. **Complejidad inicial de RLS + backend policy dual**
   - Mitigación: arrancar con policy backend clara y RLS incremental.
2. **Regresiones en cotización por segmentación de precios**
   - Mitigación: golden tests de cálculo por lista.
3. **Fricción operativa en alta de usuarios**
   - Mitigación: panel admin simple + templates de onboarding.
4. **Exposición accidental por endpoint legacy**
   - Mitigación: inventario + grep de campos sensibles + test de contrato global.

---

## 10) Backlog técnico sugerido (tickets)

1. `AUTH-01`: integrar Supabase Auth en frontend.
2. `AUTH-02`: middleware JWT verificación en backend.
3. `RBAC-01`: librería de permisos central.
4. `RBAC-02`: proteger `/api/internal/*`.
5. `RBAC-03`: proteger módulos `/hub/*`.
6. `PRICE-01`: migraciones `price_lists` y asignaciones.
7. `PRICE-02`: resolver lista activa en motor cotización.
8. `DATA-01`: DTO `cliente` sin campos internos.
9. `AUDIT-01`: tabla + escritura de eventos críticos.
10. `TEST-01`: suite contrato por rol.
11. `TEST-02`: e2e cliente/admin.
12. `OPS-01`: checklist deploy + smoke RBAC.

---

## 11) Criterios de aceptación globales

1. Usuario `cliente` autenticado cotiza y guarda cotizaciones propias.
2. Usuario `cliente` nunca recibe campos internos en API ni los ve en UI.
3. Endpoints internos deniegan acceso a `cliente` consistentemente.
4. Admin puede crear usuario y asignar rol/lista sin intervención técnica.
5. Toda denegación/acción crítica relevante queda auditable.

---

## 12) Decisiones abiertas

- **A1:** alcance exacto de `administracion` respecto a costos/margen.
- **A2:** política de respuesta ante acceso ajeno: `403` vs `404`.
- **A3:** modelo de organización (`org_id`) activo en v1 o preparado para v2.
- **A4:** caducidad/revocación de sesiones para cuentas `disabled`.

---

## 13) Siguiente paso recomendado (operativo)

1. Taller de 60–90 min con negocio (Matías + ventas + administración) para cerrar A1/A2.
2. Congelar matriz final de permisos v1.
3. Crear tickets `AUTH-*` y `RBAC-*` (Fase 1) y ejecutar piloto interno antes de clientes.
