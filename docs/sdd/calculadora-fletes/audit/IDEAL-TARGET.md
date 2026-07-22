# Ideal 100% — Calculadora de Fletes BMC

## Target composite: 100 (pass ≥90)

## System class

In-product **pure JS freight quotation module** inside Calculadora BMC SPA (React/Vite) + shared packing with `/logistica`; no dedicated microservice; no LLM in v1.

## Must-have artifacts

- `docs/team/SDD-CALCULADORA-FLETES.md` — SCHEMA-CONTRACT sections **1–12 in order**
- Domain rules may live as **Appendix A** (not as §7 displacing Data Flow)
- `docs/sdd/calculadora-fletes/RECREATION-CHECKLIST.md` — all items closed or justified N/A
- `docs/sdd/calculadora-fletes/evidence/` — index citing paths for engine, UI, FX, tests
- Status aligned with reality: `As-Built` (or `As-Built Draft`) when shipped

## Section-specific ideal

### §5 Containers

Containers named to match repo reality:

| Container | Path / surface |
|-----------|----------------|
| Wizard Flete + FleteCotizarPanel | `src/components/…` |
| fleteEngine | `src/utils/fleteEngine.js` |
| cargoPacking | `src/utils/logistica/cargoPacking.js` |
| TARIFAS_LOGISTICAS | `src/data/constants.js` |
| brouFx | `src/utils/brouFx.js` (document actual API) |
| /logistica UI | route + packing consumer |

Model `/logistica` packing as **internal container**, not System_Ext, unless a separate deployable exists.

### §6 AI

Keep **N/A** with one sentence evidence (“no LLM calls in Cotizar flete path; spot-check FleteCotizarPanel + fleteEngine”). Optional future = out of v1.

### §7 Data Flow

Keep the existing “Cotizar flete” sequenceDiagram as the primary §7 flow.

### §8 Deployment

Ideal content:

- Frontend: Vite SPA → Vercel (`calculadora-bmc.vercel.app`); wizard step ships with SPA build
- No new Cloud Run service for flete v1
- FX: document provider URL/env (today: `uy.dolarapi.com` via `brouFx.js`), cache TTL, failure → manual override
- Tests: `node tests/fleteEngine.test.js` / inclusion in `test:core`
- Secrets: none required for core tariff path; FX is public HTTPS best-effort

### §9 Crosscutting

Retain current pillars; add one line on PII (destino in resumen/logs) and deploy coupling (tariff change = PR + Vercel).

### §10 ADRs

Keep ADR-001…006; add **Alternatives considered** on ADR-001/002; add ADR for **FX source** (dolarapi vs official BROU) once decided.

### Acceptance test

A developer with repo access can:

1. Point to files implementing Cotizar flete  
2. Run freight unit tests  
3. Change a Maldonado 1-fila tariff and know deploy path  
4. Explain FX failure UX  

using **only** SDD + recreation checklist — in **&lt; 2 hours**.
