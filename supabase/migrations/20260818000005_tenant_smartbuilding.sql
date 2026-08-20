-- Tenant SmartBuilding (parallel to BC / LAM). Sale-only; no factory cost.

insert into identity.tenants (slug, display_name, legal_name, branding)
values (
  'smartbuilding',
  'SMARTBUILDING',
  'SmartBuilding',
  '{
    "marca": "SMARTBUILDING",
    "descriptor": "Paneles y sistemas constructivos",
    "razonSocial": "SmartBuilding",
    "pdf_layout": "smartbuilding",
    "codePrefix": "SMART",
    "theme": {
      "headerBg": "#0B0B0C",
      "headerInk": "#F4F5F7",
      "accent": "#E4E7EB",
      "accentSoft": "#9AA3AD",
      "wash": "#EEF2F5",
      "ink": "#101114",
      "paper": "#FFFFFF",
      "rule": "#C5CCD3"
    }
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
