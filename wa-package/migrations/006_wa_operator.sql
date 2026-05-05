-- WA Cockpit — F5: multi-operador (operator_id en mensajes y conversaciones)

alter table wa_messages
  add column if not exists created_by text;

alter table wa_suggestions
  add column if not exists chosen_by text;

create index if not exists wa_messages_created_by_idx on wa_messages (created_by) where created_by is not null;
create index if not exists wa_conversations_owner_op_idx on wa_conversations (owner_op) where owner_op is not null;
