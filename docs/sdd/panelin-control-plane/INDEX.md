# INDEX — panelin-control-plane

**SoT:** `docs/sdd/panelin-control-plane/` (this repo)  
**UI:** `~/Projects/panelin-workspace` (Knowledge propose/approve client)

| Sibling | Role |
|---------|------|
| This pack | Knowledge CR → training KB loop + safety |
| panelin-workspace-vision | Store customers/quotes |
| panelin-ai-agent-platform | Runtime agentCore/tools |
| paos | Supervised promote (opt-in) |

**MVP:** propose CR → approve → `addTrainingEntry` → match.
