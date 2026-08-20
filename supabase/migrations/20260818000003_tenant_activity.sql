-- Index for BMC admin "what Jenerik did" feed (payload.tenant = 'bc').
create index if not exists user_activity_log_tenant_payload_idx
  on identity.user_activity_log ((payload->>'tenant'), at desc)
  where payload ? 'tenant';
