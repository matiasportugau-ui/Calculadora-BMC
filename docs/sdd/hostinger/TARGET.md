# Target — hostinger

- **Path:** `https://www.hostinger.com/es`
- **Control plane:** `https://hpanel.hostinger.com`
- **Developer API:** `https://developers.hostinger.com/`
- **Type:** public commercial hosting platform (managed web/cloud hosting, VPS, domains, email, AI builders, automation)
- **Slug:** `hostinger`
- **Market capture:** Spain storefront (`/es`), prices in **EUR**, capture date **2026-08-13**
- **Depth:** full **public** catalog + hPanel surface (docs) + Hostinger API (OpenAPI) — sufficient to understand, purchase, provision, and integrate
- **Skill:** `sdd-reverse-engineer` (sdd-kit)
- **Started:** 2026-08-13

## Out of scope (v1 as-built)

- Internal datacenter topology, proprietary orchestration, source code
- Authenticated hPanel runtime inspection (no customer account)
- Uruguay / LATAM pricing unless a public page exposes it (treat as **UNKNOWN**)
- Comparison vs BMC stack (Vercel, Cloud Run, Netuy) — not requested in v1
- Quality audit (`sdd-quality-auditor`) — separate run
- Cloning Hostinger UI or reverse-engineering proprietary Horizons codegen stack

## Evidence method

Public pages, support articles, legal/security scope lists, and OpenAPI catalog at `developers.hostinger.com`. Tags: **CONFIRMED** | **INFERRED** | **UNKNOWN**.
