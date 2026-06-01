# promptfoo Evals for Presupuestacion Orchestrator

This directory contains regression and quality evals for the `presupuestacion-orchestrator` Grok skill and its sub-agents.

## Structure
- `presup-orchestrator.yaml` — Main config (Pricing Reviewer + Document Gatekeeper gates)
- Prompts canónicos en [`server/prompts/presup-orchestrator/`](../../server/prompts/presup-orchestrator/) (referenciados vía `file://` en el YAML)

## How to run (local dev)

Secrets are managed in Doppler (`bmc-frontend/prd`). Plain `.env` does **not** contain the real `ANTHROPIC_API_KEY`.

```bash
# From repo root — use Doppler to inject secrets
doppler run -- npx promptfoo eval \
  -c evals/promptfoo/presup-orchestrator.yaml \
  --no-cache

# Open results UI (after a run)
npx promptfoo view
```

## Current Coverage (Phase A starter)
- **Pricing & BOM Reviewer** — Detects price anomalies, excessive discounts, zone/type coherence.
- **Document Gatekeeper** — Validates layout (simple-carbon), quoteId/version presence, completeness, and visual quality signals.

## Expansion Plan
As the orchestrator skill matures, add:
- Intake & Classification gate
- Context Builder / RAG relevance
- Approval Router decision quality
- End-to-end flow regression (multi-step tests)

## CI / Gate Usage
These evals are **not** part of `gate:local` (they have cost and require Anthropic keys).  
Run them manually before promoting changes to orchestrator prompts or sub-agent logic.

Example in a workflow (GitHub Actions or manual):
```yaml
- name: Orchestrator prompt regression
  run: |
    # Doppler token must be available as DOPPLER_TOKEN secret in the runner
    doppler run -- npx promptfoo eval \
      -c evals/promptfoo/presup-orchestrator.yaml \
      --no-cache --output evals/promptfoo/results/presup-$(date +%Y%m%d).json
```
Note: For CI you will need a Doppler Service Token with read access to `bmc-frontend/prd`.

## Notes
- Always use the same provider ordering philosophy as `aiProviderConfig` (prefer high-quality first for gates).
- Tests should reflect real Spanish business language and USD pricing.
- Add `llm-rubric` asserts liberally — they are the best proxy for "does this feel like a good BMC reviewer?"

This eval set is part of Phase A of the presupuestacion-orchestrator bootstrap (feature-freeze safe work).