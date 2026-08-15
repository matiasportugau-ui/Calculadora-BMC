# TARGET — Paid Comprador + White-Label Presupuestos

**Ideal 100%** vs **v1 MVP (this SDD)**. Implementers ship v1 only unless a later ADR opens the next row.

| ID | Ideal 100% | v1 (Accepted-for-build) | Deferred |
|----|------------|-------------------------|----------|
| T1 | Self-serve checkout (Mercado Pago / Stripe) + invoice | Manual `plan_tier` PATCH / SQL | Payment gateway |
| T2 | Granular plans (trial, seats, yearly) | Single `paid` value | Billing catalog |
| T3 | Multi-tenant price lists / reseller margin | BMC LISTA_ACTIVA only; BMC sees margin | Custom catalogs |
| T4 | White-label entire SPA (domain, colors, nav) | Client PDF/WA only | Full tenant theme |
| T5 | Logo version history + virus scan | Overwrite one GCS object; MIME + size | Malware pipeline |
| T6 | Snapshot immutability via DB trigger + legal hold | App guard + tests | Trigger + retention policy |
| T7 | Sheets tab auto-provision | Flag off; human creates tab | Admin “create tab” |
| T8 | `plus` includes white-label | `plus` = CRM Plus only; white-label = `paid` | Bundle SKUs |
| T9 | Panelin can generate white-label PDF | No new agent tools | ADR-008 revisit |
| T10 | Public calc optional paid wall | Public `/` always open | Gated SKU |

**v1 done when** SDD §13 Success Criteria are green on branch `feat/paid-white-label-presupuestos` and a PR exists (unmerged).
