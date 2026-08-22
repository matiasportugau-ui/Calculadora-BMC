# Brief: Configurable AI sales-chatbot template — construction e-commerce

**Run 2026-W27 · composite 3.50 · packaging: GPT-agent-template · anchors on pre-explored direction #3 (GPT chatbot template)**

## Asset
Shared agent brain across chat/ML/WA channels (`server/lib/agentCore.js`, Anthropic+OpenAI provider chain), tool registry with **live quoting** via calc loopback (`agentTools.js`, `calcLoopbackClient.js`, provenance `source:"ae_agent"`), SSE chat route (`agentChat.js`), training-correction loop (`agentTraining.js`, per-message Good/Correct), auto-learn KB extraction — hecho confirmado. Differentiator: the bot produces **priced quotations (BOM + PDF)**, not FAQ answers.

## Comparables (verified 2026-07-03)
| Product | URL | Price | Note |
|---|---|---|---|
| Chatbase | https://www.chatbase.co/pricing | $32 / $120 / $400/mo — verified on page | horizontal default |
| SiteGPT | https://sitegpt.ai/pricing | $39 / $79 / $259/mo — verified on page | price floor |
| CustomGPT.ai | https://customgpt.ai/pricing/ | $99 / $499/mo (white-label) — verified on page | white-label precedent |
| Intercom Fin | https://www.intercom.com/pricing | **$0.99 per resolved outcome** — verified on page | outcome-pricing benchmark |
| Botpress | https://botpress.com/pricing | Plus $89/mo; Team $495/mo — from search snippet (page 403s to bots), official blog | WhatsApp channel comp |
| Voiceflow | https://www.voiceflow.com/pricing | pricing gated (demo) — verified gated | agency-build end |

**White space (hecho confirmado via WA-cockpit research):** none of the verified WhatsApp/chatbot comps ship an AI agent that produces priced product quotations (BOM + PDF) — they do lead qualification and FAQ deflection.

## Price anchor
- Self-serve: **$99–499/mo; sweet spot $149–299/mo** + one-time setup/white-label fee **$500–1,500** (per-merchant quoting config is the part Chatbase can't replicate).
- Outcome-based upsell: **$0.50–1.00 per generated quote** (Fin-style secondary axis).

## Revenue paths (post-packaging)
1. **Vertical template + setup service** for construction e-commerce (Shopify/Tiendanube stores): $149–299/mo + setup fee.
2. **Quote-per-outcome pricing** layered on merchants with volume.
3. **Bundle with #6 (WA Cockpit)**: chat agent as the AI tier of the WhatsApp cockpit — the combination is the actual moat (quote + WhatsApp handoff in one flow).

## Biggest risk
Horizontal commoditization: any retailer can upload a PDF catalog to Chatbase/SiteGPT for $39–120/mo and get 80% of a chatbot; platform-native AI assistants are being bundled into Shopify/WhatsApp. The chat wrapper has near-zero moat — survival depends on the calc engine, curated Spanish construction KB, and WhatsApp handoff being clearly superior. Also material: de-BMC-ification effort is the heaviest of the top candidates (effort score 2 — prompts, KB, and tools all assume the BMC catalog, inferencia).

## Next step (one, concrete)
Define the minimal per-merchant config surface (catalog source, prompt pack, tool allowlist) as a spec — one doc, no code — and price a pilot with one non-BMC construction store to test the setup-fee model.
