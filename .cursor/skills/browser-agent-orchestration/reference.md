# Browser MCP Reference

## Lock/Unlock Workflow

1. `browser_navigate` first (or `browser_tabs` list if tab exists)
2. `browser_lock` before any click/type
3. Perform interactions
4. `browser_unlock` when done

## Tools

| Tool | Use |
|------|-----|
| `browser_navigate` | Go to URL |
| `browser_snapshot` | Get page structure and element refs |
| `browser_click` | Click element (need ref from snapshot) |
| `browser_type` / `browser_fill` | Input text |
| `browser_tabs` | List open tabs |
| `browser_scroll` | Scroll (use `scrollIntoView: true` for obscured elements) |

## Wait Strategy

Prefer short incremental waits (1–3s) with snapshot checks between, rather than one long wait. Proceed as soon as content is ready.

## JSON Endpoints

For URLs that return JSON (e.g. `/auth/ml/start?mode=json`), the snapshot may show raw JSON. Extract `authUrl`, `redirect_uri`, etc. from the response body.
