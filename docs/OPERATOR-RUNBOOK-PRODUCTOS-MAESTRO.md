# Operator Runbook — Productos Maestro

**Purpose:** How operators should use the centralized price + stock system (Productos Maestro) safely.

**Last Updated:** 2026-06-01

---

## When to Use Productos Maestro

Use this tool when you need to:
- Review or correct price/stock data coming from MATRIZ and Stock E-Commerce sheets.
- Link SKUs from MATRIZ with CODIGOs from Stock.
- Make bulk or targeted corrections before they affect cotizaciones.

**Do NOT use** for one-off manual price changes in the normal PricingEditor unless the change should also update the maestro view.

---

## Access

1. Open the Calculadora BMC.
2. Click the **gear icon (Config)**.
3. Go to the tab **"Productos (Maestro)"**.

You need a valid `API_AUTH_TOKEN` with at least "ventas" role to read, and "admin" role to write.

---

## Main Features

### 1. View Unified Data
- See merged view of prices (from MATRIZ) + stock (from Stock sheet).
- Status column shows:
  - `linked` → properly connected
  - `matriz-only` → exists in prices but no stock link
  - `stock-only` → exists in stock but no price mapping

### 2. Edit Links (SKU ↔ CODIGO)
- In the "Link (CODIGO Stock)" column, type the correct stock code.
- Changes save automatically.

### 3. Edit Prices & Stock Inline
- Yellow cells = local pending changes.
- You can edit costo, ventaLocal, ventaWeb, stock actual, and pedido pendiente directly.
- Small ↩ button appears on edited rows to revert that row.

### 4. Simulate Before Writing
- Always click **"Simular envío"** first.
- Review the summary of what will be written to MATRIZ and/or Stock.

### 5. Real Write (Careful!)
- Only click **"Escribir en planillas (real)"** when you are sure.
- A confirmation modal will appear.
- This actually modifies the Google Sheets (MATRIZ and Stock workbooks).

**Rule:** Never write to production sheets without simulating first and having a clear reason.

---

## Safety Rules

- Treat every real write as a material change to pricing or inventory data.
- If you are unsure about a link or value, ask before writing.
- After major writes, run `npm run productos-maestro:reconcile` (or the UI refresh) to verify.
- Keep an eye on the StockWebHint banner inside the calculator when using "Precio Web".

---

## Common Workflows

**A. Link new products**
1. Refresh data.
2. Find rows with status `matriz-only` or `stock-only`.
3. Fill the missing link.
4. Simulate → Write.

**B. Correct wrong stock after physical count**
1. Edit the stock numbers in the maestro table.
2. Simulate.
3. Write (this updates the Stock E-Commerce sheet).

**C. Bulk price correction from MATRIZ**
- Prefer doing this in the normal PricingEditor + push overrides when possible.
- Use Maestro only when you also need to align stock views.

---

## Troubleshooting

- **No data visible** → Check that you have `BMC_MATRIZ_SHEET_ID` and `BMC_STOCK_SHEET_ID` configured and the API is running with proper Google credentials.
- **Write fails** → Confirm you have a valid admin-level `API_AUTH_TOKEN`.
- **Reconcile shows many gaps** → Normal when first linking the two workbooks. Prioritize high-volume items.

---

## Related Commands

- `npm run productos-maestro:reconcile`
- `npm run productos-maestro:reconcile:json`

---

**If in doubt, simulate first and ask.**

This runbook will be expanded as the feature matures.
