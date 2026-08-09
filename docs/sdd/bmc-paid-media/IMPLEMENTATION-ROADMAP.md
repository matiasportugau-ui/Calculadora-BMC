# Implementation roadmap — BMC Paid Media

Derived from SDD §11.1. Order is dependency-aware.

## P0 — Measurement & truth (this week)

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| 1 | Confirm Meta system-user token LIVE in prod | Matias + bootstrap script | Hub Meta freshness LIVE |
| 2 | Google OAuth smoke: list customers + report `8607757427` | Eng | `/api/ads` report 200 |
| 3 | Inventory `conversion_action` + Meta pixel events | Eng | Doc in evidence/ |
| 4 | Verify lead-event volume vs ad clicks 7d | Matias/Eng | Ratio table exists |
| 5 | **No budget scale** if tracking red | Matias | Policy followed |

## P0 — Ops ritual

| # | Task | Owner |
|---|------|-------|
| 6 | Run `/digital-marketing-agent` 7d Meta+Google | Agent + Matias |
| 7 | Apply ≤5 P0 actions (pause waste) with dry-run | Matias |

## P1 — Product parity

| # | Task | Owner |
|---|------|-------|
| 8 | Hub **Ads · Google** tab (mirror Meta scorecards) | Eng |
| 9 | Cross-channel scorecard component | Eng |
| 10 | Offline conversion upload from lead-event | Eng |
| 11 | Restructure live campaigns to taxonomy §10b | Matias |

## P2 — Hardening

| # | Task |
|---|------|
| 12 | Meta mutation dry-run API |
| 13 | `ads` identity module |
| 14 | Report caching + rate-limit guards |
| 15 | Golden tests for null≠0 and range KPIs |

## Explicitly not in roadmap until human decides

- Pay Google/Meta invoices  
- Reactivate historical Shopping without tracking green  
- Policy Manager appeals  
- Shared-card billing redesign  
