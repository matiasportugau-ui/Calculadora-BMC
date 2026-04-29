# ADR-001 — Propiedad de datos y Supabase (BMC Platform)

**Estado:** propuesto (Fase 0)  
**Fecha:** 2026-04-29  
**Contexto:** Roadmap v1.3 — Áreas 2 (numeración), 3 (auth), 4 (KB central + observabilidad).

## Contexto

El repo **Calculadora-BMC** hoy combina:

- **Google Sheets** como CRM operativo y **MATRIZ** de precios (`BMC_SHEET_ID`, `BMC_MATRIZ_SHEET_ID`, etc.).
- **Panel de cotizaciones** y rutas **`/api/*`** que leen/escriben Sheets según `server/routes/bmcDashboard.js`.
- **Knowledge de chat** en `data/training-kb.json` con opción **GCS** en Cloud Run (`GCS_KB_BUCKET`, ver `server/lib/trainingKB.js`).
- **Telemetría de chat** append-only en `data/conversations/*.jsonl` (`server/lib/conversationLog.js`).
- Sesiones de training en `data/training-sessions/*.jsonl` (`appendTrainingSessionEvent`).

Puede coexistir **`DATABASE_URL`** Transportista / Postgres local para flujos ajenos al roadmap (no fusionar sin ADR siguiente).

## Decisión

1. **`display_number` canónico (formato BMC-YYYY-NNNNN)** vive en **PostgreSQL gestionado por Supabase** en la tabla `quotations` (nombre exacto a definir en migración). Es la **única fuente** para ese identificador en PDF, enlaces públicos y UI “Mi cuenta”.

2. **Filas CRM en Sheets** siguen siendo **SoT operativa** hasta fecha de migración explícita: sincronización hacia/desde Postgres se define en un ADR posterior (dual-write o job nocturno). **No** se eliminan rutas Sheets en el mismo PR que introduce Supabase.

3. **KB RAG de producción** (Área 4) tiene como **meta** tablas Postgres + **pgvector** en el **mismo** proyecto Supabase que auth. Durante la transición, el código legacy (`training-kb.json` / GCS) puede ejecutarse en **paralelo** con etiqueta `source`/flag de canal hasta cierre de puente documentado.

4. **Telemetría de conversaciones** debe **persistir** fuera del disco efímero de Cloud Run: **objeto GCS append-only**, **Pub/Sub + BigQuery**, o **tabla Postgres** (`conversation_events`). Se elige implementación en Fase 2; hasta entonces desarrollo local + documentación de riesgo en Cloud Run siguen válidos.

5. **`auth.users` Supabase** es el **único** `authSubject` estable para políticas **RLS** en tablas cliente (`quotations`, `profiles`, `quote_shares`, etc.). El backend Express (Cloud Run) valida JWT con **JWKS Supabase** o confía headers solo si el tráfego viene de un proxy conocido — detalle en runbook cuando exista código.

## Consecuencias

- Migraciones SQL versionadas (`supabase/migrations/` cuando se inicialice CLI).
- Secretos nuevos (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) solo env / Secret Manager — ver `.env.example`.
- Contratos públicos (`display_number`) deben aparecer en TypeScript/OpenAPI cuando exista cliente compartido.

## No objetivos de este ADR

- Diseño UX de Mi cuenta ni esquema fiscal DGI completo (solo vínculos a `profiles`).
