# calculate_quote — Diagnostic Report

**Date:** 2026-04-06
**Endpoint version:** v3.1.5 (package.json)
**Diagnosticado por:** Claude Code (claude-sonnet-4-6)

---

## 1. Endpoint Location

| Campo | Valor |
|-------|-------|
| Archivo | `server/routes/legacyQuote.js` |
| Línea v1 | 223 |
| Línea v2 | 264 |
| Framework | Express 5.x |
| Montado en | `server/index.js` → `app.use("/", legacyQuoteRouter)` |
| URL producción v1 | `POST https://panelin-calc-q74zutv7dq-uc.a.run.app/calculate_quote` |
| URL producción v2 | `POST https://panelin-calc-q74zutv7dq-uc.a.run.app/calculate_quote_v2` |

**Nota:** También registrado en OpenAPI como `https://panelin-calc-642127786762.us-central1.run.app` (URL alternativa Cloud Run, mismo proyecto).

---

## 2. Data Flow (input → output)

### Input — Body JSON

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `product_id` | string | *requerido* | ID canónico del panel (ej: `ISODEC-EPS-100mm`) |
| `length_m` | number | *requerido* | Largo en metros |
| `width_m` | number | *requerido* | Ancho en metros |
| `quantity` | integer | 1 | Cantidad de paños/unidades |
| `discount_percent` | number | 0 | Descuento % (0–30). **Solo en v1** |
| `include_tax` | boolean | true | Aplica IVA 22% |
| `lista` | string | `"web"` | Lista de precios: `"web"` (público Shopify) o `"venta"` (BMC directo) |

**v2 no acepta `discount_percent`** — siempre 0%.

### Autenticación

`requireApiKey` — Header `X-API-Key` debe coincidir con `config.apiAuthToken` (= `API_AUTH_TOKEN` env var).

- Sin key → 401 `AUTH_REQUIRED`
- Sin config → 503 `AUTH_NOT_CONFIGURED`

### Validaciones

1. Product no encontrado → 404 `PRODUCT_NOT_FOUND`
2. `length_m <= 0` o `width_m <= 0` → 422 `INVALID_DIMENSIONS`
3. **v2 extra**: `total <= 0 || price_usd_m2 <= 0` → 422 `PRICING_INCONSISTENT`

### Motor de cálculo (`quoteMath`)

```
area     = length_m × width_m
subtotal = price_usd_m2 × area × quantity
discount = subtotal × (discount_percent / 100)   [clamped 0–30%]
preTax   = subtotal - discount
total    = include_tax ? preTax × 1.22 : preTax
```

**NO hay BOM.** No calcula tornillos, cintas, perfiles, selladores, ni cuenta paneles discretos.

### Output — Body JSON exitoso

```json
{
  "product_id": "ISODEC-EPS-100mm",
  "unit_price": 45.97,
  "area_m2": 50,
  "quantity": 1,
  "subtotal": 2298.50,
  "discount": 0,
  "total": 2804.17,
  "tax_included": true
}
```

**v2 agrega `"ok": true`** al root del response.

### Ejemplo request/response real (prod, 2026-04-06)

```bash
# v1 — lista web
curl -X POST https://panelin-calc-q74zutv7dq-uc.a.run.app/calculate_quote \
  -H "X-API-Key: [AUTH]" \
  -d '{"product_id":"ISODEC-EPS-100mm","length_m":10,"width_m":5,"quantity":1}'
# → {"product_id":"ISODEC-EPS-100mm","unit_price":45.97,"area_m2":50,"quantity":1,"subtotal":2298.5,"discount":0,"total":2804.17,"tax_included":true}

# v1 — lista venta, qty 5
curl -X POST https://panelin-calc-q74zutv7dq-uc.a.run.app/calculate_quote \
  -H "X-API-Key: [AUTH]" \
  -d '{"product_id":"ISOPANEL-EPS-50mm","length_m":8,"width_m":3,"quantity":5,"lista":"venta"}'
# → {"product_id":"ISOPANEL-EPS-50mm","unit_price":34.32,"area_m2":24,"quantity":5,"subtotal":4118.4,"discount":0,"total":5024.45,"tax_included":true}

# v2
curl -X POST https://panelin-calc-q74zutv7dq-uc.a.run.app/calculate_quote_v2 \
  -H "X-API-Key: [AUTH]" \
  -d '{"product_id":"ISODEC-EPS-100mm","length_m":10,"width_m":5}'
# → {"ok":true,"product_id":"ISODEC-EPS-100mm","unit_price":45.97,"area_m2":50,"quantity":1,"subtotal":2298.5,"discount":0,"total":2804.17,"tax_included":true}
```

---

## 3. BOM Engine State

**No existe BOM engine en `calculate_quote`.** El endpoint es un cotizador de precio por m², no un calculador de BOM completo.

### Lo que SÍ existe (pero no está integrado aquí)

| Función | Archivo | Descripción |
|---------|---------|-------------|
| `calcTechoCompleto()` | `src/utils/calculations.js` | Motor completo: paneles + fijaciones + perfilería + selladores + autoportancia |
| `calcParedCompleto()` | `src/utils/calculations.js` | Motor completo pared: paneles + perfiles U + esquineros + fijaciones + selladores |
| `calcTotalesSinIVA()` | `src/utils/calculations.js` | Subtotal + IVA 22% sobre BOM completo |
| `bomToGroups()` | `src/utils/helpers.js` | Transforma resultados en grupos de BOM |
| `POST /calc/cotizar` | `server/routes/calc.js:406` | Endpoint que SÍ usa el motor completo |

### Brecha funcional

`calculate_quote` vs `POST /calc/cotizar`:

| Capacidad | `calculate_quote` | `/calc/cotizar` |
|-----------|:-----------------:|:---------------:|
| Precio m² | ✅ | ✅ |
| Conteo paneles (ancho útil) | ❌ | ✅ |
| Fijaciones (varillas, tornillos) | ❌ | ✅ |
| Perfilería (U, cumbrera) | ❌ | ✅ |
| Selladores (silicona, cinta) | ❌ | ✅ |
| Autoportancia | ❌ | ✅ |
| Math.ceil() en cantidades | ❌ | ✅ |
| IVA 22% | ✅ | ✅ |
| BOM en grupos | ❌ | ✅ |

### Ancho útil (au) — ausente en calculate_quote

La cantidad real de paneles no es simplemente `width_m / ancho_panel`. Cada familia tiene un ancho útil distinto:

| Familia | au (m) |
|---------|--------|
| ISODEC EPS / PIR | 1.12 |
| ISOROOF 3G / FOIL / PLUS / COLONIAL | 1.00 |
| ISOPANEL EPS | 1.14 |
| ISOWALL PIR | 1.10 |

`calculate_quote` ignora `au` por completo.

---

## 4. Price Source

### Fuente activa: `src/data/constants.js` — hardcoded JSON

Los precios están **100% embebidos en código** en `src/data/constants.js`. El endpoint los lee directamente via `import { p, setListaPrecios }`.

**No hay consulta a Google Sheets en tiempo de ejecución para `calculate_quote`.** El endpoint lee precios compilados al momento del deploy.

### Precios actuales en código (sin IVA, USD/m²)

| Panel | Espesor | web | venta | costo |
|-------|---------|-----|-------|-------|
| ISODEC EPS | 100mm | 45.97 | 37.76 | 33.93 |
| ISODEC EPS | 150mm | 51.71 | 42.48 | 38.17 |
| ISODEC EPS | 200mm | 57.99 | 47.64 | 42.81 |
| ISODEC EPS | 250mm | 63.74 | 52.35 | 47.05 |
| ISODEC PIR | 50mm | 50.91 | 41.82 | 37.58 |
| ISODEC PIR | 80mm | 52.04 | 42.75 | 38.42 |
| ISODEC PIR | 120mm | 62.55 | 51.38 | 46.18 |
| ISOROOF 3G | 30mm | 48.63 | 39.95 | 35.90 |
| ISOROOF 3G | 40mm | 51.10 | 41.98 | 37.72 |
| ISOROOF 3G | 50mm | 53.56 | 44.00 | 39.54 |
| ISOROOF 3G | 80mm | 62.98 | 51.73 | 46.49 |
| ISOROOF 3G | 100mm | 69.15 | 56.80 | 51.04 |
| ISOPANEL EPS | 50mm | 41.79 | 34.32 | 30.85 |
| ISOPANEL EPS | 100mm | 45.97 | 37.76 | 33.93 |
| ISOWALL PIR | 50mm | 54.54 | 46.74 | 40.26 |
| ISOWALL PIR | 80mm | 65.03 | 55.74 | 48.01 |
| ISOWALL PIR | 100mm | 71.71 | 58.90 | 52.94 |

*(Lista parcial — ISOROOF FOIL, PLUS, COLONIAL y ISODEC EPS Pared también disponibles)*

### Flujo de sincronización de precios (manual, no automático)

```
Matriz de Costos 2026 (Google Sheets)
    → GET /api/actualizar-precios-calculadora
    → Descarga CSV (buildPlanillaDesdeMatriz)
    → Usuario importa manualmente en la calculadora
    → Frontend aplica overrides vía pricingOverrides.js (localStorage)
    → NO actualiza constants.js ni afecta calculate_quote en producción
```

**Conclusión: Para que un cambio de precio llegue a `calculate_quote` en producción, se requiere:**
1. Editar `src/data/constants.js` manualmente
2. Hacer commit + push
3. Disparar el deploy de Cloud Run

### Verificación en vivo (2026-04-06)

```
ISODEC-EPS-100mm (lista=web): unit_price=45.97 ✅ coincide con constants.js
ISOPANEL-EPS-50mm (lista=venta): unit_price=34.32 ✅ coincide con constants.js
```

---

## 5. Deploy State

### Cloud Run — API

| Campo | Valor |
|-------|-------|
| URL canónica (activa) | `https://panelin-calc-q74zutv7dq-uc.a.run.app` |
| URL OpenAPI | `https://panelin-calc-642127786762.us-central1.run.app` |
| GCP Project | `chatbot-bmc-live` |
| Region | `us-central1` |
| Service name | `panelin-calc` |
| Estado `/ready` | `{"ok":true,"ready":true,"missingConfig":[]}` ✅ |
| Instancias | 0–10, 256Mi, 1 CPU, timeout 30s |

### Dockerfile (server/Dockerfile)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "server/index.js"]
```

### Variables de entorno requeridas en Cloud Run

| Variable | Estado esperado prod |
|----------|---------------------|
| `API_AUTH_TOKEN` | Configurada (autenticación X-API-Key) |
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` | Para OAuth ML |
| `TOKEN_ENCRYPTION_KEY` | Para tokens ML encriptados |
| `BMC_SHEET_ID` | Para Dashboard Finanzas |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON (vía secret mount) |
| `ANTHROPIC_API_KEY` | Para suggest-response |
| `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_ACCESS_TOKEN` | Para webhooks WA |
| `PUBLIC_BASE_URL` | URL pública del servicio |

### Seguridad — Password hardcodeada

`grep -rn "mywolfy"` → **sin resultados**. No hay password `mywolfy` en el código.

**ADVERTENCIA: `API_AUTH_TOKEN=Metalbmc12312.` está visible en el `.env` local.** El `.env` está en `.gitignore` y no es parte del repositorio público, pero si se commitea accidentalmente quedaría expuesto. El valor debe rotarse si fue expuesto en Cloud Run logs/env vars sin encriptar.

---

## 6. Live Test Results

### Servidor local: NO CORRE al momento del diagnóstico

```
curl http://localhost:3001/ready → sin respuesta (timeout)
```

### Cloud Run (producción): OPERATIVO ✅

```bash
# Test 1: /ready
GET /ready → {"ok":true,"ready":true,"missingConfig":[]} ✅

# Test 2: calculate_quote v1 - lista web
POST /calculate_quote
Body: {"product_id":"ISODEC-EPS-100mm","length_m":10,"width_m":5,"quantity":1}
→ HTTP 200: {"product_id":"ISODEC-EPS-100mm","unit_price":45.97,"area_m2":50,"quantity":1,"subtotal":2298.5,"discount":0,"total":2804.17,"tax_included":true} ✅

# Test 3: calculate_quote v1 - lista venta, multi-quantity
POST /calculate_quote
Body: {"product_id":"ISOPANEL-EPS-50mm","length_m":8,"width_m":3,"quantity":5,"lista":"venta"}
→ HTTP 200: {"product_id":"ISOPANEL-EPS-50mm","unit_price":34.32,"area_m2":24,"quantity":5,"subtotal":4118.4,"discount":0,"total":5024.45,"tax_included":true} ✅

# Test 4: calculate_quote_v2
POST /calculate_quote_v2
Body: {"product_id":"ISODEC-EPS-100mm","length_m":10,"width_m":5}
→ HTTP 200: {"ok":true,"product_id":"ISODEC-EPS-100mm","unit_price":45.97,"area_m2":50,"quantity":1,"subtotal":2298.5,"discount":0,"total":2804.17,"tax_included":true} ✅

# Test 5: Auth falla - key incorrecta
POST /calculate_quote -H "X-API-Key: WRONG"
→ HTTP 401: {"ok":false,"error_code":"AUTH_REQUIRED","detail":"Invalid or missing X-API-Key"} ✅

# Test 6: Dimensiones inválidas
POST /calculate_quote -d '{"product_id":"ISODEC-EPS-100mm"}'
→ HTTP 422: {"ok":false,"error_code":"INVALID_DIMENSIONS","error":"length_m and width_m must be > 0"} ✅

# Test 7: Producto no encontrado
POST /calculate_quote -d '{"product_id":"PANEL_FANTASMA","length_m":5,"width_m":2}'
→ HTTP 404: {"ok":false,"error_code":"PRODUCT_NOT_FOUND","detail":"Product not found: PANEL_FANTASMA"} ✅
```

**Conclusión: El endpoint funciona correctamente en producción. No hay precio=0 ni errores de cálculo.**

---

## 7. Test Coverage

### Tests existentes

| Archivo | Descripción |
|---------|-------------|
| `tests/validation.js` | 13+ suites de validación de cálculo (BOM engine, motor techo/pared) |
| `tests/roofVisualQuoteConsistency.js` | Consistencia visual de cotización de techo |
| `tests/chat-hardening.js` | Tests de hardening del chat Panelin |
| `tests/e2e-browser.mjs` | E2E con Playwright |
| `scripts/validate-api-contracts.js` | Contratos de API (requiere server corriendo en 3001) |

### Cobertura de `calculate_quote`

- **`tests/validation.js`**: 0 tests sobre `calculate_quote` o `legacyQuote.js`
- **`scripts/validate-api-contracts.js`**: 0 contratos para `/calculate_quote`
- **`tests/e2e-browser.mjs`**: No cubre este endpoint
- **CI (`ci.yml`)**: Solo corre `node tests/validation.js` + lint + build — ninguno cubre legacyQuote

**⚠️ ZERO cobertura automatizada de `calculate_quote` en toda la suite de tests.**

### BUG-01 en validation.js (referenciado en suite 13)

```
SUITE 13: Flete BOM (fix BUG-01)
```

Este bug está en el BOM engine de techo, no en `calculate_quote`. No hay bugs activos registrados específicamente en `legacyQuote.js`.

---

## 8. Google Sheets Connection

### Para `calculate_quote` — SIN conexión a Sheets

El endpoint legacyQuote.js importa únicamente desde `src/data/constants.js`. No realiza ninguna llamada a la Sheets API.

### Conexión Sheets para precios (Dashboard / actualizar-precios)

| Campo | Valor |
|-------|-------|
| Sheet ID | `BMC_MATRIZ_SHEET_ID` (default hardcodeado: `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`) |
| Credenciales | `GOOGLE_APPLICATION_CREDENTIALS` → path al service account JSON |
| Tabs leídas | Depende de `matrizPreciosMapping.js` (col D = SKU, mapea a path en constants.js) |
| Auth | Google Auth via `googleapis` (`google.auth.GoogleAuth`) |
| Fallback | `GET /api/actualizar-precios-calculadora` → 503 si no hay credenciales |

### Estado en Cloud Run (inferido)

El `/health` del servidor no reporta `hasSheets` como crítico para `/calculate_quote`. La conexión a Sheets solo afecta rutas del Dashboard (`/api/cotizaciones`, `/api/ventas`, etc.), **no a legacyQuote**.

---

## 9. Front-end Integration

### Desde el frontend React — NO usa `calculate_quote`

```bash
grep -rn "calculate_quote" src/ → sin resultados
```

El frontend **no llama a este endpoint directamente**. Usa:
- `POST /calc/cotizar` (via proxy Vite `/calc` → `localhost:3001/calc`)
- `POST /calc/cotizar/presupuesto-libre`

### Proxy Vite

```js
// vite.config.js
proxy: {
  '/calc': { target: 'http://localhost:3001', changeOrigin: true },
  '/api':  { target: 'http://localhost:3001', changeOrigin: true },
}
```

`/calculate_quote` no está cubierto por el proxy (está en `/`, no en `/calc` ni `/api`).

### Consumidores conocidos de `calculate_quote`

El endpoint está diseñado como **GPT Action** (ver `docs/openapi-calc.yaml`):
- GPT Builder de OpenAI lo llama via `X-API-Key`
- Posibles integraciones externas (ML chatbot, Shopify, etc.)
- CLI scripts/agentes que usen la API directamente

---

## 10. Known Bugs

### En `legacyQuote.js` / `calculate_quote`

| # | Tipo | Descripción | Severidad |
|---|------|-------------|-----------|
| B-01 | Diseño | **Sin BOM**: no calcula accesorios (tornillos, cintas, perfiles, esquineros). El total no refleja el costo real de materiales para una obra. | Alta |
| B-02 | Diseño | **Sin ancho útil**: `area = length_m × width_m` ignora que los paneles tienen `au` ≠ 1m. La cantidad real de paneles necesarios no se calcula. | Alta |
| B-03 | Lista precios | **Default `lista="web"`** devuelve precio público Shopify (más alto). Si un vendedor usa este endpoint para cotizar al cliente directo, debería usar `lista="venta"`. El default puede confundir. | Media |
| B-04 | Sin ROUNDUP | No aplica `Math.ceil()` en ningún valor. En la calculadora real todas las cantidades se redondean hacia arriba. | Media |
| B-05 | Descuento v1 | `discount_percent` permite hasta 30% sin autenticación adicional. Cualquier holder del API key puede aplicar descuentos máximos. | Baja |
| B-06 | No `ok: true` | v1 no devuelve `"ok": true` en respuestas exitosas, a diferencia del resto de la API. Inconsistencia de schema. | Baja |
| B-07 | Precios estáticos | Cambiar precios requiere deploy. No hay hot-reload desde Sheets. | Media |

### En tests (relacionado)

```
tests/validation.js:398: // SUITE 13: Flete BOM (BUG-01 fix validation)
```
BUG-01 del BOM engine (flete) está testeado y corregido, pero es un bug del motor de cálculo completo, no de `calculate_quote`.

### TODOs/TODO en código relevante

```js
// omnicrm-sync/platforms/mercadolibre/ml-api.js:332
// TODO: Encrypt tokens using Web Crypto API (AES-GCM) before storage
```

No hay TODOs directamente en `legacyQuote.js`.

---

## 11. Blocker Summary (what prevents production)

### Estado actual: FUNCIONA pero con limitaciones importantes

El endpoint está **operativo en producción**. Responde correctamente, los precios son exactos, la autenticación funciona. No hay bloqueantes técnicos inmediatos.

### Blockers para uso en cotizaciones profesionales (BOM completo)

| Prioridad | Blocker | Impacto | Acción requerida |
|-----------|---------|---------|-----------------|
| 🔴 ALTA | Sin BOM de materiales | Una cotización real requiere tornillos, cintas, selladores, perfiles — el endpoint solo da precio del panel | Integrar con `/calc/cotizar` o crear `calculate_quote_v3` que llame a `calcTechoCompleto`/`calcParedCompleto` |
| 🔴 ALTA | Sin conteo de paneles (au) | El cliente recibe precio por m² total pero no sabe cuántos paneles necesita | Agregar `panel_count = Math.ceil(width_m / au)` a la respuesta |
| 🟡 MEDIA | Precios estáticos (require deploy) | Si cambian precios en Matriz, hay lag hasta el próximo deploy | Agregar sync dinámico desde Sheets o validar que CI actualice constants.js automáticamente |
| 🟡 MEDIA | Zero test coverage | Un regression en el motor de precios o en `quoteMath` no sería detectado | Agregar al menos 5 assertions en `validation.js` cubriendo `quoteMath`, resolución de productos, y edge cases |
| 🟡 MEDIA | `lista="web"` default | Vendedores que usan GPT Actions pueden estar entregando precios Shopify (más altos) sin saberlo | Documentar claramente, o cambiar default a `"venta"` para uso interno |
| 🟢 BAJA | Schema inconsistente v1/v2 | v1 no tiene `"ok":true`, v2 sí. Clientes que validan el campo `ok` fallarán en v1 | Agregar `ok: true` en respuesta v1 |
| 🟢 BAJA | `API_AUTH_TOKEN` en `.env` | El valor está en archivo local (`.gitignore` cubre esto, no está committed) | Verificar que Cloud Run no exponga la var en logs; considerar rotación periódica |

### Conclusión ejecutiva

> `POST /calculate_quote` funciona y sirve para dar un **precio rápido por m² de panel**, ideal para GPT Actions o estimaciones iniciales. **NO es apto** como cotización formal de obra porque carece de BOM completo (accesorios, perfilería, selladores) y no cuenta paneles discretos. El endpoint correcto para cotizaciones completas es `POST /calc/cotizar`.
