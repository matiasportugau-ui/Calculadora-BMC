# Competitive Analysis — BMC Uruguay / METALOG SAS

**Fecha:** 2026-07-18  
**Goal prompt:** `goal-prompt-full-competitive-sales-strategy.md`  
**Estado epistémico:** mezcla de intel in-repo (2026-06-29) + checks live parciales (2026-07-18)

---

## 1. Estructura de mercado

Mercado uruguayo de **panel sándwich aislante** (pared EPS, techo EPS/PIR, fachada premium, frigorífico), con cuatro arquetipos de rival:

| Arquetipo | Ejemplos | Cómo compiten |
|-----------|----------|---------------|
| Fabricante / marca global localizada | Kingspan Bromyros, Kingspan MontFrío | Marca, ficha técnica, red, kits vivienda |
| Metalúrgica multi-línea | BECAM | Paneles + chapas + steel framing + agro; showroom; WA |
| Importador / especialista panel | TDA, Eco Panels, Panel Sandwich Group, Casa del Panel | Cotización, asesoramiento, PUR/lana de roca |
| Instalador / galponero | Tier 2 (Duque, Isopanel Pro, etc.) | Obra llave en mano |
| Reseller MLU | EL INSUPERABLE, CELER, sin marca | Precio suelto EPS 50 mm |

**BMC (METALOG)** opera como **vendedor/operador omni**: Shopify (`bmcuruguay.com.uy`), Meta Ads → tienda, MercadoLibre, cotizador Panelin → WhatsApp. No es fábrica Kingspan; el ángulo ganador es **velocidad de cotización + kit cerrado + omni-canal**, no “somos el fabricante”.

Fuente mapa: `server/lib/marketIntel/data/competitorMap.json` — `hecho confirmado` (archivo 2026-06-29).

---

## 2. Freshness

| Fuente | Fecha | Live 2026-07-18 | Uso |
|--------|-------|-----------------|-----|
| `competitorMap.json` | 2026-06-29 | N/A (estructura) | Tiers / URLs |
| `bmcBaselinePrices.json` | 2026-06-29 | Parcial vía Shopify collection (ISOPANEL/ISODEC/USD presentes) | Precios BMC |
| `mlPulse.json` | 2026-06-29 | No re-auditado listings hoy | Higiene ML |
| `adsIntelligence.json` | 2026-06-29 | **Obsoleto vs cuenta** (post ViewContent pause / ATC) | Solo histórico |
| `keywordSeeds.json` | 2026-07-04 | N/A | SEO / copy |
| `strategies.json` | vigente repo | N/A | Plays base |
| montfrio.com.uy | — | **OK** (kits vivienda, form cotizar) | Scorecard |
| becam.com.uy | — | **OK** (paneles, WA, showroom) | Scorecard |
| tdauruguay.com | — | **OK** (Panel sandwich + WA plugin) | Scorecard |
| panelsandwich.uy | — | **OK** (venta PUR / lana de roca, CTA cotización) | Scorecard |
| bmcuruguay.com.uy | — | **OK** HTTP 200, colección paneles | Canal propio |
| bromyros.com.uy | — | **Timeout / fallo fetch** | `duda abierta` live |
| ecopanels.uy | — | 403 / fetch inestable | `duda abierta` live |
| casadelpanel.com | — | Fetch inestable | `duda abierta` live |

---

## 3. Baseline BMC (USD / m², ex-IVA salvo nota)

Fuente: `bmcBaselinePrices.json` — `hecho confirmado` (archivo).

| SKU | Familia | USD/m² |
|-----|---------|--------|
| ISOPANEL EPS 50 | pared EPS | 41.88 |
| ISODEC EPS 100 | techo EPS | 46.07 |
| ISODEC PIR 50 | techo PIR | 51.02 |
| ISOROOF 3G 30 | techo PIR | 48.74 |
| ISOROOF FOIL 3G 50 | techo PIR | 39.54 |
| ISOROOF PLUS 3G 80 | techo PIR | 71.76 |
| HIANSA 5G 30 | techo (BECAM-adj.) | 46.73 |
| ISOWALL PIR 50 | fachada | 98.50 (estimado) |

**Kit Todo en Uno claim:** $48.90/m² all-in (`strategies.json`) = base ~41.88 + fijaciones/selladores/perfiles — `inferencia` sobre composición exacta del kit.

Precios competidor **públicos listados**: casi nadie publica USD/m² en home → comparaciones de precio rival = `duda abierta` salvo mystery shopping / cotización pedida.

---

## 4. Scorecards Tier 1

### 4.1 Kingspan Bromyros — `https://www.bromyros.com.uy`
| Campo | Valor | Estado |
|-------|-------|--------|
| Tipo | Fabricante / marca | `hecho confirmado` (mapa) |
| Familias | pared EPS, techo PIR, frigorífico, fachada | mapa |
| Fortaleza | Marca Kingspan, profundidad técnica, referencia de mercado | `inferencia` |
| Debilidad vs BMC | Sitio no verificable hoy (timeout); fricción típica fabricante vs e‑commerce | `duda abierta` / `inferencia` |
| Cómo ganar | Cotización en minutos + kit precio cerrado + no pelear “marca fábrica” | estrategia |
| Amenaza | Spec architects / obras grandes | `inferencia` |

### 4.2 Kingspan MontFrío — `https://www.montfrio.com.uy`
| Campo | Valor | Estado |
|-------|-------|--------|
| Live | Kits vivienda 1–3 dorm + monoambiente; CTA “Cotizá tu proyecto”; form presupuesto | `hecho confirmado` 2026-07-18 |
| Ángulo | “Construí eficiente… isopaneles MontFrío”; instituciones / vivienda / industria | `hecho confirmado` |
| Fortaleza | Productización residencial (kits), marca Kingspan, contenido proyecto | `hecho confirmado` |
| Debilidad vs BMC | Formulario lento vs calculadora→WA; sin Shopify ATC evidente | `inferencia` |
| Cómo ganar | Kit EPS all-in + calculadora galpón/techo más rápida que form web | estrategia |

### 4.3 BECAM SA — `https://www.becam.com.uy`
| Campo | Valor | Estado |
|-------|-------|--------|
| Live | Cubiertas/paneles, showroom Av. Italia, WA +598 95 292 444, red distribuidores, Expo 2026 | `hecho confirmado` |
| Fortaleza | Escala, multi-producto (no solo panel), confianza institucional | `hecho confirmado` |
| Debilidad vs BMC | Mensaje diluido (agro, steel framing, tanques); no e‑commerce panel-first | `inferencia` |
| Cómo ganar | Especialización panel + precio m² transparente + cotizador técnico | estrategia |
| Nota SKU | HIANSA en baseline BMC → adyacencia de catálogo | `hecho confirmado` archivo |

### 4.4 TDA Uruguay — `https://www.tdauruguay.com`
| Campo | Valor | Estado |
|-------|-------|--------|
| Live | Categoría Panel sandwich; asesoramiento ingeniería; plugin WhatsApp | `hecho confirmado` |
| Tipo | Importador | mapa |
| Fortaleza | Asesoramiento + WA embebido | `hecho confirmado` |
| Debilidad vs BMC | Menos automatización de BOM/cotización dimensional | `inferencia` |
| Cómo ganar | Panelin con medidas reales + PDF + WA en un flujo | estrategia |

### 4.5 Eco Panels Uruguay — `https://ecopanels.uy`
| Campo | Valor | Estado |
|-------|-------|--------|
| Live | 403 / inestable | `duda abierta` |
| Mapa | Importador; pared/techo EPS | `hecho confirmado` mapa |
| Cómo ganar | Transparencia precio m² + stock Shopify/ML | estrategia |

### 4.6 Panel Sandwich Group — `https://panelsandwich.uy`
| Campo | Valor | Estado |
|-------|-------|--------|
| Live | Title “Venta Panel Sandwich”; meta: fabricación/venta PUR y **Lana de Roca**; CTA cotización | `hecho confirmado` |
| Fortaleza | SEO on-page agresivo “venta panel sandwich Uruguay”; núcleo alternativo (lana) | `hecho confirmado` |
| Debilidad vs BMC | Menos stack digital (calc + Meta pixel + ML manager) | `inferencia` |
| Cómo ganar | Capturar keywords P1 (`panel sandwich uruguay precio`) con landing Shopify + calc | estrategia |

### 4.7 Casa del Panel — `https://casadelpanel.com`
| Campo | Valor | Estado |
|-------|-------|--------|
| Live | Fetch inestable | `duda abierta` |
| Mapa | Mixto; techo PIR + pared EPS | `hecho confirmado` mapa |
| Cómo ganar | Misma lógica que PSG: velocidad + kit + ML | estrategia |

---

## 5. Tier 2 (resumen)

Instaladores/distribuidores (ARMCO, Isopanel Pro/Uruguay, MyF, Construmec, Galpones Duque, Flores, FOKO, Eco Ruta 8): compiten por **obra instalada**, no por m² web.  
**Implicancia:** no pelear precio de instalación; partner o “solo material + guía de montaje”.  
Fuente: mapa — `hecho confirmado` estructura; performance live — `duda abierta`.

---

## 6. Tier 3–5 (resumen)

- **T3:** frío / barracas / importadores adyacentes — oportunidades de bundle cámara (ISOFRIG) cuando el lead es frigorífico.  
- **T4 watchlist:** volumen bajo; monitorear.  
- **T5 MLU:** presión de precio en EPS 50 (`mlPulse` tendencia `presión_alta`) — `hecho confirmado` archivo 2026-06-29. Respuesta: **kit cerrado** y calidad de listing, no war de comodidad suelta.

---

## 7. Matriz posición por familia

| Familia | BMC ancla | Rival principal | Posición BMC | Movimiento |
|---------|-----------|-----------------|--------------|------------|
| Pared EPS | $41.88/m² (50) | MLU Tier5 + MontFrío/Bromyros | Precio visible / kit | Kit $48.90 all-in |
| Techo EPS | ISODEC ~$46 | Fabricantes + instaladores | Medio | Galpón espesor/luz |
| Techo PIR | ISODEC PIR $51 / ISOROOF | Bromyros / TDA / PSG | Upsell técnico | PIR Upgrade |
| Fachada | ISOWALL ~$98 est. | TDA / premium | Nicho | Solo leads calificados |
| Frigorífico | ISOFRIG en calc | Reyes / Baudin / Bromyros | Partial | Play secundario 60–90d |
| Hiansa-adj. | $46.73 | BECAM | Adyacente | No atacar marca BECAM; ofrecer alternativa PIR/EPS |

---

## 8. Canales — lectura competitiva

| Canal | BMC | Competidores típicos | Gap |
|-------|-----|----------------------|-----|
| Shopify precio m² | Sí (`bmcuruguay.com.uy`) | Raro en Tier1 | **Ventaja** |
| Meta → tienda | ATC activo (sesión Ads 2026-07) | Lead forms / tráfico | Mantener ATC; no Purchase-ROAS aún |
| Calculadora → WA | Diferencial fuerte | Forms lentos / teléfono | **Ventaja #1 B2B** |
| MercadoLibre | Listings + Q&A (higiene deuda) | Resellers precio | Convertir demanda existente |
| SEO “panel sandwich uruguay” | Gaps P1 en seeds | PSG on-page fuerte | Landings + contenido |

Meta `adsIntelligence.json` Big-4 lead-gen — **no usar como estructura actual** (`hecho confirmado` stale; campaña real post-mod = ATC/catalog).

---

## 9. Dónde BMC gana / pierde

**Gana (`inferencia` grounded en stack):**
1. Tiempo a cotización dimensional (Panelin).
2. Precio m² publicado + carrito Shopify.
3. Operación unificada (calc + ML hub + marketing intel).

**Pierde / riesgo:**
1. Brand trust vs Kingspan en obras grandes.
2. Precio suelto ML vs resellers.
3. Purchase tracking / cierre e‑commerce medible.
4. Kits vivienda “producto” (MontFrío ya los vende como SKU emocional).

---

## 10. Inputs no verificados esta corrida

- Precios listados Bromyros / Eco / Casa del Panel.  
- Win-loss CRM anonimizado.  
- ATC CPA actual Conversiones vs Catálogo ATC (Ads Manager).  
- Estado exacto cola ML preguntas hoy (pulse = junio).

---

*Siguiente: [`COMPETITIVE-SALES-STRATEGY-2026-07-18.md`](./COMPETITIVE-SALES-STRATEGY-2026-07-18.md) · [`battlecards/BATTLECARDS-TIER1.md`](./battlecards/BATTLECARDS-TIER1.md)*
