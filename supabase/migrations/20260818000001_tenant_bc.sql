-- Tenant BC (Jenerik): BMC owns the SaaS, one tenant, Jenerik invites accounts.
-- Sale prices live on identity.quotes.payload. No factory cost / commission
-- columns in this migration — those come later when we pick a charging model.

create table if not exists identity.tenants (
  tenant_id     uuid primary key default uuid_generate_v4(),
  slug          text not null unique,
  display_name  text not null,
  legal_name    text,
  branding      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists tenants_touch on identity.tenants;
create trigger tenants_touch before update on identity.tenants
  for each row execute function identity.touch_updated_at();

create table if not exists identity.tenant_members (
  tenant_id       uuid not null references identity.tenants(tenant_id) on delete cascade,
  user_id         uuid references identity.users(user_id) on delete cascade,
  invited_email   citext not null,
  role            text not null default 'user',
  invited_by      uuid references identity.users(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  claimed_at      timestamptz,
  constraint tenant_members_role_check check (role in ('owner', 'user')),
  constraint tenant_members_identity_check check (user_id is not null or invited_email is not null)
);

create unique index if not exists tenant_members_user_uidx
  on identity.tenant_members(tenant_id, user_id)
  where user_id is not null;

create unique index if not exists tenant_members_email_uidx
  on identity.tenant_members(tenant_id, invited_email);

create index if not exists tenant_members_email_pending_idx
  on identity.tenant_members(invited_email)
  where user_id is null;

alter table identity.quotes
  add column if not exists tenant_id uuid references identity.tenants(tenant_id) on delete set null;

create index if not exists quotes_tenant_recent_idx
  on identity.quotes(tenant_id, created_at desc)
  where tenant_id is not null and status <> 'deleted';

insert into identity.tenants (slug, display_name, legal_name, branding)
values (
  'bc',
  'BC',
  'Jenerik Bentancor',
  '{
    "marca": "BC",
    "descriptor": "Paneles aislantes / Techos y fachadas",
    "razonSocial": "Jenerik Bentancor",
    "rut": "150633750010",
    "direccion": "Florencio Sánchez y Ruta 5 vieja, Progreso",
    "pdf_layout": "bc"
  }'::jsonb
)
on conflict (slug) do nothing;

comment on table identity.tenants is
  'SaaS tenants. v1 seed is slug=bc (Jenerik). BMC superadmin owns the platform.';

comment on table identity.tenant_members is
  'owner = Jenerik (invites). user = seller. BMC admins are not members; they use /api/admin/tenants.';
