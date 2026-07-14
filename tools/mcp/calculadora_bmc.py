#!/usr/bin/env python3
"""
FastMCP server: calculadora-bmc

Gives AI agents (Claude, Cursor, etc.) structured + visual access to the
BMC Uruguay / Panelin quotation calculator.

Primary strategy (reliable):
  • All calculations go through the real calc API (/calc/cotizar, /calc/catalogo, etc.)
  • Playwright is used ONLY for screenshots / visual verification of the live UI.

Run as stdio MCP server:
  python tools/mcp/calculadora_bmc.py

Requirements:
  pip install fastmcp httpx playwright
  playwright install chromium

Environment:
  BMC_API_BASE   → http://localhost:3001   (recommended for accuracy)
                   or the public Cloud Run URL if exposed.
  PLAYWRIGHT_HEADLESS=0  → show the browser for screenshots (debug)
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastmcp import FastMCP
from playwright.async_api import async_playwright, Browser, Page

mcp = FastMCP("calculadora-bmc")

# ──────────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────────

DEFAULT_API_BASE = os.environ.get("BMC_API_BASE", "http://localhost:3001").rstrip("/")
FRONTEND_URL = "https://calculadora-bmc.vercel.app"
HEADLESS = os.environ.get("PLAYWRIGHT_HEADLESS", "1") != "0"

# Simple in-memory browser reuse (speeds up repeated screenshots)
_browser: Browser | None = None
_playwright_cm = None


async def get_browser() -> Browser:
    global _browser, _playwright_cm
    if _browser and _browser.is_connected():
        return _browser
    _playwright_cm = async_playwright()
    p = await _playwright_cm.__aenter__()
    _browser = await p.chromium.launch(headless=HEADLESS)
    return _browser


async def close_browser():
    global _browser, _playwright_cm
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright_cm:
        await _playwright_cm.__aexit__(None, None, None)
        _playwright_cm = None


def _api_url(path: str) -> str:
    return f"{DEFAULT_API_BASE}{path}"


async def _api_get(path: str, params: dict | None = None) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(_api_url(path), params=params)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"API GET failed: {e}", "api_base": DEFAULT_API_BASE}


async def _api_post(path: str, json: dict) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(_api_url(path), json=json)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"API POST failed: {e}", "api_base": DEFAULT_API_BASE, "sent": json}


# ──────────────────────────────────────────────────────────────────────────────
# Tools
# ──────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def bmc_catalogo(lista: str = "web") -> dict[str, Any]:
    """Return the current panel catalog (precios, espesores, familias, etc).

    lista: "web" (public/Shopify prices) or "venta" (BMC direct list).
    """
    return await _api_get("/calc/catalogo", {"lista": lista})


@mcp.tool()
async def bmc_informe(lista: str = "web") -> dict[str, Any]:
    """Full pricing + restrictions dump. Best starting point for agents."""
    return await _api_get("/calc/informe", {"lista": lista})


@mcp.tool()
async def bmc_escenarios() -> dict[str, Any]:
    """List supported quoting scenarios and the exact fields each one expects."""
    return await _api_get("/calc/escenarios")


@mcp.tool()
async def bmc_cotizar(
    escenario: str,
    lista: str = "web",
    techo: dict[str, Any] | None = None,
    pared: dict[str, Any] | None = None,
    camara: dict[str, Any] | None = None,
    flete: float = 0.0,
) -> dict[str, Any]:
    """Run a real quote through the production calculation engine.

    Common escenarios (see bmc_escenarios):
      - "solo_techo"
      - "solo_fachada"
      - "techo_fachada"
      - "camara_frig"
      - "presupuesto_libre"

    Example solo_techo payload (techo):
    {
      "familia": "isodec",
      "espesor": 50,
      "zonas": [{"largo": 12.5, "ancho": 6.2}],
      "color": "gris",
      "tipoEst": "metal",
      "pendiente": 5,
      "opciones": {"inclCanalon": true, "inclSell": true}
    }

    Returns the structured BOM + totals (sin IVA + IVA) exactly like the app.
    """
    payload: dict[str, Any] = {
        "escenario": escenario,
        "lista": lista,
        "flete": flete,
    }
    if techo:
        payload["techo"] = techo
    if pared:
        payload["pared"] = pared
    if camara:
        payload["camara"] = camara

    return await _api_post("/calc/cotizar", payload)


@mcp.tool()
async def bmc_cotizar_presupuesto_libre(
    lista: str = "web",
    librePanelLines: list[dict[str, Any]] | None = None,
    librePerfilQty: dict[str, int] | None = None,
    libreFijQty: dict[str, int] | None = None,
    libreSellQty: dict[str, int] | None = None,
    flete: float = 0.0,
) -> dict[str, Any]:
    """Cotizar using the free-line "Presupuesto Libre" mode (manual lines + accessories)."""
    payload = {
        "lista": lista,
        "librePanelLines": librePanelLines or [],
        "librePerfilQty": librePerfilQty or {},
        "libreFijQty": libreFijQty or {},
        "libreSellQty": libreSellQty or {},
        "flete": flete,
    }
    return await _api_post("/calc/cotizar/presupuesto-libre", payload)


@mcp.tool()
async def bmc_screenshot(
    url: str | None = None,
    full_page: bool = True,
    selector: str | None = None,
) -> str:
    """Capture a screenshot of the live calculator UI.

    Returns a short message + path to the PNG. Useful for visual evaluation.
    The calculator is a rich React app — calculations should still go through bmc_cotizar.
    """
    target = url or FRONTEND_URL
    browser = await get_browser()
    page: Page = await browser.new_page()
    try:
        await page.goto(target, wait_until="networkidle", timeout=45000)
        # Give the SPA a moment to hydrate
        await page.wait_for_timeout(1200)

        path = "/tmp/bmc_calculadora.png"
        if selector:
            el = await page.query_selector(selector)
            if el:
                await el.screenshot(path=path)
            else:
                await page.screenshot(path=path, full_page=full_page)
        else:
            await page.screenshot(path=path, full_page=full_page)

        return f"Screenshot saved to {path}. Target was: {target}"
    finally:
        await page.close()


@mcp.tool()
async def interact_bmc(action: str, data: dict[str, Any] | None = None) -> str:
    """Legacy unified helper matching the original snippet style.

    Supported actions (case-insensitive):
      - "catalog" / "catalogo"
      - "informe"
      - "escenarios"
      - "calculate" / "cotizar"
      - "screenshot"
      - "presupuesto_libre" / "libre"
      - "fill_project", "add_panel" (documented as not recommended)

    Prefer the dedicated tools: bmc_catalogo, bmc_cotizar, bmc_screenshot, etc.
    """
    data = data or {}
    action = (action or "").lower().strip()

    if action in ("catalog", "catalogo"):
        res = await bmc_catalogo(data.get("lista", "web"))
        return str(res)

    if action == "informe":
        res = await bmc_informe(data.get("lista", "web"))
        return str(res)

    if action == "escenarios":
        res = await bmc_escenarios()
        return str(res)

    if action in ("calculate", "cotizar"):
        escenario = data.get("escenario") or data.get("scenario") or "solo_techo"
        res = await bmc_cotizar(
            escenario=escenario,
            lista=data.get("lista", "web"),
            techo=data.get("techo"),
            pared=data.get("pared"),
            camara=data.get("camara"),
            flete=float(data.get("flete", 0)),
        )
        if not res.get("ok", True):
            return f"Error: {res}"
        resumen = res.get("resumen", {})
        total = resumen.get("total_con_iva", resumen.get("total", "?"))
        return f"Total con IVA: {total}\n\nFull response:\n{res}"

    if action in ("screenshot", "captura"):
        return await bmc_screenshot(
            url=data.get("url"),
            full_page=data.get("full_page", True),
            selector=data.get("selector"),
        )

    if action in ("presupuesto_libre", "libre"):
        res = await bmc_cotizar_presupuesto_libre(
            lista=data.get("lista", "web"),
            librePanelLines=data.get("librePanelLines"),
            librePerfilQty=data.get("librePerfilQty"),
            libreFijQty=data.get("libreFijQty"),
            flete=float(data.get("flete", 0)),
        )
        return str(res)

    # Fallback: try to do something visible
    if action == "fill_project":
        return "fill_project is UI-stateful. Prefer bmc_cotizar with a structured payload, or use bmc_screenshot after manual setup."

    if action == "add_panel":
        return "add_panel: build the payload and call bmc_cotizar (or bmc_cotizar_presupuesto_libre). UI automation is intentionally avoided because the engine is authoritative."

    return f"Unknown action '{action}'. Available: catalogo, informe, escenarios, cotizar, screenshot, presupuesto_libre"


# ──────────────────────────────────────────────────────────────────────────────
# Lifecycle (optional cleanup)
# ──────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def bmc_cleanup() -> str:
    """Close any open browser instance (free resources)."""
    await close_browser()
    return "Browser closed."


@mcp.tool()
async def bmc_status() -> dict[str, Any]:
    """Quick health/status of the MCP integration (API reachability + config)."""
    api_status = await _api_get("/calc/catalogo", {"lista": "web"})
    return {
        "api_base": DEFAULT_API_BASE,
        "frontend": FRONTEND_URL,
        "api_reachable": bool(api_status.get("ok", False) or api_status.get("data_version")),
        "api_response_sample": {
            "data_version": api_status.get("data_version"),
            "lista": api_status.get("lista"),
            "error": api_status.get("error"),
        },
        "headless": HEADLESS,
    }


if __name__ == "__main__":
    print("Starting calculadora-bmc MCP server (stdio)...")
    print(f"API base: {DEFAULT_API_BASE}")
    print(f"Frontend : {FRONTEND_URL}")
    print("Tip: set BMC_API_BASE=http://localhost:3001 when running the Express API locally.")
    mcp.run(transport="stdio")
