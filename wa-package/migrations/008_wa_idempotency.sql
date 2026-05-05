-- WA Cockpit — F2/F3: idempotency guards (Fase 2.1 + 2.2 del plan).
--
-- Defensa en profundidad: aunque el worker ya hace FOR UPDATE SKIP LOCKED,
-- añadimos índices únicos parciales para que cualquier race residual
-- (reinicio mid-batch, segunda instancia con tx desincronizada, retry manual)
-- no produzca filas duplicadas en wa_suggestions ni wa_quotes.
--
-- Predicados de los índices DEBEN matchear exactamente los ON CONFLICT del código
-- (waEnricherWorker.js + waQuoteRunner.js). Si se cambia uno, cambiar el otro.
--
-- ⚠️  Si hay duplicados pre-existentes en producción, este CREATE UNIQUE INDEX
-- abortará la migración. Limpiar antes con:
--   delete from wa_suggestions where id in (
--     select id from (
--       select id, row_number() over (
--         partition by trigger_msg_id order by generated_at desc, id desc
--       ) as rn
--       from wa_suggestions
--       where trigger_msg_id is not null
--     ) s where rn > 1
--   );
-- (análogo para wa_quotes)

-- Una sugerencia por mensaje gatillo. Si el worker reintenta, el INSERT se
-- convierte en UPDATE de la fila existente (mantiene id estable).
create unique index if not exists wa_suggestions_trigger_unique
  on wa_suggestions (trigger_msg_id)
  where trigger_msg_id is not null;

-- Una auto-cotización por mensaje gatillo. Las cotizaciones MANUALES
-- (generated_by_ai = false) quedan fuera del índice → el operador puede
-- re-cotizar el mismo chat las veces que necesite.
create unique index if not exists wa_quotes_trigger_ai_unique
  on wa_quotes (trigger_msg_id)
  where trigger_msg_id is not null and generated_by_ai = true;
