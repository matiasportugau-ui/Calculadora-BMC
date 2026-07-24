# Ideal 100% — Meta Ads Live Report (post PR1–PR3)

## Target composite: 100 (pass ≥90)

## System class

**Shipped feature slice** inside Calculadora BMC Marketing Hub: multi-source MetaAdsReport (Demo / Snapshot / Live Graph fail-open) + grounded AI insights/chat + admin Hub tab.

Ideal is as-built documentation that matches `main` after **#753, #762, #764, #767**, plus honest secrets ops status.

## Must-have artifacts

| Artifact | Ideal |
|----------|--------|
| `SDD.md` | Status As-Built; no PROPOSED labels on shipped APIs/UI |
| `schemas/MetaAdsReport.schema.json` | Present (done) |
| `RECREATION-CHECKLIST.md` | PR1–PR3 items checked or N/A |
| `docs/procedimientos/META-ADS-SETUP.md` | Present (done) + bootstrap script linked |
| `evidence/index.md` | Re-tag CONFIRMED for shipped paths; path:line refreshed |
| `SDD-AS-BUILT.md` | Merged or superseded note pointing to main SDD |
| ADR for fail-open Live + range integrity | Documented |

## Section-specific ideal

### §1 Problem
State shipped capability; residual gap is **prod secrets / real LIVE ops**, not missing client code.

### §2 Evidence tags
Routes, tab `ads-meta`, fixture, metaAdsClient = **CONFIRMED** with current path:line.

### §5 Containers
Remove PROPOSED on MetaAdsLiveReport / marketing routes / fixture.

### §8 Deployment
Document `scripts/meta-ads-bootstrap-auto.sh`, Doppler `prd`, GSM names `meta-ads-*`, Cloud Run `panelin-calc`, fail-open without secrets.

### §10 ADRs
Add observed ADR: Live fail-open; range-aware KPIs (#767).

### §11 Risks
Update “push PR3 Live” → “provision META_ADS_* + redeploy”.

## Acceptance test

> An engineer rebuilds mental model from SDD alone and correctly expects: Demo/Snapshot without secrets; LIVE only with Graph success; AI grounded on DTO; no Page token for ads.

## Pass bar (≥90) for this iteration

Close **evidence drift** (G-01/G-02): retag API appendix + §1 problem + host tabs evidence. That alone should restore **pass ≥90**.
