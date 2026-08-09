# Rule provenance — AGENTS.md & harness laws

Every standing rule should trace to a **real failure** or a **hard external constraint**.  
Do not brainstorm new AGENTS lines without a row here.

| Rule (summary) | Source failure / constraint | Date | Sensor that enforces |
|----------------|----------------------------|------|----------------------|
| ES modules only / no require() | Node ESM package type; broken CJS imports | 2025+ | lint / runtime |
| Never hardcode sheet IDs / tokens / prod URLs | Credential leaks + wrong env drift | historical | `test:fitness`, env-drift |
| 503 for Sheets unavailable (not 500) | Frontend treated 500 as hard crash | historical | API conventions + tests |
| Run gate:local before PR | Broken main / CI thrash | historical | `gate:local`, ship skill |
| Update PROJECT-STATE Cambios recientes | Multi-agent state drift | historical | closeout / docs discipline |
| Human confirm for production sheet writes | Accidental CRM overwrites | Co-Work / wolfboard | `user_confirmed` |
| Finanzas second password factor | Bank data sensitivity | 2026-07 | finLocked middleware |
| GOLDEN_REQUIRED on pre-release | Silent skip of agent goldens | HCS 2026-07 | `pre-release` script |
| PreToolUse deny force-push / DROP / rm -rf | Destructive agent accidents | HCS 2026-07 | `pre-tool-use.sh` |
| Cost events via costTelemetry | Missing LLMOps visibility | HCS 2026-07 | costTelemetry + fitness |
| Failure-earned AGENTS only (≤80 lines) | Context rot from rule dumps | HCS 2026-07 | harness-score guide_quality |

## How to add a rule

1. Reproduce failure once.  
2. Prefer a **sensor** (test/hook/CI) over prose.  
3. If prose needed, add ≤2 lines to AGENTS.md **and** a row above.  
4. Re-run `npm run harness:score:report`.
