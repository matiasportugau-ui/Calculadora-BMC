# AUTOTRACE — Unreleased

Vista incremental desde el índice de commits documentados (no reemplaza `docs/CHANGELOG.md` manual).

## Features

- `352f730` feat: Enhance WhatsApp integration and add AUTOTRACE system
- `8dc43fd` feat: Enhance WhatsApp integration and add AUTOTRACE system
- `db62c95` feat: Enhance WhatsApp integration and add AUTOTRACE system
- `d8455c0` feat: Enhance WhatsApp integration and add AUTOTRACE system
- `fa2ba6a` feat: Enhance WhatsApp integration and update AUTOTRACE documentation
- `553941e` feat: Enhance WhatsApp integration and update AUTOTRACE documentation
- `57932df` feat: Enhance WhatsApp integration and update AUTOTRACE documentation
- `f3d6153` feat: Enhance WhatsApp integration and update AUTOTRACE documentation
- `5a907b8` feat: Enhance WhatsApp integration and update AUTOTRACE documentation
- `efa9f65` feat: add Sketchfab integration and enhance documentation
- `c7c660b` feat: add Sketchfab integration and enhance documentation
- `f62400e` feat: log Sketchfab integration commit in worklog
- `9a0dc85` feat(roof): auto-default cumbrera on horizontal dos_aguas encounters (Fase 3) `[tests]`
- `04f7b41` feat(roof): auto-default cumbrera on horizontal dos_aguas encounters (Fase 3)
- `6d95be9` feat(roof): render encounter lines as clickable SVG elements
- `fe55309` feat(roof): split border strips by exterior intervals on partial encounters
- `773e0df` feat(catalog): add gotero_frontal to fondo side options for ISODEC/ISODEC_PIR
- `5715776` feat(roof): enhance roof encounter functionality with auto-default cumbrera and SVG rendering
- `acaebad` feat(roof): enhance roof encounter functionality with auto-default cumbrera and SVG rendering
- `391c695` feat(roof): enhance roof encounter functionality with auto-default cumbrera and SVG rendering
- `742293c` feat(roof): enhance roof encounter functionality with auto-default cumbrera and SVG rendering
- `2a3be46` feat: add CalcLogicInspector, FichasPreview, Kingspan comparison + fix fijaciones varilla substrate split `[tests]`
- `cc153d7` feat: add CalcLogicInspector, FichasPreview, Kingspan comparison + fix fijaciones varilla substrate split
- `0ad5d93` feat(wolfboard): add Admin 2.0 ↔ CRM operational module
- `311891a` feat: add contribut and nxt workflow skills for Claude Code + Cursor
- `b33cf43` feat(sheets): Accessible Base sync + expert workspace map
- `7130acd` feat(nxt): wire ROADMAP.md as baseline source + add score history
- `8a30cd2` feat(kb): Accessible Base compiler — AI-optimized KB auto-built on every commit
- `e782464` feat(wolfboard): show origen field in detail panel + AUTOTRACE sync
- `5884c90` feat(ci): add dedicated smoke job for prod API health on main push
- `be2c7ed` feat(wolfboard): origen from CRM column F — enrich pendientes with canal via CRM join
- `e918bef` feat(wolfboard): POST /api/wolfboard/quote-batch — AI batch quoting via Claude Haiku
- `759d82e` feat(wolfboard): POST /api/wolfboard/quote-batch — AI batch quoting via Claude Haiku
- `6949ce3` feat: add BmcAdminCotizacionesModule and integrate into App routing
- `a22ce4e` feat(wolfboard): add pendientes, sync, row, enviados, export routes
- `945e83b` feat(wolfboard): add GET /pendientes, POST /sync, POST /row, POST /enviados, GET /export
- `fdcfbc1` feat(fichas): add Kingspan comparison section (TIPO 5)
- `8ccf8d8` feat: add new JSON files for Admin Cotizaciones, CRM Operativo, KB, and Matriz Precios
- `db0c9ce` feat: wire real calculator engine into quote-batch
- `38dffaf` feat(roof-plan): segment-level encounter selection in 2D plan
- `97123b1` feat(chat): structured request logging — latency, tokens, provider per turn
- `d221654` feat(wizard): add Precio BMC / Web toggle above totals in solo_techo mode
- `3c93ff7` feat: GCS quote storage + SuperAgent tool endpoint
- `aa6d84b` feat(wolfboard): add local dev scripts + rebuild kb.json
- `c8b33e6` feat(wolfboard): add local dev scripts and update kb.json
- `47957df` feat(panelin-internal): RBAC + invoke + tool catalog + orchestrator runbook `[tests]`
- `e7ee3ee` feat(wolfboard): canales hub + admin cotizaciones + AI analytics + quote snapshot
- `732d9a1` feat(roof-plan): panel pick/inspection (T-xx IDs), edge strips outside rect, perimeter lite restore

## Fixes

- `680cf98` fix(docs): correct typo in Atlas Browser Go-Live manual steps prompt title
- `bc5c1fc` fix(docs): update AUTOTRACE documentation to correct typo in Atlas Browser Go-Live manual steps prompt title
- `0a5667b` fix: adjust positioning and dimensions in RoofPreview and RoofPlanDimensions components
- `dec007b` fix: adjust positioning and dimensions in RoofPreview and RoofPlanDimensions components
- `0f9ab57` fix: update positioning and dimensions in RoofPreview and RoofPlanDimensions components
- `54a641f` fix(deps): npm audit fix — patch 7 vulns, remove 5 unused packages
- `6b35de9` fix(deps): npm audit fix — upgrade anthropic SDK, nodemailer, googleapis, vite-plugin-pwa
- `1966b38` fix(lint): resolve all ESLint warnings in new and existing components
- `0437665` fix(wolfboard): Admin 2.0 data starts row 2 (not 3) — confirmed by operator
- `27804a0` fix(wolfboard): correct Admin 2.0 column layout I/J/K/L + setup-admin endpoint
- `845bb68` fix(wolfboard): wire origenEl in detail panel + correct table header labels
- `5d5363c` fix(ci): add .npmrc legacy-peer-deps to unblock vite-plugin-pwa@0.21.2 on vite@7
- `11d1f8c` fix(ml-ui): persist ML token in localStorage instead of sessionStorage
- `7f1c805` fix(kb): score parser — avoid emoji Unicode mismatch in ROADMAP regex
- `5e1c03f` fix: prevent autolog hook self-loop on dev-trace commits
- `38b4d45` fix(docker): copy .npmrc before npm ci to resolve vite-plugin-pwa peer dep conflict
- `28ef700` fix(docker): update .npmrc handling to resolve vite-plugin-pwa peer dependency conflict
- `28507ff` fix(deps): patch HIGH vulns — vite-plugin-pwa@1.2.0 + serialize-javascript override
- `03ce080` fix(server): move wolfboard router before /api catch-all to fix 404s
- `52e394a` fix(calc): make /cotizar/pdf handler async + sync autotrace
- `9e30028` fix(docker): skip bash disk-precheck in Alpine build stage
- `db9b798` fix(superAgent): log Anthropic errors to diagnose failure in production
- `4589d3b` fix(dashboard): promote Claude to #1 AI provider; add /consultations command-center endpoints

## Documentation

- `ed9e830` docs: update PROJECT-STATE and SESSION-WORKSPACE-CRM with recent changes
- `9bbae4b` docs: update PROJECT-STATE and SESSION-WORKSPACE-CRM with recent changes
- `fbc024b` docs: update PROJECT-STATE and SESSION-WORKSPACE-CRM with recent changes
- `fa3e400` docs: update PROJECT-STATE and SESSION-WORKSPACE-CRM with recent changes
- `4a19616` docs: update PROJECT-STATE and SESSION-WORKSPACE-CRM with recent changes
- `8e90b56` docs: dev-trace autolog update (2026-04-23)
- `8c717c5` docs: update AUTOTRACE documentation and add recent commits
- `92a1508` docs: add ROADMAP.md — mission/vision, area scores, prioritized next steps
- `af7b601` docs(roadmap): update score history 76→80 (cm-0+cm-1 done, KB live)
- `7a2d303` docs(ops): cm-2 email ingest prod DONE — todos los gates completos
- `e77b34b` docs: dev-trace autolog update (2026-04-23)
- `543f747` docs: dev-trace autolog update (2026-04-23)
- `3779d80` docs: dev-trace autolog update (2026-04-23)
- `c53c155` docs: dev-trace autolog update (2026-04-23)
- `0f97d63` docs: dev-trace autolog update (2026-04-23)
- `85bc343` docs: update AUTOTRACE documentation and worklog for 2026-04-23
- `b24e8dd` docs: dev-trace autolog update (2026-04-23)
- `8149dc2` docs: dev-trace autolog update (2026-04-23)
- `027b1e1` docs: dev-trace autolog update (2026-04-23)
- `c811945` docs(team): align ROADMAP smoke with PROJECT-STATE Run 2.1 (suggest-only 503)
- `e332a5f` docs(team+agents): PROJECT-STATE, ROADMAP, dashboard modernization, bmc-team-liaison
- `f50973e` docs: sync PROJECT-STATE + kb — suggest-response verde, rev-00210, 370 tests

## Tests

- `3646101` test(encounters): integration tests for per-segment BOM — includeInBom=false and split with different profiles `[tests]`

## Chores

- `3dc1e29` chore(dev-trace): complete AUTOTRACE sync and PROJECT-STATE
- `3390a72` chore(dev-trace): record AUTOTRACE output for traceability commit
- `11d78a6` chore(dev-trace): update AUTOTRACE documentation and status
- `f08ea7c` chore(dev-trace): update AUTOTRACE documentation and status
- `8c00277` chore(ops): Cloud Run 300s timeout; sync dev-trace
- `ef8734c` chore: sync autotrace docs and data version for Sketchfab integration commits
- `bcefb3e` chore(editor): ocultar dev-trace en UI y excluirlo del contexto Cursor
- `6d1e0ac` chore(dev-trace): record autotrace for editor ergonomics commit
- `c57f6f4` chore(dev-trace): refine autotrace logging and documentation updates
- `1306642` chore: add Google Drive OAuth setup scripts and documentation
- `0f3f008` chore: update Google Drive OAuth setup scripts and documentation `[tests]`
- `691b550` chore: add Playwright test script for local roof borders and update Google Drive OAuth documentation `[tests]`
- `3b8fb3d` chore(dev-trace): record AUTOTRACE for 742293c roof encounter enhancement
- `826b9c4` chore(dev-trace): record AUTOTRACE for 3b8fb3d dev-trace commit
- `fb845a2` chore(dev-trace): sync AUTOTRACE bundle — close self-ref loop
- `136482c` chore(dev-trace): sync AUTOTRACE bundle pre-merge
- `890d2c7` chore: sync calculatorDataVersion timestamp + AUTOTRACE post-session
- `d83ca03` chore: update AUTOTRACE documentation and sync calculatorDataVersion timestamp
- `63c1410` chore: update AUTOTRACE documentation and sync calculatorDataVersion timestamp
- `ee74167` chore: post-live-test state — Wolfboard + Accessible Base first sync
- `13e4393` chore: Cloud Run deploy 00191-tvb + AUTOTRACE sync
- `27139d5` chore(dev-trace): sync autotrace + accessible-base for ml-ui token fix
- `792cf98` chore(dev-trace): sync AUTOTRACE for wolfboard local dev commit c8b33e6
- `07a5a8d` chore(dev-trace): record AUTOTRACE for commit 792cf98
- `53b3a60` chore(dev-trace): record AUTOTRACE for commit 07a5a8d
- `d33a49c` chore(dev-trace): record AUTOTRACE for docs ROADMAP smoke alignment (c811945)
- `c7cd9a3` chore(dev-trace): record AUTOTRACE for dev-trace commit d33a49c
- `f7e8016` chore(tooling): bmc-dev-verify, playwright smoke, accessible-base sync, config + gcsUpload
- `4eccf4b` chore(kb): rebuild accessible-base kb.json post-commit batch
- `5a52c84` chore(dev-trace): AUTOTRACE post-batch 2026-04-24
- `5df16b5` chore(dev-trace): final AUTOTRACE cleanup 2026-04-24
- `088bbb3` chore(dev-trace): AUTOTRACE 5df16b5
- `904af8c` chore(dev-trace): AUTOTRACE final batch [SKIP_AUTOTRACE]
- `425f2c9` chore(scripts): accessible-base sync + build tooling updates
- `95f4d8d` chore(dev-trace): rebuild kb + autotrace post-commit batch
- `5551486` chore(dev-trace): autotrace + kb rebuild post-session
- `59f0f13` chore(dev-trace): cleanup post-session + kb state [SKIP_AUTOTRACE]
- `6ca6d7e` chore(dev-trace): AUTOTRACE post-docs-sync [SKIP_AUTOTRACE]

## Other

- `fd9c93a` other: Update documentation and tests for AUTOTRACE and add new reference materials `[tests]`
- `386507c` other: Merge branch 'main' of https://github.com/matiasportugau-ui/Calculadora-BMC
