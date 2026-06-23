# Squad Reliability — M2–M4

**Owner:** Channels lead (`bmc-api-contract`, `bmc-mercadolibre-api`)  
**Scope:** ML post-shadow (M1 = C1 in WAVE 2). **M3 excludes UI read flip** (needs D1+G1 → WAVE 4/5).

---

## Items

| ID | Deliverable | Command / file | Validation |
|----|-------------|----------------|------------|
| M2 | ML CRM backfill | `npm run omni:backfill-ml-crm` | dry-run; open queue ≈ omni |
| M3 | ML parity | `tests/omniMlParity.test.js` | &gt;99%; no `VITE_OMNI_INBOX` |
| M4 | Channel reconcile | `npm run omni:reconcile-channels` | drift &lt;10 rows |

**Order:** M2 → M3 → M4

---

## M4 dual-write policy

- Sheets `ml-crm-sync` continues (M4)
- Omni is read-optimized mirror
- Do NOT stop `syncMLCRM` until finance sign-off

---

## Rollback

Delete backfill rows: `metadata->>'source' = 'ml_backfill'`  
Shadow flags off: RB-OMNI-001 in [20-operational-readiness.md](../20-operational-readiness.md)
