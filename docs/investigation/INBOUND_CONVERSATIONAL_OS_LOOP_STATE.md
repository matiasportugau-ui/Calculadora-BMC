# INBOUND CONVERSATIONAL OS — LOOP STATE & PROTOCOL

**Purpose**: Persistent "loop skill" for this initiative.  
Every time new input, data, code change, decision, blocker, or user message arrives, **re-analyze and respond strictly based on the single best path** to reach **"the step before final integration"**.

**Last Updated**: 2026-07-08 (Cycle 1 active)
**Owner**: Matias + Grok (loop conductor)
**Reference Report**: BMC_Inbound_Messages_Research_Report_July2026.pdf (modular core + ML adapter)

---

## LOOP PROTOCOL (enforced on every cycle)

1. **Re-analyze full live context** (no assumptions):
   - Research report recommendations (core global CRM + pluggable ML adapter)
   - Current codebase state (Wolfboard HUB, BmcCanalesUnificadosModule, omni layer, admin-ingreso, presupOrchestrator, ML/WA syncs, feature flags, Sheets as CRM)
   - PROJECT-STATE.md + recent work (omni investment, admin-ingreso live, WA canonical dormido, control plane)
   - Existing working tools (Canales/Omni Inbox, ML Manager, Admin Ingreso + quoting pipeline, presup orchestrator)
   - Latest artifacts (this file, summary.md, code diffs, new user input)
   - Risks (maintenance of custom, Sheets limits, dormido flags, blast radius)

2. **Map current progress** against the pre-final milestone (see definitions below).

3. **Determine BEST PATH** (prioritization rules):
   - Leverage **already existing + working** tools first (Canales, admin-ingreso, presup, current ML modules, Wolfboard).
   - Prefer **low blast radius**, reversible, fast-feedback actions.
   - Advance the **modular vision** from the report (make ML adapter explicit, core unified visible).
   - Delay high-commitment decisions (full platform cutover) until pre-final criteria met.
   - When multiple options: score by (speed to pre-final + risk + reuse of existing + operator value today).

4. **If input/decision/data/code review/user action is needed**:
   - Explicitly list **exactly** what is required.
   - Analyze the top 2-3 options with pros/cons vs best path.
   - Recommend the **single best next concrete action** (or minimal sequence).
   - Update this LOOP_STATE (cycle #, snapshot, decisions, blockers).
   - Ask the precise question or request the input.

5. **Output format for responses** (use this structure):
   ```
   ### Loop Cycle #N — Best Path Analysis
   **Progress toward Pre-Final Step**: X%
   **Current Best Path**: [concise description]
   **Recommended Next Action(s)**: [numbered, actionable, smallest valuable step first]
   **Pending Inputs Needed**: [list with why + best way to provide]
   **Blockers / Risks**: ...
   **Updated State**: [reference to this file or key changes]
   ```

6. **Update artifacts**:
   - This LOOP_STATE.md (append cycle log at bottom)
   - todo list (via tool)
   - Any code/docs changes via precise edits
   - Cross-reference the research summary

7. **Termination**: Loop ends only when verifiable "Step Before Final Integration" criteria are met (or owner explicitly redefines target).

---

## DEFINITIONS

### Final Integration (target end-state)
A production-ready, modular BMC Conversational OS inbound system that:
- Delivers unified conversational inbox + AI for primary channels (WA + IG + FB + Email + future).
- Treats ML strictly as optional, toggleable, pluggable adapter (no deep coupling).
- Seamlessly feeds into existing quoting engine (presupOrchestrator + PDF + WA/Drive delivery) and CRM.
- Uses Wolfboard HUB (or evolved version) as the operator surface.
- Either:
  A) Fully matured custom (omni + canales + Wolfboard as core), **or**
  B) Hybrid: external core (Kommo or Respond.io recommended) + lightweight ML adapter + custom quoting/Wolfboard frontend.
- Has measurable impact (lead handling time, conversion, operator load), rollback plan, and documentation.

### The Step Before Final Integration (pre-final milestone — loop target)
We stop the loop here and only then execute the final integration/cutover. Criteria (all must be true):
- [ ] Phase 0 audit complete: full map of inbound sources, current volumes (last 30-90d), pain points, existing flows (ML/WA/IG/sheet/omni).
- [ ] Decision gate passed + documented: "Mature & harden custom omni path" **OR** "Run controlled parallel trial of Kommo/Respond (success criteria defined)".
- [ ] ML handling isolated as explicit pluggable adapter (code surface + toggle + status visible in Wolfboard + docs).
- [ ] End-to-end happy path validated using **current working tools** where possible: inbound message → triage/interpret (admin-ingreso or omni) → quote (presup) → deliver/CRM update.
- [ ] Provisional "Conversational OS Inbound" module in Wolfboard is either sufficient or evolved into a minimal operational view (status, quick actions, links).
- [ ] Baselines + success metrics + rollback plan documented.
- [ ] Operators trained / docs updated for the pre-final flows.
- [ ] No high-risk production cutover performed yet.

**"Best path" always optimizes for reaching the above list with minimal waste and maximum reuse of today's working system.**

---

## CYCLE LOG

### Cycle 1 (2026-07-08) — Phase 0 Audit Kickoff Started
**Trigger**: User: "start phase 0 audit kickoff"

**Audit Kickoff Deliverables**:
- Created executable script: `scripts/phase0-inbound-audit.mjs`
- Captured run: `.runtime/audit/phase0-inbound-kickoff-2026-07-08.json`
- Full source mapping completed (see below).
- Ready-to-run SQL + recommendations included.

**Sources Mapped (Phase 0)**:
- **Omni (unified core)**: `omni_conversations.channel` ∈ ['ml','wa','email','facebook','instagram','omnicrm']. Has `created_at`. Existing `collectOmniMetrics()` + `/api/omni/metrics` endpoint.
- **Sheets CRM_Operativo** (legacy primary for operators): Column F = Origen (WA/EM/CL/LO/LL + ML). Column I = Consulta. Accessed via wolfboard/admin-ingreso/Canales.
- **ML pluggable adapter surface**: Dedicated adapters/mlCrmRow.js + ml-crm-sync + /hub/ml + /hub/ml-manager + webhooks. Feeds omni as channel='ml'.
- **WA**: waWebhook + wa_crm_sync job → omni 'wa'.
- **Email**: adapters/emailIngest.

**Pain Points Noted from Code**:
- Dormant flags (OMNI_WA_CANONICAL etc.)
- Duplicates + merge logic
- Channel-specific urgency/FRT
- Dual legacy vs omni writes
- Sheets + Postgres sync friction

**SQL for real numbers** (run in prod DB):
```sql
SELECT channel, COUNT(*)::int AS count_30d
FROM omni_conversations
WHERE created_at >= now() - interval '30 days'
GROUP BY channel ORDER BY count_30d DESC;

-- Similar for 90d + message counts
```

**Best Path Update**: Script + mapping = excellent kickoff. Next: execute with real secrets for volume data → analyze which channels dominate → prioritize adapter vs core work.

**State Snapshot** (fresh):
- Provisional "Conversational OS · Inbound (Provisional)" card live in Wolfboard (with CTAs to Canales/Core, Admin Ingreso/interpret, ML Manager/adapter).
- ML Operativo card updated with "pluggable adapter" language.
- Existing working tools strongly present: Canales unificado + omni panels (VITE_OMNI_* flags), admin-ingreso (P0 live per PROJECT-STATE), presupOrchestrator + sheet quote pipeline, dedicated ML modules + syncs, omni Postgres layer + jobs.
- Recent context: Massive omni/WA work (much dormant behind flags), control plane (canales;ml;panelin), Sheets (CRM_Operativo) as primary.
- Research summary created.
- LOOP protocol + this tracker now active.
- No external core (Kommo/Respond) trialed yet. No consolidated Phase 0 audit visible.

**Progress toward Pre-Final Step**: ~18%

**Current Best Path**:
Leverage the already-shipped working system (Canales/omni + admin-ingreso + presup + current ML modules + new provisional card) as the foundation.
Execute a fast, zero-new-dep **Phase 0 audit** to get the data the report explicitly calls for first.
Make ML adapter explicit and visible.
Only then run the decision gate (custom harden vs low-risk parallel trial).
All actions must directly advance checkboxes toward "Step Before Final Integration" with minimal blast radius.

**Recommended Next Action(s)** (smallest valuable first):
1. **Phase 0 audit kickoff (highest leverage right now)**: Snapshot inbound volumes + sources for last 30-90 days from existing sources (CRM_Operativo sheet columns for origen/fecha/consultas + omni_conversations + ML sync logs + WA jobs). Use this to quantify pain points and validate "current omni + ML modules = provisional core + adapter".
2. Document current ML sync points (ml-crm-sync.js, webhooks, etc.) as the "pluggable adapter" layer in a short ADAPTER.md or section of the summary.
3. Light polish on the provisional Wolfboard card if it gives operators immediate value (e.g., add a "Run quick audit" affordance later).
4. Capture current prod flag state for omni features.

**Pending Inputs Needed** (to execute best path):
- Inbound volume data (preferred): 
  - Number of rows/consultas in CRM_Operativo (or relevant tabs) last 30/90 days, broken down by Origen (WA/ML/IG/etc.) if possible.
  - omni_conversations count + recent activity (or output from any existing omni metrics endpoint/script).
  - ML questions + orders volume (from /hub/ml or backend logs/sync).
  - Rough WA message volume.
  Best ways to provide: (a) run a quick query/script and paste numbers, (b) give me sheet tab names + allow read access via known tools, (c) point to existing dashboard/report.
- Current prod flag values: VITE_OMNI_INBOX, VITE_OMNI_DEALS, OMNI_WA_CANONICAL, OMNI_WA_READS, ASSISTANTS_ACTIVE (and whether they are effectively ON in prod).
- Any known pain points or "what hurts most today" with inbound (response time, duplicate handling, ML vs WA consistency, quoting handoff, etc.).
- Preference signal: Stay fully custom for the next 4-6 weeks, or open to starting a cheap parallel 7-14d trial of Kommo (cheapest/LATAM-friendly) or Respond.io?

**Blockers / Risks**:
- Dormant flags mean "code exists" ≠ "live for all operators".
- Custom omni is powerful but the report highlights the value of buying a mature unified inbox + AI layer.
- Sheets-centric CRM may constrain advanced pipelines.

**Decisions Locked This Cycle**:
- Loop protocol is now the mandatory analysis mode for all future input on this topic.
- Best path = audit + explicit adapter + reuse existing → decision gate (no big integration yet).

**Updated State**:
- File: `docs/investigation/INBOUND_CONVERSATIONAL_OS_LOOP_STATE.md` (this document + protocol).
- Todos updated for the initiative.
- Research summary + provisional card already delivered as Cycle 0 work.
- Next cycle will be triggered by any new user input or my discovery of data.

---

### Cycle 2+ (append on new input)

[Future cycles appended here by the loop conductor after re-analysis.]

---

## QUICK REFERENCE — Best Path Heuristics
- Reuse Canales/omni + admin-ingreso + presup first.
- Make ML "adapter" visible and toggleable early.
- Audit before architecture commitment.
- Wolfboard as the integration surface for operators (provisional → real).
- External platforms only after decision gate with clear criteria.
- Every change must move at least one pre-final checkbox forward.

**Loop is now ACTIVE and will be followed on every relevant input.**

---

### Cycle 2 (2026-07-08) — Phase 0 Audit Script Executed — LIVE DATA RECEIVED
**Trigger**: User: "run the phase 0 audit script"

**Results Summary (from live doppler run on bmc-backend/prd):**

**Omni conversations (current snapshot):**
- email: 20
- ml: 13
- wa / others: 0

**30d / 90d (data appears recent/limited):**
- ml: 13
- email: 20

**Messages 30d:** 40

**ML deals:** 3 (source_channel=ml)

**24h activity:**
- Ingest: email=4
- AI jobs: classify=4, suggest=4, assist=2 (all completed)
- Pending AI jobs: 0
- Cost: 0

**Major Insight:** WhatsApp channel completely absent from omni_conversations. This is the #1 actionable finding. Matches "dormido" WA canonical state in PROJECT-STATE. Legacy WA likely still dominant in Sheets.

**Updated Best Path:**
- Highest priority: Investigate WA omni population (check OMNI_WA_CANONICAL, wa_crm_sync job, recent logs).
- Next: Get legacy CRM_Operativo counts (WA-heavy) to compare volumes.
- Then: Decide if provisional Wolfboard bridge or accelerate omni WA cutover.
- ML (13 convos) confirms adapter role but low current unified volume.

**Artifacts:**
- Script: scripts/phase0-inbound-audit.mjs
- Report: .runtime/audit/phase0-audit-results-2026-07-08.md
- JSON: .runtime/audit/phase0-inbound-kickoff-2026-07-08.json

**Pending for Cycle 3:**
- Sheets legacy volumes
- Flag/job status for WA
- User confirmation on next priority (WA fix vs Sheets pull vs provisional UI)

=== Updated LOOP_STATE with new feature ===

### Cycle 3 (2026-07-08) — "Estado de consultas" Live implemented in Wolfboard
**User feedback on audit table**: Liked the status view. Wants it as live "Estado de consultas" report:
- Click to unfold
- Visual notification + muteable sound on every new
- Accumulation alarm (buzz + Panelin calls attention)
- Example voice: "hey, dale bola a las consultas.... esas se están acumulando..."

**Action taken**:
- Created `src/components/hub/EstadoConsultasLive.jsx` (polling omni metrics, delta detection, Web Audio beeps, browser TTS for Panelin phrase, expand/collapse, mute toggle, alarm mode with red + repeating sound).
- Integrated into `BmcWolfboardHub.jsx` right after OperatorOverview (prominent live block).
- Reuses existing auth/fetch patterns.
- Highlights the WA gap from the audit data.
- Provisional but production-usable.

**Best path next**:
- Test with real traffic.
- If needed, add Sheets fallback for legacy WA counts.
- Wire real "new item" (not just count) if user provides more data.
- Add to Canales or make it a full card.

