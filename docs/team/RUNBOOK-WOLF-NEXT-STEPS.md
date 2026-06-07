# RUNBOOK — Próximos pasos WOLF (post WOLF-2026-0002)

**Creado:** 2026-06-07 · **Contexto:** cierre de WOLF-2026-0002 (PR #276 mergeado, precios LOCAL validados). Este runbook cubre los 4 frentes abiertos. Ledger fuente: [`BUG-TRIAGE-RAMIRO.md`](../../BUG-TRIAGE-RAMIRO.md).

---

## Punto 1 — Mergear el cleanup (#284)

```bash
git fetch origin
git checkout claude/pensive-cerf-W0udE
git pull origin claude/pensive-cerf-W0udE
npm install            # si node_modules no está
npm run gate:local     # lint + tests + api tests — debe quedar verde
```

- **Merge:** PR #284 → *Ready for review* → *Squash and merge*.
- **Ignorar:** check rojo `Channels — automated pipeline (prod)` (no relacionado; ver Punto 4).

---

## Punto 2 — Mapear `R y C Tornillos` + guard en CI (alto ROI)

**Objetivo:** meter los anclajes al export validado y que la deriva precio↔Matriz falle el build.

### 2a. Mapear la pestaña — `server/routes/bmcDashboard.js`, const `MATRIZ_TAB_COLUMNS` (~L1230)

```js
const MATRIZ_TAB_COLUMNS = {
  BROMYROS: { /* ...existente... */ },
  "R y C Tornillos": {
    sku:         COL("D"),   // ⚠️ CONFIRMAR letras reales en la pestaña
    descripcion: COL("E"),
    costo:       COL("?"),   // "Costo USD EX IVA"
    ventaLocal:  COL("?"),   // "VENTA USD EX IVA"
    ventaIvaInc: COL("?"),   // "Consumidor Final"
    // SIN web: esta pestaña NO tiene columna web (→ D6 / ML-Shopify)
  },
};
```

> Abrir la pestaña y anotar la **letra exacta** de cada columna antes de codear. No tiene columna web → omitir `web` a propósito.

### 2b. Verificar el export contra la Matriz en vivo (necesita API + creds Sheets)

```bash
export GOOGLE_APPLICATION_CREDENTIALS=ruta/service-account.json
export BMC_MATRIZ_SHEET_ID=1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo
npm run start:api &                         # :3001
npm run matriz:pull-csv                      # → .runtime/matriz-precios-latest.csv
node scripts/bake-matriz-to-constants.mjs .runtime/matriz-precios-latest.csv --dry-run
```

**OK si:** el dry-run reporta **0 ediciones** en los 6 anclajes (venta/costo ya coinciden).

### 2c. Guard en CI — `.github/workflows/ci.yml`, job de tests

```yaml
      - name: Golden price cases
        run: |
          for f in evals/golden-cases/*.test.mjs; do node "$f"; done
```

(Las golden corren offline. El `matriz:reconcile-calc` completo necesita creds → dejarlo como job manual/cron, no por-PR.)

**OK si:** `for f in evals/golden-cases/*.test.mjs; do node "$f"; done` → exit 0 local; luego CI verde.

---

## Punto 3 — `web` de fijaciones desde ML/Shopify (D6)

**Decisión D6:** fuente de verdad del `web` de fijaciones = ML/Shopify. Regla: **`web_unitario = precio_pack / N`** (el web vende en packs).

### 3a. Shopify — HECHO (ver Apéndice A; relevado 2026-06-07 vía MCP).
### 3b. MercadoLibre (para los anclajes que NO están en Shopify):

```bash
export ML_CLIENT_ID=...  ML_CLIENT_SECRET=...  ML_REDIRECT_URI_DEV=...
npm run ml:verify          # valida OAuth
npm run ml:corpus-export   # exporta publicaciones ML (precios)
```

### 3c. Cargar y blindar
- Cargar los `web_unitario` confirmados como overrides o vía bake.
- Fijar golden `GC-00xx` con 1-2 valores testigo.
- **OK si:** cotización web del ítem en la calc = `precio_pack / N` de la publicación.

> No bloquea: la calc opera con lista **LOCAL** ya validada.

---

## Punto 4 — Hygiene: `Channels — automated pipeline (prod)` rojo crónico

```bash
gh run view --job <job_id> --log    # diagnóstico (o UI del check fallido)
```

**Opción A (rápida)** — en `.github/workflows/ci.yml`, job `channels_pipeline`:

```yaml
    if: github.ref == 'refs/heads/main'   # no correr en cada PR
    continue-on-error: true               # no marca fallo el check
```

**Opción B (de fondo):** arreglar la causa (suele ser secret/creds de prod ausente en contexto de PR).
**OK si:** un PR de prueba ya no muestra ese check en rojo.

---

## Apéndice A — Precios web Shopify (fijaciones), pack→unidad

Relevado 2026-06-07 (MCP Shopify, tienda BMC URUGUAY). `web_unit = precio_pack / N`.

| Producto Shopify | precio pack (USD) | N (pack) | **web_unit** | key `FIJACIONES` (constants) | web actual constants | nota |
|---|---|---|---|---|---|---|
| Caballete – Arandela trapezoidal ISOROOF | 9.20 | 10 | **0.920** | `caballete` | 0.561 | ❗ difiere |
| Arandela Carrocero 3/8 Galv. | 32.70 | 10 | **3.270** | `arandela_carrocero` | (rev) | — |
| Arandela Plana Galv. 3/8 | 4.00 | 10 | **0.400** | `arandela_plana` | (rev) | — |
| Arandela Plana Galv. 5/16 | 2.90 | 10 | **0.290** | — | — | sin key dedicada |
| Arandela Polipropileno "Tortuga" (blanco) | 26.20 | 10 | **2.620** | `arandela_tortuga`? | (rev) | gris/rojo 29.80→2.98 |
| Taco Expansivo 3/8 H° Drop-In | 8.70 | 10 | **0.870** | `taco_expansivo` | 1.353 | ❗ difiere |
| Taco Expansivo 5/16 H° Drop-In | 6.70 | 10 | **0.670** | — | — | sin key dedicada |
| Tuerca Hexagonal BSW 3/8 | 2.00 | 10 | **0.200** | `tuerca_38` | (rev) | — |
| Tuerca Hexagonal BSW 5/16 | 2.00 | 10 | **0.200** | — | — | sin key dedicada |
| Varilla Roscada BSW 3/8 (1 m) | 19.90 | 5 | **3.980** | `varilla_38` | (rev) | — |
| Varilla Roscada BSW 5/16 (1 m) | 16.20 | 5 | **3.240** | — | — | sin key dedicada |
| Tornillo T1 P. Mecha 8×1" | 5.00 | 50 | **0.100** | `tornillo_t1` | 0.0574 | ❗ difiere (~2×) |
| Tornillo Punta Aguja 5" | 17.00 | 10 | **1.700** | — | — | madera |
| Tornillo Punta Mecha 14×4 | 14.40 | 10 | **1.440** | — | — | — |
| Remache POP 5/32×1/2 Blanco | 5.00 | 50 | **0.100** | `remache_pop` | 0.0246 | ❗ difiere (~4×) |
| Remache POP Blanco (caja) | 122.79 | 1000 | **0.123** | `remache_pop` | 0.0246 | caja grande |
| **Kit Anclaje a H°** (torn. N.º10 + arand. + taco) | 11.80 | 10 | **1.180** | ⚠️ NO es `anclaje_h` | 8.00 | producto distinto (N10 vs varilla 1/4) |

### Hallazgos clave (Apéndice A)
1. **Los 6 anclajes de WOLF-0002 NO están en Shopify** como publicación individual (Isoroof Gris/Terracota, Chapas BC-18/BC-35, Kit U-Platea, Anclaje 100 mm de varilla 1/4). El único "anclaje" en Shopify es el *Kit Anclaje a H°* con tornillo N.º10 — **producto distinto** del `anclaje_h` (varilla 1/4) de constants. → Para esos 6, el `web` debe salir de **ML** (Punto 3b), no de Shopify.
2. **Varias fijaciones genéricas muestran `web` divergente** entre Shopify (unit) y `constants.js` (ej. `tornillo_t1` 0.10 vs 0.0574; `remache_pop` 0.10 vs 0.0246; `taco_expansivo` 0.87 vs 1.353; `caballete` 0.92 vs 0.561). **No tocar todavía** — registrar y decidir en WOLF-0003 si Shopify-unit pisa a constants (D6) o si hay diferencia de criterio (mayorista vs web). Es un sub-hallazgo nuevo a triage.
3. **Regla de normalización confirmada:** Shopify publica en packs (N = 5, 10, 50, 1000). Cualquier carga automática debe dividir por N el precio del pack.
