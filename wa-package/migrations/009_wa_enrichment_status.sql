-- WA Cockpit — Fase 3.1: separar `qué pasó con el enriquecimiento` de
-- `cuándo se procesó`. Hasta ahora, `enriched_at IS NOT NULL` mezclaba
-- mensajes OK, chatter y fallidos en un solo bucket; el dashboard y el
-- digest tenían que cruzar contra `wa_suggestions.error IS NOT NULL`
-- para distinguirlos. Esta columna lo hace explícito.
--
-- Valores:
--   'ok'              — generateSuggestions ejecutado, suggestion persistida
--   'skipped_chatter' — classifyIntent => "chatter" (saludo, ack, gracias)
--   'failed'          — error en cualquier punto del pipeline; suggestion
--                       de error se intentó guardar en wa_msg_fail savepoint

alter table wa_messages
  add column if not exists enrichment_status text
  check (enrichment_status in ('ok','skipped_chatter','failed'));

create index if not exists wa_messages_enrichment_status_idx
  on wa_messages (enrichment_status)
  where enrichment_status is not null;

-- Backfill conservador: filas ya enriquecidas se asumen 'ok'. No hay forma
-- de recuperar el outcome real retroactivamente; quien necesite distinguir
-- históricamente puede cruzar contra wa_suggestions.error / intent.
update wa_messages
   set enrichment_status = 'ok'
 where enriched_at is not null
   and enrichment_status is null;
