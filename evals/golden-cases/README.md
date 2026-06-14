# Golden cases — catalog price assertions

Deterministic, network-free assertions that key catalog prices in
`src/data/constants.js` match the commercial source of truth (the "Matriz de
Costos y Ventas Dashboard"). Each case is a standalone Node script that exits
non-zero on drift. These complement the LLM-prompt evals under `evals/promptfoo/`.

All prices are **ex-IVA** (per decision D1: IVA 22% is applied once at the quote
total). `venta` ← Matriz "venta local ex IVA" (default internal list);
`web` ← Matriz "web ex IVA" (= MercadoLibre for now).

Run all catalog golden cases through the normal core test target:

```bash
npm run test:golden-cases
```

`npm test` also runs them via `test:core`.

## GC-0001 — WOLF-2026-0001 ISOFRIG family

Guards the ISOFRIG PIR commercial invariants:

- **Panel 100 mm web** → **76.9454** ex IVA and 10 m² → **769.45** ex IVA.
- **Panel 100 mm venta** → **58.01** ex IVA and 10 m² → **580.10** ex IVA.
- **Real panel thicknesses** are **40,60,80,100,120,150,180** only; cloned 200 mm row excluded.
- **Technical data**: `au` **1.10**, sanitary **Blanco** only.
- **Perfil U ISOFRIG** only includes confirmed price thicknesses **80,100,150**.

## GC-0002 — WOLF-2026-0002 price realignment

Guards the two anchor values that exposed the column/row shift in the original
extraction (see `BUG-TRIAGE-RAMIRO.md`, ticket WOLF-2026-0002):

- **(a)** `anclaje_isoroof_gris` web list, 100 units → **215.00** ex IVA (2.15 c/u).
- **(b)** `gotero_superior` cámara 80 mm (`ISODEC_PIR[80]`, SKU `GSDECAM80`) web
  unit price → **37.07** ex IVA.

Run:

```bash
node evals/golden-cases/GC-0002.test.mjs
```

Green = `GC-0002 ✓`; any drift exits 1.

## GC-0003 — WOLF-2026-0003 edge accessories

Guards the camera edge-accessory load:

- **ISODEC lateral cámara** has per-thickness rows **100,150,200,250** and no `_all` collapse.
- **GSDECAM100** superior-cámara entry is present with web **46.046** ex IVA.
- **ISODEC_PIR lateral cámara** keeps the explicit `_all` fallback SKU **GLDCAMPIR**, not the generic `GLDCAM-DC`.
