-- Tenant Paneles LAM (parallel to BC / Jenerik). Sale-only; no factory cost.

insert into identity.tenants (slug, display_name, legal_name, branding)
values (
  'paneleslam',
  'LAM',
  'Paneles LAM',
  '{
    "marca": "LAM",
    "descriptor": "Paneles aislantes",
    "razonSocial": "Paneles LAM",
    "pdf_layout": "paneleslam",
    "web": "https://paneleslam.com.uy"
  }'::jsonb
)
on conflict (slug) do nothing;

create table if not exists tenant_quote_counter (
  slug text not null,
  year int not null,
  seq int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (slug, year)
);
