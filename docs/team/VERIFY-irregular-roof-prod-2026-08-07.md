# VERIFY — Modo irregular (prod) 2026-08-07

**URL:** https://calculadora-bmc.vercel.app  
**Baseline ship:** PR #935 → `e90f68a4` (+ dos_aguas fix `7c16944b`)

## Checklist (operator)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Open techo wizard → plant 2D | Plant visible; **Modo irregular** control present | Pending operator |
| 2 | Leave mode **OFF**, quote 6×5.6 AU 1.12 | ~**33.6 m²** panels (rect) | Pending |
| 3 | Enable **Modo irregular** → **Dibujar corte** → 2 clicks diagonal | Stepped T-xx, ruler m, angle ° | Pending |
| 4 | BOM / totals after cut | Ordered m² **&lt;** full rectangle | Pending |
| 5 | Edit L pedido on a strip → Auto | Manual then restores auto | Pending |
| 6 | **Limpiar corte** / toggle OFF | Back to rectangular BOM | Pending |
| 7 | PDF Cliente (after v1.1) | Table Largos escalonados + corte en obra | Pending |

## Automated (local / CI)

- `node tests/irregularRoofLayout.test.js` — engine + calc + scenario + multi-zone / PDF helpers
- Smoke: SPA and API health 200 post-deploy

## Notes

- Default mode OFF by design (safe for existing quotes).
- `dos_aguas`: irregular schedule **not** applied (rectangular halves) until N3.
