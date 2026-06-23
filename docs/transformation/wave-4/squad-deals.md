# Squad Deals — F1–F3 + G1–G4

| PR | Deliverable | Files |
|----|-------------|-------|
| F1 | Deals CRUD + stage machine | `deals/dealService.js`, `deals/stageMachine.js`, `/api/omni/deals` |
| F2 | `extract_deal` job | `deals/dealExtractor.js`, `aiWorker.js` |
| F3 | Sheets dual-write | `deals/syncCrm.js`, `omni:reconcile-deals` |
| G1 | Omni inbox list | `OmniInboxPanel.jsx`, `useOmniConversations.js` |
| G2 | Thread + reply + HITL | `OmniThreadPanel.jsx` |
| G3 | Contact sidebar | `OmniContactSidebar.jsx` |
| G4 | Deals kanban | `OmniDealsKanban.jsx`, `VITE_OMNI_DEALS=1` |

**Flags:** `VITE_OMNI_INBOX=1`, `VITE_OMNI_DEALS=1` (staging first).

**Rollback:** set flags to `0` → legacy Sheets queue + tabs ML/WA.
