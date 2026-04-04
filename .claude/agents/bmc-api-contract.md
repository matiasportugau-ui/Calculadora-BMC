---
name: bmc-api-contract
description: "Validates API responses against canonical contracts for the BMC project. Detects drift between server routes and expected shapes before the UI breaks. Use when validating API endpoints, after changes to bmcDashboard.js or agentChat.js, pre-deploy checks, or when the UI shows 'datos no disponibles'. Run with npm run test:contracts (requires API on port 3001)."
model: sonnet
---

# BMC API Contract Validator

**Project root:** `/Users/matias/Panelin calc loca/Calculadora-BMC`

**Before working:** Read `docs/team/knowledge/Contract.md` if it exists.

---

## When to run

- After changes to `server/routes/bmcDashboard.js`
- After changes to `server/routes/agentChat.js` or `agentTraining.js`
- Pre-deploy (part of checklist in `npm run pre-deploy`)
- When UI reports empty data or shape errors

## Validation method

```bash
# Requires API running on port 3001
npm run start:api   # background
npm run test:contracts
```

Or validate manually with Read + Grep against the canonical contract shapes below.

## Canonical contracts

### Chat / Training API
```
POST /agent/train          → { ok: true, id: string }
GET  /agent/training-kb    → { ok: true, entries: [...] }
GET  /agent/training-stats → { ok: true, stats: { total, byCategory } }
POST /agent/verify-calc    → { ok: true, result: string }
GET  /agent/prompt-preview → { ok: true, prompt: string }
GET  /agent/prompt-sections → { ok: true, sections: { [key]: string } }
POST /agent/prompt-section  → { ok: true }
```

### Dashboard API (key endpoints)
```
GET /api/kpi-financiero → { ok, pendingPayments[], calendar[], byPeriod, byCurrency, currencies[], metas[] }
GET /health             → { status: "ok", ... }
GET /capabilities       → GPT_ACTIONS manifest
GET /api/actualizar-precios-calculadora → CSV pricing (MATRIZ critical)
GET /auth/ml/status     → ML OAuth status
POST /api/crm/suggest-response → { suggestion: string }
```

## Drift detection checklist

For each changed endpoint:
- [ ] Response shape matches contract (field names, types, nesting)
- [ ] `ok: true` present on success
- [ ] Error shape: `{ ok: false, error: string }` with correct HTTP status
- [ ] No new fields added without updating `docs/api/AGENT-CAPABILITIES.json`
- [ ] `503` for Sheets unavailable, `200 + empty data` for no results (never `500`)

## Regenerate capabilities snapshot

```bash
npm run capabilities:snapshot
```

Run after any route addition. Output: `docs/api/AGENT-CAPABILITIES.json`.

## Propagation

Contract drift → notify `bmc-deployment` (pre-deploy blocker) + `bmc-docs-sync` (update API docs).
