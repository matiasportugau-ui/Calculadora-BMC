# GAP-PLAN — BMC Envíos — 2026-08-05 (post Wave 2 F7–F11)

## Score actual: **96**/100 → Target: ≥90 — **PASS**

## Summary

U1–U3 + Ops UX F1–F6 + P2/P5 MVP + **Wave 2 F7–F11** (buttons, identity, client highlight, stack above/below, Ventas proxy). Residual product: P3, P2b, P5b, F10b DnD list.

| ID | Gap | Severity | Status | Notes |
|----|-----|----------|--------|-------|
| G-DOC-01..08 | Parent SDD lag vs Ops UX | P0/P1 | **[x]** | SDD v1.4+ |
| G-U3 | FSM STOP_STATUS | P2 | **[x]** | #857 |
| G-P2 / G-P5 | Geocode + drafts MVP | P2 | **[x]** | v1.5 |
| G-F7 | Ghost buttons on dark panel | P0 | **[x]** | `btnStyle` onDark |
| G-F8 | Package identity k/N | P0 | **[x]** | `packageIdentity.js` |
| G-F9 | Client group + drawer docs | P0 | **[x]** | DiagramPanel drawer |
| G-F10 | Stack above/below | P1 | **[x]** | packageDrop moveRelative |
| G-F10b | List DnD reorder packages | P2 | **[x]** | packageListDnD + PackageLayoutList |
| G-F11 | Ventas fetch harden | P0 | **[x]** | proxy + errors + persist view |
| G-P2b | Distance Matrix / TSP | P3 | **OPEN** | — |
| G-P3 | CBM non-panel | P2 | **OPEN** | — |
| G-P5b | Autosave cloud | P3 | **OPEN** | — |

## Gaps abiertos en la revisión 2026-08-08

Fuente: [`SDD-LOGISTICA-REVISION-2026-08-08.md`](../SDD-LOGISTICA-REVISION-2026-08-08.md).

| ID | Gap | Severity | Status | Notes |
|----|-----|----------|--------|-------|
| G-VISOR-01 | `TruckVisual` captura punteros y bloquea cámara / free-drag sobre la cabina (V1) | **P0** | **OPEN** | ADR-028; `TruckVisual.jsx:285-300` |
| G-VISOR-02 | `truckL` sin coerción numérica al restaurar draft → coordenadas NaN (V2) | **P1** | **OPEN** | `BmcLogisticaApp.jsx:1961` |
| G-VISOR-03 | Visor sin cobertura de comportamiento; el único test es un grep estructural (V7) | P1 | **OPEN** | `tests/truckAxles.test.js` |
| G-VISOR-04 | Luces dinámicas fuerzan recompilación de shaders (V3) | P2 | **OPEN** | `TruckVisual.jsx:256-282` |
| G-ETIQ-01 | Sin etiquetas de bulto ni de encomienda | P1 | **OPEN** | Diseño en `SDD-ETIQUETAS-BULTOS.md` |
| G-REMITO-01 | Sin remito por cliente firmable; solo existe el de viaje | P1 | **OPEN** | Diseño en `SDD-REMITO-CLIENTE.md` |
| G-DATA-01 | `trips` y `repartos` son modelos de viaje paralelos sin FK entre sí | P1 | **OPEN** | Ningún SDD previo lo nombraba |
| G-DATA-02 | `reparto_documents` existe y nunca se escribe | P2 | **OPEN** | Primer escritor en `SDD-REMITO-CLIENTE.md` §8 |
| G-TEST-01 | `repartoNumber`, `repartoStatus` y `repartos-api.integration` fuera de todo script npm | P1 | **OPEN** | 0 menciones en `package.json` |
| G-TEST-02 | Endpoints de `transportista.js` sin tests HTTP | P2 | **OPEN** | `/api/trips/*`, `/api/driver/*` |
| G-SEC-01 | `POST /api/pdf/generate` sin auth, con documentos que llevan datos de cliente | P2 | **OPEN** | `server/routes/pdf.js:32` |
| G-CFG-01 | `DRIVE_REPARTOS_FOLDER_ID` referenciada en código pero nunca leída ni definida | P3 | **OPEN** | `server/routes/repartos.js:319` |

## Non-goals

Courier multi-modal, free 3D physics drag, Theme Studio (other module), emisión de CFE fiscal (e-Remito), integración por API con agencias de encomienda.
