# Brief: White-label quotation calculator SaaS — construction distributors (LatAm)

**Run 2026-W27 · composite 4.00 · packaging: SaaS · anchors on pre-explored direction #1 (white-label SaaS)**

## Asset
Pure calc engine (`src/utils/calculations.js`), data-driven 422-SKU catalogue with dual price lists (`src/data/constants.js`), BOM, PDF (7 templates, `src/pdf-templates/`), WhatsApp export (`src/utils/helpers.js`). Live in production for BMC Uruguay — hecho confirmado.

## Comparables (verified 2026-07-03)
| Product | URL | Price | Note |
|---|---|---|---|
| Clear Estimates | https://www.clearestimates.com/pricing | $79/mo Standard; **$249/mo Franchise (white-label: custom branding, hosted on your site)** | verified on page — best white-label anchor |
| PlanSwift | https://www.planswift.com/pricing/ | $2,000/yr (~$167/mo) | verified on page |
| STACK | https://www.stackct.com/takeoff-and-estimate-pricing/ | $249–299/user/mo | verified on page; sells to suppliers/distributors directly |
| ProyecPro (LatAm, ES) | https://proyecpro.com/software-para-la-construccion/ | USD $118 / $223 / $396/mo | verified on page — proves LatAm pays USD 100–400/mo |
| SICAR Materiales (MX) | https://www.sicar.mx/sistema-materiales-construccion | MXN $4,940 one-time (~US$270), "sin rentas mensuales" | verified on page — evidence of LatAm subscription resistance |
| Houzz Pro / Buildertrend | houzz.com/houzz-pro/pricing · buildertrend.com/pricing/ | pricing gated (demo) | verified gated |
| Nuqlea (AR) | https://www.nuqlea.com/blog/plataforma-calcular-materiales-construccion-gratis | free (marketplace-funded) | snippet — free-alternative threat |

**Gap found (inferencia from research):** no LatAm player combines white-label branding + configurable panel/BOM calculator + PDF + WhatsApp export for distributors.

## Price anchor
- Single SMB distributor: **US$99–149/mo** flat (unlimited quotes, catalog, PDF + WhatsApp).
- White-label / multi-dealer tier: **US$199–399/mo** (Clear Estimates Franchise precedent: ~3× base).
- Entry floor US$49–79/mo where subscription resistance is high.

## Revenue paths (post-packaging)
1. **Manufacturer-pays white-label** (the durable wedge per research): panel/steel manufacturers license the branded calculator and subsidize dealer seats — BMC itself is the reference customer. US$199–399/mo per manufacturer + per-dealer seats.
2. **Direct distributor SaaS** at US$99–149/mo — thinner economics, currency exposure (ARS/UYU/COP).
3. **Add-on: PDF quote-template engine** (catalog candidate #5, composite 3.50) sold as a module/API to adjacent software (`buildQuotationModel()` decouples data from layout — hecho confirmado).

## Biggest risk
LatAm SMB distributors' structurally low willingness to pay recurring USD for quoting alone — SICAR wins advertising "one-time payment", and Excel + WhatsApp is the incumbent workflow. Mitigation = manufacturer-pays model. Secondary (internal): catalog data quality needs a validation layer (issue #358 price inversion, verbatim from Matriz — hecho confirmado).

## Next step (one, concrete)
Draft a 1-page manufacturer-pays pitch and validate it with ONE non-competing panel manufacturer in Uruguay/Argentina (BMC's own Matriz→catalog ingestion path is the demo). No code needed yet.
