# Target — calculadora-bmc

- **Path:** `/Users/matias/calculadora-bmc`
- **Prod UI:** `https://calculadora-bmc.vercel.app`
- **Prod API:** `https://panelin-calc-q74zutv7dq-uc.a.run.app` (proxied from Vercel for `/api`, `/calc`, `/auth`, `/sync`, `/ml`)
- **Type:** full-stack monolith (Vite React SPA + Express 5 API + Postgres + Google Sheets)
- **Slug:** `calculadora-bmc`
- **Depth:** full recreation of the **product surface** (calculator + hub + API + primary integrations)
- **Package:** `calculadora-bmc@3.1.5` (`package.json`)
- **Branch at capture:** `feat/panelin-build-max-b01-done`
- **Out of scope (v1 as-built):**
  - Sibling repos (`bmc-control`, email-inbox IMAP package) except as external interfaces
  - Historical archives / zip dumps at repo root (`docs 2`, `docs.zip`, etc.)
  - Deep per-tab Sheets column schema (see `docs/google-sheets-module/` — cite, don't duplicate)
  - Tauri desktop packaging details beyond existence of scripts
- **Started:** 2026-07-19
- **Skill:** `sdd-reverse-engineer` (sdd-kit)
