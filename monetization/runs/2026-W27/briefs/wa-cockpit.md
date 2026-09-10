# Brief: WA Cockpit — WhatsApp team inbox + AI quoting for LatAm SMBs

**Run 2026-W27 · composite 3.25 · packaging: SaaS**

## Asset
WhatsApp Cloud API cockpit: own Postgres migrations + ledger (`wa-package/`, `wa_schema_migrations`), routes (`server/routes/wa.js`), operator auth (`waOperatorAuth.js`), soak-tested queue (migration 014 + WA soak runbook, latest commit 7b0d3a2) — hecho confirmado. Caveat: entangled with Sheets CRM flows (mixed route in issue #517) — hecho confirmado.

## Comparables (verified 2026-07-03)
| Product | URL | Price | AI? |
|---|---|---|---|
| Wati | https://www.wati.io/pricing/ | $29 / $49 / $99/mo (annual) — verified on page | AI agents bundled from Pro |
| Callbell | https://www.callbell.eu/en/pricing/ | $15–20/user/mo + WA credits ~$54/mo — verified on page | AI only at Enterprise |
| Leadsales (MX) | https://leadsales.io/en/pricing/ | $97 / $133 / $247/mo — verified on page | rule-based bot only |
| B2Chat (CO) | https://www.b2chat.io/en/pricing/ | $105 / $187/mo with WA — verified on page | AI add-on $80–86/mo |
| Cliengo (AR) | https://www.cliengo.com/pricing | $45 / $119 / $259/mo — verified on page | AI Copilot all plans |
| Zenvia (BR, ex-Sirena) | https://zenvia.com/es-mx/precios/ | $130 / $390 / $845/mo — verified on page | generative AI from Specialist |
| Whaticket | https://whaticket.com/precios/ | $49 / $109/mo — verified on page | BYO OpenAI tokens |
| Trengo | https://trengo.com/pricing | €299–499/mo — verified on page | AI surcharge €0.25–0.30/conv |

**White space (hecho confirmado from research):** none of the verified comps ship an AI agent producing priced quotations — they qualify leads and deflect FAQs. AI consistently commands a +$80–130/mo premium.

## Price anchor
**$150–300/mo flat for a 3–5 agent team** (crowded center of the LatAm market is $100–190/mo; AI-quoting justifies the premium), or ~$25–40/agent + AI usage. Above ~$400/mo you fight Zenvia/Trengo enterprise features.

## Revenue paths (post-packaging)
1. **Vertical cockpit** for construction/materials sellers, bundled with candidate #4 (the AI quoting agent) — differentiation the horizontals lack.
2. **Per-agent seats + AI usage fee** on top of a base plan.
3. **White-label to agencies** managing WhatsApp sales for multiple LatAm SMBs.

## Biggest risk
Dependence on Meta's WhatsApp Business API pricing/policy — the July 2025 shift to per-template-message pricing and unilateral per-country rate changes can invalidate unit economics overnight; every comp passes this through as opaque "credits". Secondary: this is the most crowded of the five candidate markets AND the asset needs unbundling from BMC's Sheets CRM (effort score 2).

## Next step (one, concrete)
Map the unbundling surface: list every `server/routes/wa.js` dependency on Sheets/CRM (issue #517 is the known one) to size a standalone deployment — read-only analysis, one doc.
