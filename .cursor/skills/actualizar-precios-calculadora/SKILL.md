---
name: actualizar-precios-calculadora
description: >
  Actualiza los precios de la Calculadora BMC desde la MATRIZ de COSTOS y VENTAS 2026.
  Lee BROMYROS: F/L/T tal cual; M ref. c/IVA tal cual; **col U** = venta web **c/IVA** → CSV `venta_web_iva_inc` (tal cual; sin push);
  genera CSV (path, costo, venta_local, venta_web, …). Use cuando el usuario pida: actualizar precios
  calculadora, sincronizar precios desde MATRIZ, levantar precios de la planilla,
  /actualizar-precios-calculadora, o consultar precios desde la matriz.
---

# Actualizar Precios Calculadora desde MATRIZ

Sincroniza precios de la [MATRIZ de COSTOS y VENTAS 2026](https://docs.google.com/spreadsheets/d/1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo/edit) con la planilla editable de la Calculadora.

## Flujo

1. **Servidor corriendo:** `npm run start:api` (puerto 3001)
2. **Consultar:** `GET /api/actualizar-precios-calculadora`
3. **Descargar CSV** que devuelve el endpoint
4. **En la Calculadora:** Config → Listado de precios → **Importar planilla modificada** → seleccionar el CSV

## Requisitos

- `BMC_MATRIZ_SHEET_ID` en `.env` (default en código: `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`)
- `GOOGLE_APPLICATION_CREDENTIALS` apuntando al service account
- MATRIZ compartida con el service account como **Lector**

## Mapeo (pestaña **BROMYROS** — `server/routes/bmcDashboard.js` `MATRIZ_TAB_COLUMNS`)

- **Col D:** SKU (IAGRO30, IROOF30, ISDEC100, etc.)
- **Col F** (`Costo m² USD ex IVA`): **sin IVA** en el número — leer/escribir **tal cual** la celda (nunca ÷ ni × 1,22).
- **Col L** (venta local ex IVA): **tal cual** la celda.
- **Col M** (referencia **c/IVA**): el número **ya incluye IVA** — **tal cual** la celda (nunca convertir).
- **Col T**: venta web lista → CSV `venta_web` y push, **tal cual**.
- **Col U** (`Venta web USD c/IVA`): → CSV `venta_web_iva_inc` **tal cual** (solo export; no push).

Ver `src/data/matrizPreciosMapping.js` para extender el mapeo SKU → path.

## Documentación

`docs/google-sheets-module/MATRIZ-PRECIOS-CALCULADORA.md`
