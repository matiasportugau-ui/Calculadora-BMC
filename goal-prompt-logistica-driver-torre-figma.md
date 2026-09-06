# Role
You are a senior full-stack + SDD engineer on Calculadora-BMC. You continue BMC Logística as **one product**: operator plans the route in `/logistica`, BMC Driver (`/conductor`) consumes that feed, Torre (`/logistica?vista=torre`) reads the same `trip_events`. You lock the Driver spec, design the five Outdoor Night screens in Figma via **official** Figma MCP, implement them in the PWA bound to the live trip API, and verify the loop is functional.

# Context
[CONFIRMED: Primary repo is `~/calculadora-bmc` / `matiasportugau-ui/Calculadora-BMC`. Working copy at session start was on `feat/storefront-voice-modes-demo` with unrelated voice/trucker dirty files — **do not use that branch**.]
[CONFIRMED: One product, three surfaces. Parent TARGET `docs/sdd/bmc-logistica/TARGET.md`: operator builds the envío in `/logistica` → Confirmar / Asignar a chofer emits `driver_url` `/conductor?t=` → chofer runs BMC Driver PWA → customer sees only `/seguimiento/:token`.]
[CONFIRMED: Join path is `POST /api/repartos/:id/confirm` → `joinRepartoToTrip` (`server/lib/repartoTripBridge.js`, `server/routes/repartos.js`) returning `driver_url` on the SPA. Driver session loads trips via `GET /api/driver/trips` in `src/components/driver/useDriverSession.js`. Events go `POST /api/driver/events`. Torre Fase 1 is `GET /api/torre/live` + GPS `location_ping` (`docs/sdd/bmc-control-tower/TARGET.md` T1–T4).]
[CONFIRMED: Driver routes already exist: `src/App.jsx` `/conductor/*` lazy `DriverApp.jsx`; tabs Inicio / Carga / Listo / Perfil; tokens `src/styles/bmc-driver.css` (`--drv-bg #07111f`, `--drv-orange #f15a24`, `--drv-cta-h 52px`).]
[CONFIRMED: Visual rebuild kit (not the old JPGs) lives at `docs/sdd/bmc-driver-loop/evidence/svg-kit-2026-09-06/` — five 390×844 Outdoor Night SVGs + board + `index.html`. Demo copy is Montevideo→Pando, REP-0248, UY stops.]
[CONFIRMED: Official Figma MCP is the write path. Session file https://www.figma.com/design/iGZDe5LeC2ZDOdjbB3uH9q (`fileKey` `iGZDe5LeC2ZDOdjbB3uH9q`), Session Board node `15:2`. Seat was Pro · Full this session. Private `figma-grok-bridge` is fallback only.]
[INFERRED: `DESIGN-UI.md` tab maps (Viajes/Historial/Mapa/Documentos and `+` FAB) are stale vs live `DriverApp` + SVG kit | basis: DESIGN-UI §2.2/2.4 vs `DriverApp.jsx` routes and svg-kit screens.]
[INFERRED: Driver must not invent route geometry or cargo — those fields come from confirmed REP `plan_snapshot` | basis: user constraint + logistica TARGET + `DriverHome.jsx` already reading `plan.reparto_no` / stops.]

# Goal
Ship a spec-driven, Figma-designed, API-wired BMC Driver PWA that displays **the route feed produced by `/logistica`**, posts factory/delivery events that Torre can see, and matches the Outdoor Night kit at 390×844.

- Create a clean branch from `origin/main` named `feat/logistica-driver-figma-loop` (do not commit storefront-voice WIP).
- Lock SDD: patch `docs/sdd/bmc-driver-loop/DESIGN-UI.md` and `TARGET.md` so tab map = Inicio/Carga/Listo/Perfil, Listo has the same tab bar, D7 = Driver screens bind `GET /api/driver/trips` / `plan_snapshot` (logistics feed), JPG pack is not SoT, SVG kit is visual SoT.
- Design in Figma (official MCP, fileKey `iGZDe5LeC2ZDOdjbB3uH9q`): five 390×844 frames + a board, tokens as variables, one tab bar, UY demo labels only as **sample content** with a note that live data replaces them.
- Implement `/conductor` UI to those frames: punch-list (tab on Listo; Carga counter = current step; CTA = current FSM event; split “Ver remitos” vs “Inicio”; real placeholders; drop or “Próximamente” Carga 3D/Mapa; no fake iOS chrome in the PWA).
- Keep wiring: magic `?t=` + `GET /api/driver/trips`; factory events `factory_arrived` / `load_started` / `load_completed` / `factory_departed`; evidence upload unchanged.
- Verify confirm → `driver_url` → driver lists that trip → an event is visible to Torre live / `trip_events` (`tests/logisticaE2e.test.js` and/or `repartoTripBridge.test.js`).
- `npm run gate:local`; write `docs/team/HANDOFF-YYYY-MM-DD-logistica-driver-figma.md` with Figma node IDs and remaining gaps.

# Scope
IN: Driver SDD/DESIGN-UI/TARGET; Figma frames in the Grok Session file; `src/components/driver/**` + `src/styles/bmc-driver.css`; tests that prove logistics→driver→torre feed; handoff.
OUT: Native iOS/Android; auto-WA to customers; rewriting packing/Tetris/wizard (`cargoPacking`, `tetrisPack`, `BmcLogisticaApp` ops chrome); El Transportador / Grok Voice; Torre T5–T8 (roster, Order ID, Torre agent); storefront-voice branch work; Applied AI or Liquid Glass on Driver; BA–Córdoba fiction; private Figma plugin bridge unless official `use_figma` is quota-blocked; customer `/seguimiento` redesign; Doppler/secret rotation.

# Inputs
- Repo: `~/calculadora-bmc` [CONFIRMED]
- Branch to create: `feat/logistica-driver-figma-loop` from `origin/main` [ASSUMPTION: name | verify not already used]
- Parent spec: `docs/sdd/bmc-logistica/TARGET.md` [CONFIRMED]
- Driver spec: `docs/sdd/bmc-driver-loop/{SDD.md,DESIGN-UI.md,TARGET.md}` [CONFIRMED]
- Visual kit: `docs/sdd/bmc-driver-loop/evidence/svg-kit-2026-09-06/` [CONFIRMED]
- Torre spec: `docs/sdd/bmc-control-tower/TARGET.md` [CONFIRMED]
- Join: `server/lib/repartoTripBridge.js`, `server/routes/repartos.js` [CONFIRMED]
- Driver UI: `src/components/driver/DriverApp.jsx`, `DriverHome.jsx`, `useDriverSession.js`, `DriverProfile.jsx` [CONFIRMED]
- Driver API: `server/routes/transportista.js` (`/api/driver/*`), `server/lib/driverAuth.js` [CONFIRMED]
- Tokens: `src/styles/bmc-driver.css` [CONFIRMED]
- Figma fileKey: `iGZDe5LeC2ZDOdjbB3uH9q` · board `15:2` [CONFIRMED]
- Figma skills: `~/.grok/installed-plugins/mcp-server-guide-dc7d2988/skills/figma-use/SKILL.md` and `figma-generate-design/SKILL.md` [CONFIRMED]
- Prod refs: `https://calculadora-bmc.vercel.app/logistica`, `/conductor`, `/logistica?vista=torre` [CONFIRMED]
- Tests: `tests/logisticaE2e.test.js`, `tests/repartoTripBridge.test.js`, `tests/choferRoster.test.js` [CONFIRMED]

# Tools & MCPs
- File + bash: git, npm, tests. Cwd **must** be `~/calculadora-bmc`.
- Official Figma MCP (`figma`): `whoami` first; then `use_figma` with `skillNames` including `figma-use` and `figma-generate-design`. Prefer `createNodeFromSvg` for kit icons/screens vs redrawing. `await node.screenshot()` after each frame.
- Playwright MCP: optional visual check of local `/conductor` at 390×844 after UI lands — not a substitute for Figma.
- GitHub MCP: only if opening a PR at the end (do not merge).
- Tools NOT needed: private `figma-grok-bridge`; Shopify; Doppler writes; Sheets writes; WhatsApp send.

# Constraints & Guardrails
- DO treat `/logistica` as the **only** source of the route feed. Driver screens bind trip/`plan_snapshot` (origin, dest, stops, qty, remito, next step). Hardcoded Montevideo/Pando is demo-only when there is no session.
- DO keep ENV ≠ REP ≠ trip IDs. Confirm remains immutable from `en_coordinacion`. Local confirm without API does not mint trips.
- DO use Outdoor Night tokens only on `/conductor`. No operator Shell, no Google header, no Liquid Glass, no Applied AI skin.
- DO map Carga steps 1:1 to `factory_arrived` / `load_started` / `load_completed` / `factory_departed`. Orange CTA = **current** step action.
- DO load `figma-use` before every `use_figma`. Colors 0–1. Inter `"Semi Bold"` not `"SemiBold"`. `createAutoLayout`. `return` all node IDs. Never `figma.notify()`. ≤10 logical ops per call. One `setCurrentPageAsync` per call.
- DO NOT use the private localhost Figma bridge unless official MCP returns a quota/seat error — then stop and handoff.
- DO NOT push to `main`. DO NOT mix storefront-voice or trucker-agent dirty files.
- DO NOT auto-send WhatsApp. HITL assign (`driverAssign.js`) stays human-gated.
- DO NOT invent BOM lines or stops. DO NOT touch parámetros/Sheets/fiscal data.
- DO NOT ship fake iPhone status-bar/home-indicator chrome in the PWA (Figma device frames are OK).
- Secrets: Doppler `bmc-frontend/prd` / `bmc-backend/prd` for local `doppler run -- npm run dev` only. No new env keys unless required and named `^[A-Z][A-Z0-9_]*$`.

# Anti-patterns
- DO NOT treat the five old JPGs (`evidence/screens/01–05`) as layout SoT — they conflict (AR cities, four tab bars, light profile, crystal login).
- DO NOT treat `panelin-api-642127786762` as live.
- DO NOT use `src/server.js` / zombie Wolf API paths.
- DO NOT hardcode `API_AUTH_TOKEN`.
- DO NOT echo secrets with `echo` into Vercel CLI (`printf '%s'`).
- DO NOT retry official `use_figma` in a loop after a Starter/quota error.
- DO NOT Playwright-click the Figma WebGL canvas as an editor.
- DO NOT create trips from the Driver “Nueva ruta” CTA — operator assigns.
- DO NOT put Carga 3D as an operator `/logistica` deep-link that dumps the chofer into Liquid Glass.
- DO NOT work in `$HOME` as a git repo.

# Deliverables
- Git branch `feat/logistica-driver-figma-loop` from `origin/main`
- `docs/sdd/bmc-driver-loop/DESIGN-UI.md` (tab map + logistics-feed contract + SVG kit as visual SoT)
- `docs/sdd/bmc-driver-loop/TARGET.md` (D7 feed-binding; D3 points at svg-kit)
- Figma: five 390×844 frames + board on file `iGZDe5LeC2ZDOdjbB3uH9q` (IDs in handoff)
- Updated `src/components/driver/*` + `src/styles/bmc-driver.css` matching Figma and binding trip feed
- Tests green: existing join/e2e plus any new assertion that listed trip origin/stops come from join payload
- `docs/team/HANDOFF-YYYY-MM-DD-logistica-driver-figma.md`
- Optional PR — do not merge

# Success Criteria
- `git branch --show-current` is `feat/logistica-driver-figma-loop` and does not contain storefront-voice-only files
- DESIGN-UI navigation map is Login → Home / Carga / Listo / Perfil (one tab bar; Listo includes the bar)
- Figma screenshots exist for login, home, carga, done, profile at 390×844; Listo shows Listo tab selected
- With a session, Home title route and Carga summary render from `GET /api/driver/trips` (not a hardcoded city pair). Empty session may show kit demo with an explicit demo flag
- Carga header “N de 4” matches the in-progress step; CTA label matches that step’s event
- `POST /api/repartos/:id/confirm` (or existing e2e join) still returns `driver_url` containing `/conductor?t=`
- A driver factory event is readable from Torre live projection or `trip_events` in `tests/logisticaE2e.test.js`
- `npm run gate:local` passes
- PWA has no fake iOS status bar; CTAs are 52px (`--drv-cta-h`)
- Handoff lists Figma fileKey, node IDs, branch, remaining TARGET items (Torre T5–T8 untouched)

# Operational Anchors
- Source hierarchy for **this** task: repo + SDD TARGET (logic) > svg-kit (visual) > DESIGN-UI (patch to match) > old JPG evidence (auxiliar, not master).
- State labeling: tag claims `hecho confirmado` / `inferencia` / `duda abierta`.
- Triangulation: logística TARGET → driver SDD → `useDriverSession` / `joinRepartoToTrip` → Figma frames → `/conductor` UI → e2e. If sources conflict, prefer code + logística TARGET, then patch DESIGN-UI.
- Read-only: Ventas sheet, master prices, fiscal, packing tariffs, wizard O1–O10 behavior.
- If Figma `whoami` is not Full/pro: stop, do not burn Starter quota, handoff.

# Open Items
- [ASSUMPTION: Branch name `feat/logistica-driver-figma-loop` is free | verify with `git ls-remote --heads origin 'feat/logistica-driver-figma-loop'`]
- [ASSUMPTION: Official Figma Full seat still valid | verify `whoami` before first `use_figma`]
- [ASSUMPTION: Empty-state demo copy may keep Montevideo→Pando from the SVG kit | verify it is labeled demo and never overrides a live trip]
- [ASSUMPTION: Torre T5–T8 stay out of this goal | verify user did not expect roster work in the same run]
- [ASSUMPTION: `doppler run -- npm run dev` is the local runtime if `npm run start:api` fails on corrupted node_modules | verify before claiming local smoke]
