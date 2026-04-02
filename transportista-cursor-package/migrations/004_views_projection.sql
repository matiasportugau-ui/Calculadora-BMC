-- EXPORT_SEAL — último evento por viaje (sin ORDER global inútil)
create or replace view trip_state_view as
select distinct on (trip_id)
  trip_id,
  at_server as last_event_at,
  event_type as last_event_type,
  payload as last_payload,
  actor_type as last_actor_type
from trip_events
order by trip_id, at_server desc;

-- Timeline por viaje: usar en app
-- select * from trip_events where trip_id = $1 order by at_server asc;
