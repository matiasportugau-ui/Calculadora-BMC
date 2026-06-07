# Golden cases — catalog price assertions

Deterministic, network-free assertions that key catalog prices in
`src/data/constants.js` match the commercial source of truth (the "Matriz de
Costos y Ventas Dashboard"). Each case is a standalone Node script that exits
non-zero on drift. These complement the LLM-prompt evals under `evals/promptfoo/`.

All prices are **ex-IVA** (per decision D1: IVA 22% is applied once at the quote
total). `venta` ← Matriz "venta local ex IVA" (default internal list);
`web` ← Matriz "web ex IVA" (= MercadoLibre for now).

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
