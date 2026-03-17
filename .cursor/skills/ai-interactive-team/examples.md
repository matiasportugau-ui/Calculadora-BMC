# AI Interactive Team — Examples

## Example 1: New tab affects both

**Mapping Agent:** "New tab `Metas_Ventas` exists. Fields: Periodo, Tipo, Meta, Notas. Affects dashboard Metas section. **Log for Design:** Add table with these columns; optional dataset (degrade cleanly if empty)."

**Design Agent:** "I will add a Metas table in the support grid. Columns: Periodo, Tipo, Meta, Notas. Empty state: 'Sin metas cargadas.' **Log for Mapping:** Confirm GET /api/metas-ventas returns `{ ok, data }`; I consume `data`."

**Mapping Agent:** "Agreed. Contract confirmed."

---

## Example 2: Escalation

**Mapping Agent:** "Pagos_Pendientes uses MONEDA as string; some rows have 'UYU' others '$'. Affects currency selector."

**Design Agent:** "I need a single currency key per row. Mixed values break the selector."

**Mapping Agent:** "I can normalize server-side to $ and UES only. But that loses UYU."

**Design Agent:** "We need user input: add UYU as third option, or normalize to $?"

**Both:** "Call user. Unanimous approval not reached. Decision needed: currency handling for UYU."

---

## Example 3: Multiple agents in parallel

**User:** "Mapping agent: inventory the workbook. Design agent: review the current dashboard structure."

**Mapping Agent** (output): Planilla inventory with tabs, status (active_now, conditional, blueprint-only).

**Design Agent** (output): Dashboard structure map with sections, blocks, data sources.

**User:** "Now both: cross-reference. Mapping, add dashboard block to each tab. Design, add sheet source to each block."

**Both** (shared output): Cross-reference table with Planilla/tab ↔ Dashboard block ↔ API route ↔ Status.

---

## Example 4: Networks agent affects Mapping and Design

**Networks Agent:** "Hosting migration to Netuy VPS. New base URL: `https://dashboard.bmc.example.com`. Ports 3001, 3849 behind nginx. **Log for Mapping:** Sheets credentials unchanged; verify API reachable from VPS. **Log for Design:** No hardcoded localhost; use relative /api for fetch."

**Mapping Agent:** "Agreed. Planilla map and API contracts unchanged. I document prod URL in cross-reference."

**Design Agent:** "API calls already use relative paths. **Log for Networks:** Confirm nginx proxies /api and /finanzas; CORS headers for production domain."

**Networks Agent:** "Agreed. Nginx config will include proxy and CORS. Migration checklist added to HOSTING-EN-MI-SERVIDOR.md."
