# Competitive Sales Strategy — BMC Uruguay

**Fecha:** 2026-07-18  
**Análisis:** [`COMPETITIVE-ANALYSIS-FULL-2026-07-18.md`](./COMPETITIVE-ANALYSIS-FULL-2026-07-18.md)  
**Battlecards:** [`battlecards/BATTLECARDS-TIER1.md`](./battlecards/BATTLECARDS-TIER1.md)

---

## What we do Monday (executive one-pager)

1. **North Star (90d):** cotizaciones WhatsApp **calificadas** generadas desde Calculadora / Panelin (con medidas + total) que avanzan a pedido — no vanity clicks.  
   **Secondary:** AddToCart Shopify (Meta). Purchase solo escala cuando Events Manager muestre Purchase estable.  
   *Estado:* North Star = `inferencia` operativa (B2B + Purchase pixel débil); confirmar con Matias si preferís $ cerrados Shopify.
2. **Postura:** *Fast quote + closed kit* — más rápido que el form MontFrío/TDA, más claro que BECAM multi-línea, más defendible que reseller ML.
3. **Lunes concreto:**
   - Publicar/empujar **Kit Todo en Uno EPS** en Shopify + 1 ad set Meta ATC con claim `$48.90/m² all-in` (USD ex-IVA / aclarar IVA en landing).
   - Script WA 5 líneas “respuesta vs Kingspan / vs precio ML” (battlecards).
   - Cola ML: títulos P1 + imágenes faltantes (top 10 vistas) — human gate.
   - SEO: 1 landing o blog “panel sandwich uruguay precio” → calc o colección.

---

## 1. KPIs (90 días)

| KPI | Tipo | Target sugerido | Notas |
|-----|------|-----------------|-------|
| WA quotes calificadas / sem | North Star | +30% vs baseline semana 0 | Definir baseline lunes |
| ATC Shopify / sem | Secondary | Mantener o ↑ con CPA ≤ histórico Conversiones | Meta post-mod |
| Purchase Shopify | Guardrail | No optimizar ads a Purchase hasta señal >0 estable | `hecho confirmado` gap previo |
| ML: unanswered questions | Hygiene | <5 con >24h | pulse jun: 47 — stale |
| Tiempo mediano cotización→primer WA | Process | <15 min horario laboral | Panelin |

---

## 2. Postura competitiva

| Dimensión | Elección |
|-----------|----------|
| Precio | Transparente en m² + kit all-in; no dumping vs Tier5 |
| Producto | EPS kit volumen; PIR upsell; galpón por autoportancia |
| Canal | Meta→Shopify (ATC); Calc→WA (B2B); ML (captura demanda) |
| Mensaje | Ahorro / obra rápida / kit cerrado — **evitar** “garantía Kingspan 50 años” si no somos el fabricante (`adsIntelligence` angle “Durabilidad premium” es riesgoso sin claim legal) |

---

## 3. Sales plays (5)

### Play A — Kit Todo en Uno EPS *(keep / scale)*
| Campo | Contenido |
|-------|-----------|
| ID | `kit-todo-en-uno-eps` |
| ICP | Dueño obra chica/media, ampliaciones, ML price-shoppers |
| Offer | ISOPANEL EPS + fijaciones + selladores + perfiles @ **$48.90/m² all-in** (USD; aclarar IVA) |
| Proof | Baseline EPS 50 $41.88 + kits Shopify; presión Tier5 |
| Channel | Meta ATC + Shopify collection + ML bundle listing |
| CTA | “Agregar kit” / “Cotizar m² exactos en 2 min” |
| Owner | Marketing + Ops Shopify |
| KPI | ATC kit; WA con “kit” en texto |
| Kill | Si margen kit < umbral costo×1.15 o devoluciones >X — pausar claim |
| Margin note | No bajar debajo de costo+markup; validar BOM kit vs Matriz antes de ads masivos |

### Play B — Cotización en 5 minutos *(NEW — diferencial vs forms)*
| Campo | Contenido |
|-------|-----------|
| ID | `cotizacion-5-min` |
| ICP | Arquitecto / constructor / galponero que hoy llena form MontFrío/TDA/BECAM |
| Offer | Cotización dimensional Panelin → PDF + WA con totales USD ex-IVA + IVA |
| Proof | Stack Panelin live; rivals usan forms lentos (`hecho confirmado` MontFrío/TDA) |
| Channel | Organic SEO P1 + Meta traffic **solo** a calc si UTM trackea lead-event; preferir Shopify→calc deep link |
| CTA | “Cotizá tu techo ahora” |
| Owner | Sales + Panelin |
| KPI | WA quotes calificadas |
| Kill | Si <10% de sesiones calc llegan a WA en 30d — arreglar UX CTA, no más ads |

### Play C — Galpón Sin Columnas *(keep)*
| Campo | Contenido |
|-------|-----------|
| ID | `galpon-sin-columnas` |
| ICP | Inversor / agro / depósito luz grande |
| Offer | Techo 150mm · messaging 9m luz / ahorro estructura |
| Proof | Autoportancia fichas (~7.5–7.6m @ espesores citados en strategies) — **no overclaim 9m sin ficha** |
| Channel | WA B2B + landing; Meta remarketing solo si ATC/view Shopify galpón |
| CTA | “¿Cuánto ahorrás en columnas?” |
| Owner | Sales técnico |
| KPI | Quotes ≥X m² techo |
| Kill | Si ingeniería contradice span claim — bajar claim a ficha real |

### Play D — PIR Upgrade *(keep)*
| Campo | Contenido |
|-------|-----------|
| ID | `pir-upgrade` |
| ICP | Cliente que cotizó EPS techo y duda térmica/fuego |
| Offer | Puente ~+$9/m² con descuento % acotado (strategies: 18% bridge) — **validar margen** |
| Proof | ISODEC PIR 50 $51.02 vs EPS ~$46; λ PIR |
| Channel | Upsell en Panelin + WA script; no Meta Purchase |
| CTA | “Mejorá a PIR por ~USD 9/m²” |
| Owner | Sales |
| KPI | Mix % PIR en quotes |
| Kill | Si descuento come markup — reducir % |

### Play E — ML Hygiene → Sales *(NEW — capture demand)*
| Campo | Contenido |
|-------|-----------|
| ID | `ml-hygiene-close` |
| ICP | Comprador ya en ML buscando isopanel |
| Offer | Listings con título P1, galería completa, respuesta <24h, Auditar IA → human save |
| Proof | `mlPulse` problemas imagen/Q&A; MLOMS Auditar IA shipped |
| Channel | MercadoLibre only |
| CTA | Respuesta con precio m² + link Shopify/WA |
| Owner | ML ops |
| KPI | Unanswered <5; conversion questions→sale proxy |
| Kill | Si penalizaciones suben — pausar reactivaciones |

**Propuesta `strategies.json`:** agregar plays B y E como entradas draft (no aplicado en esta corrida — pedir OK para patch).

---

## 4. Channel playbook

### Meta → Shopify
- Optimizar **ADD_TO_CART** únicamente hasta Purchase estable.
- Destinos solo `bmcuruguay.com.uy`.
- Ángulos copy: Ahorro / Obra rápida / Kit cerrado — **sin** claim Kingspan factory.
- Comparar Conversiones vs Catálogo ATC; pausar perdedor con umbrales del goal Meta.
- No ViewContent.

### Calculadora → WA
- CTA primario en funnel techo/pared.
- Lead-event `quote.send.whatsapp` ya instrumentado — usar para medir North Star.
- Script battlecard en primera respuesta humana/Panelin.

### MercadoLibre
- Priorizar higiene > ads ML Product Ads (aún no en stack).
- Respuestas: precio m² + diferencial kit vs suelto.

### Organic / SEO
- Atacar seeds P1 con `on_site_gap: true`:  
  `isopanel precio m2 uruguay`, `panel sandwich uruguay precio`, `donde comprar isopanel`, `cotizar panel sandwich uruguay`, `panel sandwich montevideo`, etc. (`keywordSeeds.json` 2026-07-04).
- Cada landing: 1 H1, precio o CTA calc, prueba social obra.

---

## 5. Roadmap 30 / 60 / 90

### 30 días
- [ ] Lock North Star + baseline semanal (Matias).
- [ ] Kit EPS live en Shopify con claim IVA-clear; 1 campaña/ad set Meta ATC.
- [ ] Battlecards en uso sales (WA snippets).
- [ ] Top 10 ML: imágenes + títulos formato `[Producto] [Núcleo] [Espesor] — [Aplicación]`.
- [ ] 1 landing SEO P1.
- [ ] Fix Purchase pixel/CAPI (Shopify) — bloquea ROAS e‑com.

### 60 días
- [ ] PIR upgrade script en 100% quotes EPS techo.
- [ ] Galpón landing + 5 casos obra.
- [ ] ML unanswered SLA <24h automatizado (alerta).
- [ ] Mystery shopping precio Tier1 (Bromyros/TDA/PSG) → actualizar matriz.
- [ ] Decisión pause/scale Catálogo ATC vs Conversiones.

### 90 días
- [ ] Evaluar kit vivienda BMC (respuesta a MontFrío) — solo si margen OK.
- [ ] Play frigorífico ISOFRIG si ≥N leads cámara.
- [ ] Revisar strategies.json + product-matrix con datos fresh.
- [ ] Retrospectiva KPI vs target; matar plays bajo kill criteria.

---

## 6. Riesgos y compliance

| Riesgo | Mitigación |
|--------|------------|
| Claim precio sin IVA | Siempre “USD ex-IVA + IVA 22%” en ads/web |
| Claim Kingspan / 50 años | No usar salvo autorización legal / distribución formal |
| Overclaim span 9m | Alinear a ficha técnica real |
| Guerra precio ML | Kit + servicio, no match ciego |
| Purchase ads ciegos | Prohibido hasta Events >0 |
| Editar Matriz/precios master | Fuera de scope — human gate |

---

## 7. Owners sugeridos

| Área | Persona / rol |
|------|----------------|
| North Star / OK plays | Matias |
| Meta / Shopify | Marketing |
| Panelin WA close | Sales / Panelin ops |
| ML listings | ML ops |
| Precios / margen kit | Calc / Matias |

---

*Fin estrategia. Ejecución live de ads/precios requiere OK explícito.*
