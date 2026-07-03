-- ============================================================================
-- WA CANONICAL FLIP — Queries de vigilancia (soak) para OMNI_WA_CANONICAL=1
-- Uso:  psql "$DATABASE_URL" -f wa-canonical-soak-queries.sql
--       (o pegá cada bloque por separado en tu cliente SQL)
-- Complementa docs/team/runbooks/wa-canonical-flip.md — Paso 4 (vigilancia).
-- Estados reales de omni_ai_jobs: pending | running | completed | failed | dead
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. PRE-CHECK — migraciones aplicadas (correr ANTES del flip).
--    Deben figurar: 011_wa_crm_sync_job, 012_omni_ai_jobs_run_after y
--    014_ai_job_type_union (la convergencia del CHECK tras la colisión #531).
-- ────────────────────────────────────────────────────────────────────────────
SELECT name, applied_at
  FROM omni_schema_migrations
 ORDER BY name;

-- El CHECK debe aceptar los 6 tipos (incluidos 'assist' y 'wa_crm_sync'):
SELECT pg_get_constraintdef(oid) AS check_actual
  FROM pg_constraint
 WHERE conname = 'omni_ai_jobs_type_valid';

-- ────────────────────────────────────────────────────────────────────────────
-- 1. SALUD GENERAL wa_crm_sync (últimas 24h) — el tablero principal del soak.
--    Esperado: completed ≫ dead (dead idealmente 0); pending bajo y estable.
-- ────────────────────────────────────────────────────────────────────────────
SELECT status,
       COUNT(*)                            AS jobs,
       MIN(created_at)                     AS mas_viejo,
       MAX(created_at)                     AS mas_nuevo,
       ROUND(AVG(latency_ms))              AS latencia_media_ms
  FROM omni_ai_jobs
 WHERE job_type = 'wa_crm_sync'
   AND created_at >= now() - interval '24 hours'
 GROUP BY status
 ORDER BY status;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. BACKLOG — pendientes ya vencidos (run_after pasado) y su antigüedad.
--    Esperado: pocas filas y edad < ~2 min (un tick del worker). Si crece,
--    el worker no está drenando (¿orchestrator apagado? ¿error en el tick?).
-- ────────────────────────────────────────────────────────────────────────────
SELECT id, conversation_id, attempts, created_at,
       run_after,
       now() - GREATEST(created_at, COALESCE(run_after, created_at)) AS atraso
  FROM omni_ai_jobs
 WHERE job_type = 'wa_crm_sync'
   AND status IN ('pending', 'failed')
   AND (run_after IS NULL OR run_after <= now())
 ORDER BY created_at
 LIMIT 20;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. DEAD-LETTER — jobs que agotaron los 3 intentos (REQUIEREN acción manual:
--    ese lead NO llegó a CRM_Operativo). El error más común esperable sería
--    parse_conversation_http_503 (proveedores IA caídos durante los 3 intentos).
-- ────────────────────────────────────────────────────────────────────────────
SELECT j.id, j.error, j.attempts, j.created_at, j.completed_at,
       c.channel_conversation_id AS telefono
  FROM omni_ai_jobs j
  LEFT JOIN omni_conversations c ON c.id = j.conversation_id
 WHERE j.job_type = 'wa_crm_sync'
   AND j.status = 'dead'
 ORDER BY j.completed_at DESC
 LIMIT 20;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. THROUGHPUT POR HORA (primera hora / primer día del flip).
--    Sirve para ver que el flujo arrancó y se mantiene.
-- ────────────────────────────────────────────────────────────────────────────
SELECT date_trunc('hour', created_at)      AS hora,
       COUNT(*) FILTER (WHERE status = 'completed') AS completados,
       COUNT(*) FILTER (WHERE status = 'dead')      AS muertos,
       COUNT(*)                                     AS total
  FROM omni_ai_jobs
 WHERE job_type = 'wa_crm_sync'
   AND created_at >= now() - interval '24 hours'
 GROUP BY 1
 ORDER BY 1 DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. COALESCING SANO — nunca debe haber >1 job activo por conversación
--    (lo garantiza el índice parcial de la migración 011; esta query es el
--    verificador). Esperado: 0 filas.
-- ────────────────────────────────────────────────────────────────────────────
SELECT conversation_id, COUNT(*) AS activos
  FROM omni_ai_jobs
 WHERE job_type = 'wa_crm_sync'
   AND status IN ('pending', 'failed')
 GROUP BY conversation_id
HAVING COUNT(*) > 1;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. DEBOUNCE run_after FUNCIONANDO — jobs retenidos a futuro (ráfaga en curso).
--    Esperado: los pending de conversaciones activas tienen run_after ~60s
--    después del último mensaje; si run_after es siempre NULL, la migración 012
--    no está aplicada o el enqueue no está pasando el delay.
-- ────────────────────────────────────────────────────────────────────────────
SELECT j.id, c.channel_conversation_id AS telefono,
       j.created_at, j.run_after,
       j.run_after - now() AS falta_para_correr
  FROM omni_ai_jobs j
  LEFT JOIN omni_conversations c ON c.id = j.conversation_id
 WHERE j.job_type = 'wa_crm_sync'
   AND j.status = 'pending'
   AND j.run_after > now()
 ORDER BY j.run_after
 LIMIT 20;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. SPOT-CHECK PUNTA A PUNTA de una conversación (reemplazá el teléfono):
--    debe existir 1 job wa_crm_sync completado y ≥1 sugerencia Omni.
--    (La fila única en CRM_Operativo se verifica en la planilla, por teléfono.)
-- ────────────────────────────────────────────────────────────────────────────
-- \set telefono '59891234567'
SELECT 'job'        AS que, j.status::text AS estado, j.created_at, j.output_json::text AS detalle
  FROM omni_ai_jobs j
  JOIN omni_conversations c ON c.id = j.conversation_id
 WHERE c.channel = 'wa' AND c.channel_conversation_id = :'telefono'
   AND j.job_type = 'wa_crm_sync'
UNION ALL
SELECT 'sugerencia', s.approval_state, s.created_at, LEFT(s.body, 80)
  FROM omni_suggestions s
  JOIN omni_conversations c ON c.id = s.conversation_id
 WHERE c.channel = 'wa' AND c.channel_conversation_id = :'telefono'
 ORDER BY created_at DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. PRESUPUESTO IA DEL DÍA — misma cuenta que usa el gate del worker.
--    Comparar contra OMNI_AI_DAILY_BUDGET_USD. Recordá: el gate solo frena
--    'suggest'; wa_crm_sync sigue drenando aunque se agote.
-- ────────────────────────────────────────────────────────────────────────────
SELECT job_type,
       COUNT(*)                             AS jobs,
       ROUND(COALESCE(SUM(cost_usd), 0), 4) AS usd_hoy
  FROM omni_ai_jobs
 WHERE created_at >= date_trunc('day', now())
 GROUP BY job_type
 ORDER BY usd_hoy DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. ESPEJO DEL COCKPIT — omni_messages sigue recibiendo WA (y por lo tanto
--    /hub/wa sigue vivo; el espejo wa_messages corre en ambos modos).
--    Esperado: mensajes recientes con channel='wa'.
-- ────────────────────────────────────────────────────────────────────────────
SELECT date_trunc('hour', m.created_at) AS hora, COUNT(*) AS mensajes_wa
  FROM omni_messages m
  JOIN omni_conversations c ON c.id = m.conversation_id
 WHERE c.channel = 'wa'
   AND m.created_at >= now() - interval '6 hours'
 GROUP BY 1
 ORDER BY 1 DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. POST-ROLLBACK (solo si volviste a OMNI_WA_CANONICAL=0): no deben quedar
--     jobs wa_crm_sync nuevos después del redeploy OFF. Esperado: 0.
-- ────────────────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS creados_post_rollback
  FROM omni_ai_jobs
 WHERE job_type = 'wa_crm_sync'
   AND created_at >= now() - interval '15 minutes';
