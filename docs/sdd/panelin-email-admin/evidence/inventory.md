# Evidence inventory — panelin-email-admin (PMCA)

Verified 2026-07-22 against `/Users/matias/calculadora-bmc`.

| Path | Role | Status |
|------|------|--------|
| `docs/team/EMAIL-SOURCE-MAP.md` | Canonical email/Omni file index | CONFIRMED |
| `docs/team/INBOX-AI-FIRST-BLUEPRINT.md` | Target SoT + phased roadmap | CONFIRMED |
| `server/lib/agentCore.js` | Shared brain | CONFIRMED |
| `server/lib/agentTools.js` | Panelin tools incl. email_* | CONFIRMED |
| `server/lib/sharedWorkspace.js` | Workspace normalize + classify heuristic | CONFIRMED (PMCA) |
| `server/lib/coworkFrames.js` | `formatOperatorContextBlock` + workspace | CONFIRMED |
| `server/lib/chatPrompts.js` | Surface + shared workspace rules | CONFIRMED |
| `server/routes/agentChat.js` | SSE + TOOLS_REQUIRING_AUTH | CONFIRMED |
| `server/lib/emailReply.js` / `omni/outbound/emailReply.js` | Send transport | CONFIRMED |
| `server/routes/omni.js` | `/omni/conversations`, `/reply` | CONFIRMED |
| `server/lib/emailAgentTools.js` | Chatwoot-only tools (not merged) | CONFIRMED separate |
| `src/hooks/useContextGroups.js` | ContextGroup persistence | CONFIRMED (PMCA) |
| `src/components/cowork/ContextGroupBar.jsx` | Tab strip a11y | CONFIRMED (PMCA) |
| `src/components/PanelinChatPanel.jsx` | Bundles workspace into OC | CONFIRMED |
| `docs/sdd/panelin-chat-agent/SDD.md` | Parent chat agent SDD | CONFIRMED companion |
