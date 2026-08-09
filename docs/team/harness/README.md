# BMC Harness Control System (HCS)

**Agent = Model + Harness.** This directory is the control plane for guides, sensors, score, and the improvement flywheel.

## Quick commands

| Command | Purpose |
|---------|---------|
| `npm run harness:score` | Composite score; exit 1 if &lt; 90 or DoD incomplete |
| `npm run harness:score:report` | Always write SCORECARD.json, exit 0 |
| `npm run pre-release` | gate:local:full + fitness + catalog goldens + score report + GOLDEN_REQUIRED agent goldens |
| `npm run test:fitness` | Architecture boundary sensors |
| `npm run test:catalog-goldens` | Commercial price taste invariants |
| `npm run test:agent-golden` | Trajectory goldens (needs API for live; skip-friendly unless GOLDEN_REQUIRED=1) |
| `npm run eval:agent` | Offline goldens + optional promptfoo (`EVAL_PROMPTFOO=1`) |

## Documents

- [HARNESS-MAP.md](./HARNESS-MAP.md) — inventory of every guide/sensor  
- [RULE-PROVENANCE.md](./RULE-PROVENANCE.md) — why each standing rule exists  
- [SKILL-INDEX.md](./SKILL-INDEX.md) — progressive disclosure  
- [RATCHET-EXAMPLE.md](./RATCHET-EXAMPLE.md) — failure → permanent fix  
- [SCORECARD.json](./SCORECARD.json) — last automated score  
- [../SDD-HARNESS-ENGINEERING.md](../SDD-HARNESS-ENGINEERING.md) — full SDD  

## PEV loop (Plan · Execute · Verify)

Standard long-horizon protocol for coding agents on this repo:

1. **Plan** — write done-condition first (checklist or plan file). No code until “done” is falsifiable.  
2. **Execute** — smallest change that moves a sensor green. Prefer atomic commits.  
3. **Verify** — computational first (`gate:local`, fitness, catalog goldens), then inferential (review / promptfoo), then human for money/channel.  
4. **Reset** — if context rot: write HANDOFF, start fresh session with handoff + done-condition (not endless compaction).  

Aligns with: `ship`, `live-fix` (verify harness JSON), `closeout`, `/goal`.

### Success silent / failure verbose

Hooks and sensors should not spam on green paths. On red, emit **agent-readable** stderr with the exact fix target.

## Planes (summary)

0 Intent & guides · 1 Product agent runtime · 2 Coding outer · 3 Sensors · 4 Flywheel · 5 Human gates  

## Human gates (non-goals for autonomy)

OAuth, finanzas unlock, `user_confirmed` sheet writes, Meta spend — **must remain**. Score treats their presence as PASS.

## ASSISTANTS_ACTIVE prod parity

Cloud Run must receive `ASSISTANTS_ACTIVE` (e.g. `canales,ml`) via deploy workflow. Smoke that returns `assistant_disabled` is a **control-plane** failure, not a missing API key. See `server/lib/assistantRegistry.js` and `tests/assistantControlPlane.test.js`.
