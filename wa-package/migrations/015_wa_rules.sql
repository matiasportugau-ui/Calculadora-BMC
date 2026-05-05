-- WA Cockpit — F-A1: tabla wa_rules (routing rules estilo Missive).
--
-- Cada regla evaluada por server/lib/waRoutingRules.js en /api/wa/ingest.
-- Reemplaza el wa_conversations.owner_op manual con asignación automática.
--
-- Schema de when_conditions (jsonb), todas opcionales (AND entre claves
-- presentes; OR dentro de cada array):
--   { phone_starts_with: ["+598"], phone_contains: ["..."],
--     contact_name_contains: ["..."], text_matches: ["urgente", "presupuesto"],
--     intent_in: ["cotizacion","follow_up"],
--     hour_between: [9, 18], days_of_week: ["mon","tue",...] }
--
-- Schema de then_actions (jsonb):
--   { assign: "carlos", label: "maldonado", status: "in_progress",
--     alert: { kind: "webhook"|"toast", message: "..." },
--     stop_processing: true }   ← detiene reglas con priority menor
--
-- priority ASC se evalúa primero (1 = más prioritaria).

create table if not exists wa_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default true,
  priority int not null default 100,
  when_conditions jsonb not null default '{}'::jsonb,
  then_actions jsonb not null default '{}'::jsonb,
  -- Estadísticas runtime para que la UI muestre "esta regla aplicó X veces":
  hit_count bigint not null default 0,
  last_hit_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists wa_rules_priority_idx on wa_rules (enabled, priority asc) where enabled = true;
create index if not exists wa_rules_last_hit_idx on wa_rules (last_hit_at desc nulls last);
