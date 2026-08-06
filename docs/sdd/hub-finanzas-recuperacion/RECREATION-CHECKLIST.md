# Recreation checklist — Hub Finanzas Recuperación

- [ ] Route `/hub/finanzas/recuperacion` in `FinanzasModule.jsx`
- [ ] `GET /api/banco/recovery-snapshot` returns 401 without auth
- [ ] Same route 403 when finanzas locked (non-dev)
- [ ] `PUT /api/banco/recovery-snapshot` stores valid payload
- [ ] Invalid payload → 400
- [ ] UI renders KPI + 4 charts from API (no hard-coded money)
- [ ] `node scripts/publish-recovery-snapshot.mjs` can push local data.json
- [ ] Prod smoke: unlock → open recuperacion → as_of matches publish
