# As-built learning surfaces
| Fact | Tag | Evidence |
|------|-----|----------|
| addTrainingEntry default active | CONFIRMED | server/lib/trainingKB.js:209 |
| appendTrainingSessionEvent | CONFIRMED | trainingKB.js:672-679 |
| Autolearn MIN_CONFIDENCE 0.70 | CONFIRMED | autoLearnExtractor.js:17 |
| Workspace CR active permanent | CONFIRMED | workspace.js:551-558 |
| recordToolCall | CONFIRMED | toolStats.js:91 |
| Tool site | CONFIRMED | agentTools.js:1410 |
| chat_turn | CONFIRMED | agentChat.js:1524-1544 |
| GOLDEN_REQUIRED | CONFIRMED | package.json:106 |
| logAgentTurn.js | ABSENT | use chat_turn + tool_calls |
