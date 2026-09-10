# Brief: BMC_KB B2B API — vertical RAG retrieval for construction products

**Run 2026-W27 · composite 3.75 · packaging: API · anchors on pre-explored direction #2 (BMC_KB B2B API)**

## Asset
Provider-agnostic RAG stack: `server/lib/rag.js` + `embeddings.js` (pgvector cosine), KB with own migrations (`kb-package/`), surface + analytics (`kbSurface.js`, `kbAnalytics.js`), auto-learn loop (`autoLearnExtractor.js`) — hecho confirmado. The sellable asset is the **curated Spanish-language construction KB + pricing logic**, not the retrieval plumbing.

## Comparables (verified 2026-07-03)
| Product | URL | Price | Side |
|---|---|---|---|
| CustomGPT.ai | https://customgpt.ai/pricing/ | $99/mo Standard; $499/mo Premium (white-label); enterprise ~$2k–6k/mo — verified on page | closest comp spanning KB chatbot + RAG API |
| DocsBot AI | https://docsbot.ai/pricing | $49 / **$149 (API starts here)** / $499/mo — verified on page | chatbot + Q&A API bundle |
| Pinecone Assistant | https://www.pinecone.io/pricing/ | $20–500/mo min + usage ($8/M input, $15/M output tokens) — verified on page | floor benchmark: retrieval plumbing costs cents |
| Vectara | https://www.vectara.com/pricing | from **$100K/yr** SaaS — verified on page | enterprise ceiling for RAG-as-a-service |
| Chatbase | https://www.chatbase.co/pricing | $32 / $120 / $400/mo — verified on page | horizontal pressure |

## Price anchor
- Per-query: **$0.05–0.25** (Pinecone puts raw retrieval at low single-digit cents — premium must come from the curated data).
- Subscription: **$99–299/mo** with 1,000–10,000 included queries, +$50–100 per extra 1k.

## Revenue paths (post-packaging)
1. **B2B API for construction e-commerce** (product specs, technical Q&A, pricing logic) — key-metered, on existing JWT/auth primitives (`identityAuth.js` — hecho confirmado).
2. **KB-as-data-product**: license the curated corpus to LatAm building-materials marketplaces or the candidate-#4 chatbot installations.
3. **Powering tier**: bundled retrieval backend for candidates #1 and #4 (internal reuse first, external second).

## Biggest risk
Thin buyer pool: a construction-specific KB API has few natural customers, and horizontal tools let anyone upload a PDF catalog for $39–120/mo. Enterprise buyers who'd pay real money demand data-licensing/liability guarantees that are expensive to provide — duda abierta whether standalone demand exists at all; safest as the data layer inside #1/#4 until a first external buyer appears.

## Next step (one, concrete)
Identify 3 concrete prospective buyers (LatAm construction e-commerce / marketplaces) and pitch a paid pilot of the API before building any external-facing surface — demand validation first.
