# RAG v1 — Recuperación de Cotizaciones Históricas para Panelin

**Fecha:** 2026-05-09
**Sprint:** Mayo 2026
**Estado:** Implementado, flag OFF por defecto.

---

## Arquitectura

```
                        TURNO DE CHAT (POST /api/agent/chat)
                                        │
                                        ▼
                          ┌─────────────────────────┐
                          │  lastUserMessage        │
                          │  "panel 100mm 4 aguas   │
                          │   200m², lista web"     │
                          └───────────┬─────────────┘
                                      │  RAG_ENABLED=true
                                      ▼
                          ┌─────────────────────────┐
                          │  embedText(query)        │
                          │  server/lib/embeddings.js│
                          │  → OpenAI text-embedding │
                          │    -3-small (1536 dim)   │
                          │  → stub (sin API key)    │
                          └───────────┬─────────────┘
                                      │
                                      ▼
                          ┌─────────────────────────┐
                          │  pgvector query          │
                          │  SELECT ... WHERE        │
                          │  embedding <=> $1 <= 0.3 │  (similarity >= 0.70)
                          │  ORDER BY distance       │
                          │  LIMIT 5                 │
                          └───────────┬─────────────┘
                                      │
                                      ▼
                          ┌─────────────────────────┐
                          │  formatRetrievedContext  │
                          │  ForPrompt(quotes)       │
                          │  → bloque markdown       │
                          │    "## Casos similares"  │
                          └───────────┬─────────────┘
                                      │
                                      ▼
                          ┌─────────────────────────┐
                          │  buildSystemPrompt()     │
                          │  + ragContext injected   │
                          │  → Claude recibe el      │
                          │    bloque histórico      │
                          └─────────────────────────┘
                                      │
                              Si falla retriever
                                      │
                                      ▼
                          ┌─────────────────────────┐
                          │  Chat continúa SIN RAG   │
                          │  (fallo no-fatal, log)   │
                          └─────────────────────────┘
```

```
Data pipeline (batch, fuera del request cycle):

normalized-quotes.jsonl
        │
        ▼
  embedQuotes.js
  (buildTextForEmbedding → embedText → upsert)
        │
        ▼
  quote_embeddings (Postgres + pgvector)
  ┌──────────────────────────────────────┐
  │  id | lead_id | content_hash        │
  │  embedding vector(1536)             │
  │  text_for_embedding | metadata JSONB│
  └──────────────────────────────────────┘
```

---

## Archivos creados

| Archivo | Rol |
|---------|-----|
| `migrations/0001_add_pgvector_and_quote_embeddings.sql` | Migración SQL: extensión vector + tabla + índice ivfflat |
| `migrations/README.md` | Instrucciones para correr SQLs manuales |
| `server/lib/embeddings.js` | Provider-agnostic embedding (OpenAI / stub) |
| `server/lib/rag.js` | Retriever: retrieveSimilarQuotes + formatRetrievedContextForPrompt |
| `scripts/training/embedQuotes.js` | Pipeline batch: JSONL → embeddings → Postgres |
| `tests/rag.test.js` | Tests unitarios (sin Postgres ni API key) |
| `docs/sprint-mayo/RAG-V1.md` | Este documento |

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `server/config.js` | Nuevo: `ragEnabled`, `ragTopK`, `ragThreshold` (defaults OFF) |
| `.env.example` | Nuevo: sección RAG v1 con vars comentadas |
| `server/routes/agentChat.js` | Import rag.js + bloque de retrieval (tras KB lookup) |
| `server/lib/chatPrompts.js` | Parámetro `ragContext` en `buildSystemPrompt` + inyección en array final |
| `package.json` | Test `tests/rag.test.js` añadido al chain `npm test` |

---

## Cómo correr la migración

```bash
# Prerequisito: pgvector debe estar habilitado en el servidor Postgres
# Ver migrations/README.md § Prerequisito: pgvector

# Aplicar la migración
psql "$DATABASE_URL" -f migrations/0001_add_pgvector_and_quote_embeddings.sql

# Verificar
psql "$DATABASE_URL" -c "SELECT name, applied_at FROM bmc_schema_migrations ORDER BY applied_at;"
psql "$DATABASE_URL" -c "\d quote_embeddings"
```

---

## Cómo correr embedQuotes

```bash
# 1. Dry-run (sin escribir en DB, ver sample de los primeros docs)
node scripts/training/embedQuotes.js --limit 50 --dry-run

# 2. Batch pequeño de prueba (confirmar que los upserts llegan a la DB)
node scripts/training/embedQuotes.js --limit 50

# 3. Batch completo
node scripts/training/embedQuotes.js

# 4. Re-embeder todo (forzar aunque hash no cambió, útil si cambias de modelo)
node scripts/training/embedQuotes.js --reembed-all
```

El script es idempotente: re-correrlo no duplica registros ni re-embede
leads con `content_hash` sin cambios. Ver progreso cada 100 docs en stdout.

---

## Cómo activar el flag en producción

### CHECKLIST de verificación (ejecutar en orden)

```
□ 1. Migración aplicada
     psql "$DATABASE_URL" -c "SELECT name FROM bmc_schema_migrations WHERE name='0001_add_pgvector_and_quote_embeddings';"
     → debe retornar 1 fila

□ 2. Tabla vacía pero existente
     psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM quote_embeddings;"
     → 0 (antes del batch)

□ 3. OPENAI_API_KEY configurado en el entorno Cloud Run
     Si no → el batch corre en modo stub (embeddings no-semánticos, RAG sin utilidad real)
     → solo activar con key real

□ 4. Batch de prueba con --limit 50
     node scripts/training/embedQuotes.js --limit 50
     → stdout muestra embedded=50, errors=0 (o muy pocos)
     psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM quote_embeddings WHERE embedding IS NOT NULL;"
     → debe ser ~50

□ 5. Test de retrieve manual
     node -e "
       import('./server/lib/rag.js').then(async r => {
         const res = await r.retrieveSimilarQuotes('panel ISODEC EPS 100mm techo 200m2 lista web', 3);
         console.log(JSON.stringify(res, null, 2));
       })
     "
     → debe retornar array con similitudes > 0.70

□ 6. Batch completo del JSONL
     node scripts/training/embedQuotes.js
     → progreso hasta el final, pocos errores

□ 6b. REINDEX del índice ivfflat (IMPORTANTE — hacerlo después del batch)
     pgvector construye los centroids ivfflat al indexar. Si el índice existía
     antes o se creó con la tabla vacía, no tiene centroids útiles.
     psql "$DATABASE_URL" -c "REINDEX INDEX idx_quote_embeddings_ivfflat;"
     Esto recalcula los centroids con los vectores reales → búsqueda más rápida.

□ 7. Activar el flag en Cloud Run
     En la consola GCP → Cloud Run → panelin-calc → Edit & Deploy → Environment Variables
     Agregar: RAG_ENABLED=true

     O bien en .env de staging:
     RAG_ENABLED=true

□ 8. Verificar en dev mode (Ctrl+Shift+D)
     El chat en modo dev debe mostrar eventos type="rag_match" con los scores.

□ 9. Monitorear logs (primera semana)
     Ver § Métricas a observar
```

---

## Costos estimados

| Concepto | Cálculo | Total |
|----------|---------|-------|
| Batch inicial 11.8k quotes | 11.800 quotes × ~50 tokens/texto = 590.000 tokens | ~$0.012 |
| Retrieval por turno (query) | ~20 tokens/turno × 5.000 turnos/mes = 100.000 tokens/mes | ~$0.002/mes |
| **Total primer mes** | | **~$0.014** |

Modelo: `text-embedding-3-small` — $0.02 / 1M tokens (al 2026-05).

**Nota:** Los 11.8k archivos están en Dropbox como stubs. El JSONL actual tendrá
mucho menos leads (solo los archivos sincronizados localmente). El costo real del
batch inicial es mucho menor que los $0.012 estimados para el corpus completo.

---

## Métricas a observar después del rollout

| Métrica | Cómo medirla | Target |
|---------|-------------|--------|
| Hit rate (RAG) | % turnos donde `rag_match.count > 0` | > 30% |
| Score promedio | Media de los `similarity` en hits | > 0.75 |
| Latencia overhead | Diferencia en ms del turno con/sin RAG flag | < 200ms |
| Errores retriever | Eventos `[rag] Error en query pgvector` en logs | 0 |
| Mejora en calidad | Comparar tasa de handoff antes/después de activar (semanas 3 vs 4 del sprint) | Reducción ≥ 5% |

---

## Próximos pasos

### Shadow harness etapas 3 y 4

El RAG v1 aporta contexto histórico, pero para medir su impacto real se necesitan:

- **Etapa 3 (shadowRunner.js):** Para cada lead con datos completos, llamar `POST /calc/cotizar`
  y comparar el precio Panelin con el precio histórico del lead.
- **Etapa 4 (shadowScore.js):** Calcular delta_pct y rubricar. Los leads con delta > 5%
  son los más informativos — si el RAG los recupera en turno similar, ¿Panelin ajusta?

Métricas del plan de entrenamiento §7 que el RAG apunta a mejorar:
- `% consultas resueltas sin handoff` — el contexto histórico puede ayudar a dar precios
  más precisos en primera respuesta.
- `Tasa de cierre PDF` — si el agente ya tiene ejemplos similares, puede llegar antes al precio.

### Parámetros ajustables sin redeploy

| Variable | Efecto | Ajuste recomendado |
|----------|--------|-------------------|
| `RAG_TOP_K` | Más contexto vs más tokens | Bajar a 3 si latencia > 200ms |
| `RAG_THRESHOLD` | Precisión vs recall | Subir a 0.80 si hits son irrelevantes |
| `RAG_ENABLED` | ON/OFF | Flip instantáneo si hay problemas |

---

*Documento generado: 2026-05-09. Owner: Matías Portugau / equipo dev BMC.*
