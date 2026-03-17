# BMC Dashboard One-Click Setup — Reference

## Script Options

| Option | Effect |
|--------|--------|
| (none) | Full setup: env, deps, start API, optional ngrok |
| `--check-only` | Validate config only; do not start services |
| `--no-ngrok` | Skip ngrok tunnel |

## Env Template

```env
VITE_GOOGLE_CLIENT_ID=642127786762-a5vph6mfgf16qqv3c125cuin4dge6d6b.apps.googleusercontent.com
VITE_API_URL=http://localhost:3001
BMC_SHEET_ID=1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
ML_CLIENT_ID=...
ML_CLIENT_SECRET=...
ML_REDIRECT_URI_DEV=https://xxx.ngrok-free.dev/auth/ml/callback
```

## Verification Endpoints

| Endpoint | Expected |
|----------|----------|
| `GET /health` | `{ ok: true, hasTokens: ..., missingConfig: [] }` |
| `GET /api/cotizaciones` | `{ ok: true, headers: [...], data: [...] }` |
| `GET /api/proximas-entregas` | Array of delivery rows |
| `GET /api/audit` | AUDIT_LOG rows |

## Version Bump Examples

```bash
./scripts/bump_version.sh patch "Fix typo in dashboard"
./scripts/bump_version.sh minor "Add one-click setup"
./scripts/bump_version.sh major "Breaking: remove legacy quote API"
```

## Phase Checklist (Apps Script)

Before one-click setup works end-to-end:

1. **Phase 1:** Code.gs + DialogEntregas.html in Apps Script; run `runInitialSetup`; run `migrateTwoRecords`.
2. **Phase 2:** Triggers: autoUpdateQuotationStatus, sendQuotationAlerts, onEdit, sendPendingPaymentsUpdate (Mon/Thu/Fri).
3. **Phase 3:** Sheets API server + dashboard (handled by `run_dashboard_setup.sh`).
4. **Phase 4:** Audit log tab, permissions, notifications (optional).
