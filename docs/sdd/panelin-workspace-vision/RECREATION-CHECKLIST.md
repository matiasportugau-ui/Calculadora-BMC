# Recreation Checklist — panelin-workspace-vision

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Store-centric SDD §1–12 | ✅ | `SDD.md` v1.0 |
| 2 | Mockups example-only | ✅ | SDD §1, Appendix A |
| 3 | customers table + API | ✅ | 002 + `/api/workspace/customers` |
| 4 | quotes table + API | ✅ | 002 + `/api/workspace/quotes` |
| 5 | files links + kind | ✅ | 002 + workspaceStore.createFile |
| 6 | CR type quote | ✅ | CHECK extended in 002 |
| 7 | Store get-after-set tests | ✅ | `tests/workspace-store.test.js` 4/4 + evidence log |
| 8 | HTTP API get-after-set tests | ✅ | `tests/workspace-api-store.test.js` 4/4 + evidence log |
| 9 | Migrate command | ✅ | `npm run workspace:migrate` |
| 10 | Score ≥90 | ✅ | SCORECARD composite 93 |
| 11 | Gate evidence pack | ✅ | `evidence/GATE-NOTE.md` + logs |
| 12 | SPA full vision UI | ⚠️ P2 | Full mockup still open |
| 13 | SPA store wire (customers/quotes/files) | ✅ MVP | `panelin-workspace` `/workspace/store` + API client |

**Score:** 12/13 solid → recreation-ready for **store** + MVP SPA wire.
