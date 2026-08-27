# Panelin BMC — voice instructions (in-app + console mirror)

Canonical in-app copy lives in `server/lib/voice/panelinBmcInstructions.js` (shipped with the API).

This file is the human-readable mirror of the xAI console agent **Panelin BMC** (`agent_WDdcfWOG9NLd59zL`) adapted for the calculator Voice Mode:

- Same Role → CRITICAL shape as the console.
- In-app close: no `end_call_2` (not a phone session).
- Form fill: `aplicar_estado_calc` / `setTecho` / `setScenario` so the teammate sees the form move.

When you edit the console Instructions, paste the new text into `panelinBmcInstructions.js` (and this file) so the flotante Voice Mode stays on the same brain.

Attach collection **bmc-product-bible** (`file_search`) on the console agent. Product rules from the collection; USD from calc tools.

See `XAI-VOICE-AGENT-PANELIN-BMC.md`.
