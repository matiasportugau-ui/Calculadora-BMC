# Wolf Debug System — Implementation Spec (Clean)

**Objective**: Ship a fully functional, production-grade "Wolf Debug" module that serves as the central, delightful, and powerful triage / auditing / bug-hunting surface for the entire BMC/Panelin platform.

## Visual Identity (mandatory)
Main Character: the anthropomorphic gray wolf in a sharp black suit (three provided reference renders).

- **wolf-hero.png** (Image #1): Standing authoritative pose, serious expression, holding a glowing high-tech magnifying glass containing a circuit/tech orb with a distressed bug inside. **Primary hero / branding visual**. Use large at top of the module and in WolfboardHub card.

- **wolf-review.png** (Image #2): Wolf kneeling in focused pose, wearing a monocle-like scanner, holding an advanced glowing scanning device and illuminating a group of small turtles on the ground. **Search & Review state**. Use when the operator is running diagnostics, reviewing logs, or performing methodical scans.

- **wolf-hunt.png** (Image #3): Dynamic action pose — wolf mid-stride running, smiling confidently, wielding a glowing blue containment canister/trap. A panicked bug is fleeing toward a large tech grid. **Hunt / Capture / "Bug Found" state**. Use during active remediation, quick reporting, or "hunt mode" sweeps.

Asset location (committed):
`public/images/wolf-debug/{wolf-hero.png, wolf-review.png, wolf-hunt.png}`

## Functional Requirements (production)
- Route: `/hub/wolf-debug` (lazy loaded, protected with `RequireGrant role="admin"` — same contract as `/hub/bugs` and Wolfboard admin surfaces).
- Entry point from `/hub` (BmcWolfboardHub) — replace or strongly upgrade the existing "Bugs reportados" card into a prominent "🐺 Wolf Debug" card that uses the hero visual or strong wolf theming.
- Reuse and integrate existing production systems:
  - Bug reporting flow via `openBugReport` from `src/lib/bugReportBus.js` (prefill context when possible).
  - Live/recent bugs list (reuse or embed logic from `BugReportsList` + `/api/bugs`).
  - Real health & capability probes (`GET /health`, `/capabilities`).
  - Existing cockpit token pattern (localStorage + Authorization Bearer) for protected calls (same as wolfboard + bugs).
  - Quick actions that are actually useful in production:
    - Run full gate hints + copyable commands (`npm run gate:local:full`, `npm run smoke:prod`, etc.).
    - Trigger smoke / health checks with live results in the UI.
    - "Report bug with current context" that opens the rich modal.
    - Direct deep links to Inspector, Super Agent, Cloud diagnostics, etc.
- State-driven mascot:
  - Idle / landing → wolf-hero (large, impressive).
  - "Iniciar Revisión" / scanning tools active → switch to or prominently feature wolf-review.
  - "Modo Caza" / issues surfaced / report action → wolf-hunt + action CTAs.
- Production polish:
  - Loading, error, success states for every action.
  - Responsive (match other hubs).
  - No new secrets or hard dependencies.
  - Works with the dual auth model (static token or admin JWT).
  - Accessible, keyboard friendly, clear feedback.
- Bonus production value: a "Wolf Sweep" that runs a small orchestrated set of real checks (health + sample wolfboard read + bug count) and surfaces a concise status + recommended next actions.

## Non-goals (for v1)
- Not a full replacement for the existing simple `/hub/bugs` list (keep both; Wolf Debug is the premium experience).
- Not a new backend (reuse `/api/bugs`, `/health`, etc.).
- No new persistent storage.

## Success Criteria
- Open `/hub/wolf-debug` (with valid admin token) → beautiful branded screen with the correct wolf visual in hero state.
- Click "Iniciar Revisión" → UI reacts, shows review visual, runs live probes, displays real data.
- Click a hunt/report action → wolf-hunt visual appears, BugReportModal opens with context, or real checks execute.
- From WolfboardHub the card drives traffic to the new module.
- `npm run lint` clean on the changed files.
- Usable immediately in production for daily triage (no theatre).

## Files to touch (minimum)
- `src/components/WolfDebugModule.jsx` (new, self-contained but reuses shared nav + bus + api patterns)
- `src/App.jsx` (lazy import + route)
- `src/components/BmcWolfboardHub.jsx` (upgrade bugs card → Wolf Debug hero card)
- `public/images/wolf-debug/` + README (asset placement)
- Optional: small doc update in `docs/team/PROJECT-STATE.md` under recent changes once shipped.

## Tone
Professional operator tool with personality. The wolf is competent, calm, slightly predatory toward bugs — not cartoonish. Clean typography, generous whitespace, decisive CTAs. Red accents only for severity/bugs. Blues and darks for authority.

Let's get this finished and fully functional in production.
