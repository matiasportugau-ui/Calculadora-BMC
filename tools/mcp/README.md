# MCP Server — Calculadora BMC

Python MCP server (using FastMCP) that exposes the real BMC / Panelin calculation engine + visual screenshots to any MCP-capable client (Claude Desktop, Cursor, Windsurf, etc.).

## Why this exists

- The calculator is a complex React app. Scraping the DOM for numbers is brittle and wrong.
- The **authoritative source of truth** is the Express calculation API (`/calc/cotizar`, `/calc/catalogo`, etc.).
- This MCP gives agents **correct math** + the ability to take screenshots of the UI for visual review.

## Quick start

```bash
cd ~/calculadora-bmc

# 1. Install deps (one time)
pip install -r tools/mcp/requirements.txt
playwright install chromium

# 2. (Recommended) Start the real API locally for accurate prices & logic
npm run start:api
# or
doppler run -- npm run start:api

# 3. Run the MCP server (stdio)
python tools/mcp/calculadora_bmc.py
```

Add it to your MCP client config (example for Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "calculadora-bmc": {
      "command": "python",
      "args": ["/Users/matias/calculadora-bmc/tools/mcp/calculadora_bmc.py"],
      "env": {
        "BMC_API_BASE": "http://localhost:3001"
      }
    }
  }
}
```

## Available tools

| Tool                              | Purpose                                      |
|-----------------------------------|----------------------------------------------|
| `bmc_catalogo`                    | Current panel prices + dimensions            |
| `bmc_informe`                     | Full knowledge dump (prices + restrictions)  |
| `bmc_escenarios`                  | Supported scenarios + required fields        |
| `bmc_cotizar`                     | Real quote (recommended)                     |
| `bmc_cotizar_presupuesto_libre`   | Manual lines + accessories mode              |
| `bmc_screenshot`                  | Capture live UI (for visual eval)            |
| `interact_bmc`                    | Legacy unified action (catalog / cotizar / screenshot / ...) |
| `bmc_cleanup`                     | Close browser resources                      |

## Recommended flow for agents

1. `bmc_informe` or `bmc_catalogo` — load prices and rules.
2. `bmc_escenarios` — see exact shape needed for a scenario.
3. `bmc_cotizar({escenario, lista, techo, pared, ...})`
4. `bmc_screenshot()` when you want to show the human the rendered result.

## Environment variables

- `BMC_API_BASE` — defaults to `http://localhost:3001`. Point at a running Express API.
- `PLAYWRIGHT_HEADLESS=0` — show the browser window during screenshots (debug).

## Notes

- All money math (BOM, totales, IVA 22%) is performed by the real engine in `src/utils/calculations.js`.
- Screenshot uses the public Vercel frontend (`https://calculadora-bmc.vercel.app`).
- The original example in the chat used fake selectors (`#project-desc`, `.total-iva`). Those do not exist — this implementation avoids that trap.
