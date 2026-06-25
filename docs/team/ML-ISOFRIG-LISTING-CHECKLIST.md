# IsoFrig "Sala Limpia" — MercadoLibre listing checklist

> The IsoFrig PIR cold-room / clean-room panel line is costed in the matriz (Bromyros) but
> absent from ML except the 40 mm. This is the publish plan for the missing 60–200 mm.
> Status: **blocked on create-endpoint + photos** (see below). Reactivations of existing
> listings are already done; this doc covers the NEW listings only.

## Why this isn't auto-published
The backend exposes `PATCH /ml/items/:id` (edit) but **no `POST /ml/items` (create)**. Creating
listings also needs product photos (none on file for 60–200 mm) and human-approved copy. So this
is a checklist, not an automated step. Two execution paths:
- **A — Manual (fastest):** clone the live 40 mm listing in ML's web UI 5× and adjust per row below.
- **B — API (repeatable):** add a `POST /ml/items` route + a "Nueva publicación" form in /hub/ml-manager,
  then publish from the dashboard. Larger effort; do only if listings will be created regularly.

## Clone template — copy from the live 40 mm listing
**Source listing:** `MLU444372549` (IsoFrig/poliuretano 40 mm, 194 sold, health 1.0) [CONFIRMED]
- category_id: **MLU403698**
- listing_type_id: **gold_special** · condition: **new** · currency_id: **USD** · buying_mode: buy_it_now
- attributes: BRAND=BMC URUGUAY · ITEM_CONDITION=Nuevo · MODEL=TECNOPANEL · SALE_FORMAT=Unidad
- unit of sale: m² (price is per m²)

## Rows to publish (prices from matriz de costos y ventas — Bromyros)
| SKU | thickness | costo USD | venta_local (sin IVA) | **price to list (con IVA)** |
|---|---|---|---|---|
| IF60 | 60 mm | 44.92 | 51.66 | **63.03** |
| IF80 | 80 mm | 49.55 | 56.99 | **69.53** |
| IF100 | 100 mm | 54.96 | 63.21 | **77.11** |
| IF150 | 150 mm | 66.67 | 76.68 | **93.54** |
| IF200 | 200 mm | 79.29 | 91.18 | **111.24** |

> Price column = `venta_local_iva_inc` from the matrix. This matches how ISOROOF is priced on ML
> (ML price == matrix IVA-incl, 0% delta). Confirm the IVA-inclusive convention before publishing.

## Per-listing checklist
- [ ] Title: e.g. "IsoFrig Sala Limpia 100mm - Panel Poliuretano Cámara De Frío" (no price/promo text in title)
- [ ] Photos: ≥4 real product photos (reuse 40 mm imagery or the product-clips `work/` assets; NO spec diagrams/renders)
- [ ] category MLU403698, gold_special, USD, condition new
- [ ] attributes per template above; set thickness attribute if the category exposes one
- [ ] price per table; available_quantity > 0
- [ ] description: technical (R-value, core PIR, uso cámara de frío / sala limpia)
- [ ] after publish: record the new MLU id back in `product-clips/out/bromyros-ml-gap.csv`

## Verify after publishing
- `GET /ml/items/<newId>` → status active, correct price, ≥4 pictures, health ≥ 0.8
- Re-run `node product-clips/scripts/ml-listing-audit.mjs` → active count rises by 5; IsoFrig no longer "MISSING_FROM_ML"
