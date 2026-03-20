---
name: actualizar-precios-calculadora
description: >
  Actualiza los precios de la Calculadora BMC desde la MATRIZ de COSTOS y VENTAS 2026.
  Lee col G (costo) y col L (venta) de la planilla Google, mapea SKUs a paths de la calculadora,
  genera CSV para "Importar planilla modificada". Use cuando el usuario pida: actualizar precios
  calculadora, sincronizar precios desde MATRIZ, levantar precios de la planilla,
  /actualizar-precios-calculadora, o consultar precios desde la matriz.
---

# Actualizar Precios Calculadora desde MATRIZ

Sincroniza precios de la [MATRIZ de COSTOS y VENTAS 2026](https://docs.google.com/spreadsheets/d/1VBbVay7pwPgC40CWCIr35VbKVuxPsKBZ/edit?gid=1520466943) con la planilla editable de la Calculadora.

## Flujo

1. **Servidor corriendo:** `npm run start:api` (puerto 3001)
2. **Consultar:** `GET /api/actualizar-precios-calculadora`
3. **Descargar CSV** que devuelve el endpoint
4. **En la Calculadora:** Config → Listado de precios → **Importar planilla modificada** → seleccionar el CSV

## Requisitos

- `BMC_MATRIZ_SHEET_ID` en `.env` (default: 1VBbVay7pwPgC40CWCIr35VbKVuxPsKBZ)
- `GOOGLE_APPLICATION_CREDENTIALS` apuntando al service account
- MATRIZ compartida con el service account como **Lector**

## Mapeo

- **Col D:** SKU (IAGRO30, IROOF30, GFS30, etc.)
- **Col G:** Costo compra (con IVA) → se divide por 1.22
- **Col L:** Venta consumidor (con IVA) → se divide por 1.22
- **Col M:** Venta web (con IVA) → se divide por 1.22

Ver `src/data/matrizPreciosMapping.js` para extender el mapeo SKU → path.

## Documentación

`docs/google-sheets-module/MATRIZ-PRECIOS-CALCULADORA.md`
