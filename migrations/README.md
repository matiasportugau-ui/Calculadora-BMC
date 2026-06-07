# migrations/

Migraciones SQL manuales para el proyecto BMC / Panelin.

## Sistema de migraciones

No hay framework de migrations instalado. Las migraciones se aplican manualmente con `psql` contra `DATABASE_URL`.

El tracking se hace en la tabla `bmc_schema_migrations`:

```sql
CREATE TABLE IF NOT EXISTS bmc_schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Cómo aplicar una migración

```bash
# 1. Conectar a la base
psql "$DATABASE_URL"

# 2. Aplicar el archivo
\i migrations/0001_add_pgvector_and_quote_embeddings.sql

# 3. Verificar
SELECT name, applied_at FROM bmc_schema_migrations ORDER BY applied_at;
```

O en una sola línea:

```bash
psql "$DATABASE_URL" -f migrations/0001_add_pgvector_and_quote_embeddings.sql
```

## Prerequisito: pgvector

Las migraciones de embeddings requieren la extensión `pgvector`.

- **Supabase:** Disponible en Settings → Database → Extensions → vector.
- **Neon / Render:** Habilitar desde el panel o con `CREATE EXTENSION vector;` si el tier lo soporta.
- **Postgres local (macOS):** `brew install pgvector` luego reiniciar el servicio.
- **Cloud Run + Cloud SQL:** Activar en la instancia con `--database-flags` o ejecutar `CREATE EXTENSION vector;` como superuser.

Si `CREATE EXTENSION vector` falla con "extension not available", la migración no continúa — hay que resolver el prerequisito antes.

## Migraciones disponibles

| Archivo | Descripción |
|---------|-------------|
| `0001_add_pgvector_and_quote_embeddings.sql` | pgvector + tabla `quote_embeddings` para RAG v1 |
