---
title: Revisión de Marketing Online BMC + Plan de Acción
company: BMC Uruguay (METALOG SAS)
date: 2026-07-13
author: Revisión externa (analista de marketing online)
status: Borrador para revisión de Matías
scope: Diagnóstico transversal de la situación de marketing + plan 30/60/90
grounded_in: server/lib/marketIntel/data/*.json (captura 2026-06-29 / SERP 2026-07-04), src/components/marketing-hub/, docs/team/*, repo adevolve-ai
---

# Revisión de Marketing Online BMC + Plan de Acción

> **Tesis en una frase.** BMC ya tiene el *tablero* de marketing (Market Intel + AdEvolve) y los
> *canales* (Meta/Google, MercadoLibre, WhatsApp, Shopify, web propia con calculadora), pero opera
> sobre **datos congelados y con fugas grandes en el embudo**. El mayor retorno de los próximos 90 días
> **no está en gastar más, sino en tapar las fugas y encender lo que ya está construido.**

---

## 0. Resumen ejecutivo (TL;DR)

**Situación en 6 puntos:**

1. **El motor comercial es la publicidad paga.** Como dice la propia spec interna: _"BMC's demand comes almost entirely from its own campaigns and referrals, so ad efficiency *is* the commercial engine"_ (`adevolve-ai/docs/COMMERCIAL-INTELLIGENCE-SPEC.md`). Todo lo demás amplifica o desperdicia ese motor.
2. **Ese motor está mayormente apagado.** Auditoría Meta Ads (2026-06-29): **72 campañas, solo 4 activas, 68 "zombies"** → diagnóstico literal *"Ghost Town — 94% inactivo"*. Se gastan **USD 11.000/mes** en 4 campañas sin gestión estructurada.
3. **Hay una fuga de demanda caliente en MercadoLibre:** **47 preguntas sin responder** (algunas +7 días), **12 listings sin imágenes**, 8 con ficha incompleta, títulos genéricos. Son leads con intención de compra que se enfrían solos.
4. **En SEO BMC ya rankea bien pero deja plata en la mesa:** posiciona **#1–#2 en varias keywords transaccionales**, pero **17 de 25 keywords prioritarias tienen `on_site_gap`** (no hay página propia que capture esa búsqueda) y **MercadoLibre le gana el clic** en las genéricas de mayor volumen.
5. **El activo diferencial está infrautilizado:** la **calculadora BMC** (cotización instantánea + PDF + WhatsApp) es algo que casi ningún competidor ofrece; hoy no está conectada a las búsquedas transaccionales donde ganaría (ej. *"cotizar panel sandwich uruguay"*, donde BMC aparece #5).
6. **Falta el circuito cerrado de medición:** hay analítica de *uso de producto*, pero **no hay analítica de spend/CAC/conversión de medios** conectada. No se puede optimizar lo que no se mide.

**La jugada (orden de prioridad):**

| # | Movimiento | Por qué ahora | Costo |
|---|-----------|---------------|-------|
| 1 | **Higiene de MercadoLibre** (responder Q&A, completar imágenes/fichas, títulos con keyword) | Recupera demanda caliente ya existente; 0 costo de medios | Bajo (operativo) |
| 2 | **Reestructurar Meta Ads** con AdEvolve: pausar zombies, consolidar en 1–2 Advantage+, activar tracking de conversión | El 94% de campañas inactivas ensucia el aprendizaje del algoritmo; sin tracking no hay ROAS | Bajo (reasigna, no suma) |
| 3 | **Landing pages transaccionales con calculadora embebida** para las 17 keywords con gap | Convierte tráfico orgánico que hoy se va a MLU/competidores | Medio |
| 4 | **Descongelar la inteligencia** (ETL diario + refresco de estudios) y **cerrar el loop de medición** | Todo lo anterior depende de decidir sobre datos vivos, no de junio | Medio |

---

## 1. Alcance, método y calidad del dato

Este análisis se apoya en la inteligencia que **ya vive dentro del propio producto BMC**, no en supuestos externos:

- **Mapa de competidores** — `server/lib/marketIntel/data/competitorMap.json` (31 competidores, 5 tiers).
- **Auditoría de anuncios** — `adsIntelligence.json` (Meta Ads, corte 2026-06-29).
- **Pulso MercadoLibre** — `mlPulse.json` (listings, Q&A, tendencias).
- **Precios base** — `bmcBaselinePrices.json` (9 SKUs, USD/m² sin IVA).
- **SEO** — `keywordSeeds.json` + `keywordMonitorState.json` (25 keywords, SERP capturado 2026-07-04).
- **Estrategias GTM activas** — `src/components/marketing-hub/data/strategies.json`.
- **Motor de anuncios** — repo `adevolve-ai` (playbook + MVP ingest Google/Meta).

> ⚠️ **Advertencia de frescura (importante).** Buena parte de la data de ads / competencia / ML es
> **JSON de hand-off "locked 2026-05-15" / capturado 2026-06-29** — *no es live*. El keyword monitor
> sí corrió más reciente (2026-07-04). **Antes de tomar decisiones de plata grandes, hay que
> refrescar la captura** (ver §5, Fase 0). Los números de este informe describen la *situación
> capturada*; las magnitudes exactas pueden haber cambiado.

**Nota buena:** el equipo ya adoptó el principio correcto de *provenance* (`DataPoint` con `source`
en la COMMERCIAL-INTELLIGENCE-SPEC). Este informe respeta esa disciplina: cada afirmación cita su archivo.

---

## 2. Diagnóstico por canal

### 2.1 Publicidad paga (Meta / Google) — el motor comercial

**Qué muestra la data (`adsIntelligence.json`, 2026-06-29):**

- **72 campañas totales · 4 activas · 68 zombies** → *"Ghost Town, 94% inactivas sin tráfico ni presupuesto"*.
- Las 4 activas ("Big 4") suman **USD 11.000/mes** (todos los montos en USD, según `*_usd` en `adsIntelligence.json`):
  - Lead Gen Pilar 1 — Rendimiento: **USD 4.500/mes** (`lead_generation`, rendimiento alto)
  - Lead Gen Pilar 2 — Instalación: **USD 3.000/mes** (`lead_generation`, rendimiento alto)
  - Tráfico Web: **USD 2.000/mes** (`traffic`, rendimiento medio)
  - Remarketing: **USD 1.500/mes** (`conversions`, rendimiento medio)
- **3 ángulos de copy** ya definidos: *Ahorro garantizado* ("ahorrá hasta 40% en climatización"), *Construcción rápida*, *Durabilidad premium* ("garantía Kingspan 50 años").

**Lectura de analista:**

- 68 campañas zombie no son inocuas: **fragmentan el histórico de la cuenta y confunden la fase de
  aprendizaje** del algoritmo de Meta. Higiene primero.
- **Cuidado con juzgar el tráfico por conversión.** El motor AdEvolve (`analyze.py`) es
  **objective-aware**: puntúa cada campaña contra pares del *mismo objetivo* (traffic/awareness →
  CPC/CTR; sales/leads → CPA/ROAS) y **nunca pausa** una campaña de tope de embudo por tener 0
  conversiones — reasigna presupuesto *budget-neutral* (Σ=0, ±20 %/día) hacia el tráfico más
  eficiente. Por eso la conclusión sobre "Tráfico Web" no es *matarla*, sino: (a) dejar que su
  presupuesto se reasigne al tráfico de mejor CPC/CTR, y (b) instalar tracking de conversión para
  recién ahí saber si ese tráfico convierte.
- **Falta lo esencial: medición de conversión.** No hay CAC/ROAS por campaña conectado (ver §2.6 y §6).
  Sin eso, "rendimiento alto/medio" es una etiqueta cualitativa, no un dato accionable.
- **Existe la herramienta para arreglarlo y no se está usando:** `adevolve-ai` (ingest Google+Meta →
  análisis → recomendación → aprobación humana → aplicar). Pero `data/exports/` está **vacío**,
  `campaign-baseline-template.csv` **sin llenar** y `change-log.md` **en blanco** → *el motor de
  optimización está construido pero nunca se alimentó*.

**Recomendación de la propia auditoría:** consolidar las 4 activas en **1–2 campañas Advantage+ (ASC)**
y pausar las 68 zombies. La auditoría sugiere una banda ASC de **USD 500–1.000** — ⚠️ **hay que
confirmar si es diaria o mensual**: a $500–1.000/mes sería un recorte brutal frente a los $11k
actuales y mataría volumen; lo más probable es que sea un *presupuesto de arranque/test*. **Decisión
de dueño** (ver §5, decisión D1).

### 2.2 SEO / búsqueda orgánica (Google)

**Qué muestra la data (`keywordMonitorState.json`, SERP 2026-07-04, dominio `bmcuruguay.com.uy`):**

| Keyword (intención transaccional) | Posición BMC | Gana el SERP | `on_site_gap` |
|---|---|---|---|
| donde comprar isopanel en uruguay | **#1** | MercadoLibre | sí |
| isopaneles uruguay | **#1** | Isopanel Uruguay | no |
| isodec pir precio uruguay | **#1** | Kingspan | no |
| panel techo pir uruguay | **#1** | Kingspan | sí |
| isowall pir fachada uruguay | **#1** | Kingspan | no |
| hiansa panel precio uruguay | **#1** | MercadoLibre | no |
| isopanel precio uruguay | **#2** | MercadoLibre | no |
| isopanel precio m2 uruguay | **#2** | MercadoLibre | **sí** |
| panel sandwich montevideo | **#2** | Panel Sandwich Group | sí |
| panel sandwich uruguay precio | **#3** | Panel Sandwich Group | sí |
| isoroof precio uruguay | **#3** | MercadoLibre | sí |
| comprar panel sandwich uruguay | **#4** | Panel Sandwich Group | no |
| cotizar panel sandwich uruguay | **#5** | Panel Sandwich Group | **sí** |

**Lectura de analista:**

- **BMC tiene autoridad de marca fuerte** (gana los términos con "isopanel/isodec/isowall/hiansa").
  Eso es un activo grande y barato de defender.
- **Pierde donde el usuario NO busca por marca** ("panel sandwich uruguay precio/comprar/cotizar") →
  ahí gana **Panel Sandwich Group** y **MercadoLibre**. Son términos genéricos de alta intención =
  clientes que aún no eligieron marca. **Es exactamente el tráfico que hay que capturar.**
- **17 de 25 keywords tienen `on_site_gap = true`**: no existe una página propia optimizada para esa
  búsqueda. BMC rankea "de rebote" con páginas genéricas; con landings dedicadas subiría posición y,
  sobre todo, **convertiría** (ver §2.4).
- **MercadoLibre aparece en casi todos los SERP** → el marketplace no es solo un canal de venta, es
  **un competidor de SEO** que se lleva el clic. Doble razón para ordenar ML (§2.3) *y* construir
  páginas propias fuertes.

### 2.3 MercadoLibre (marketplace)

**Qué muestra la data (`mlPulse.json`; PROJECT-STATE):**

- **143 listings activos** (PROJECT-STATE menciona ~46–48 realmente activos + 197 pausados, con
  penalizaciones de moderación → **reconciliar el número real es tarea Fase 0**).
- **47 preguntas sin responder** (varias +7 días) · tasa de respuesta 87% · **12 listings sin
  imágenes** · 8 con ficha técnica incompleta · varios títulos genéricos.
- Tendencias: búsqueda de "isopanel" **estable**; **estacionalidad alta de techos en invierno
  (jun–ago)** ← *estamos justo en la ventana*; **presión de precio alta de resellers Tier-5 en EPS
  50mm pared**.

**Lectura de analista:**

- **Las 47 preguntas sin responder son la fuga más barata de tapar y la de mayor intención.** Quien
  pregunta en ML está a un paso de comprar. Cada pregunta vieja es un lead que se enfría o se va al
  reseller. **Ya existe `mlAutoAnswer.js` (auto-respuesta AI) — hay que activarlo/afinar el SLA.**
- **12 listings sin imágenes en plena temporada alta de techos** = conversión perdida justo cuando
  hay demanda. Prioridad inmediata.
- **Presión de resellers en EPS 50mm**: no se responde bajando precio a lo tonto (destruye margen),
  se responde con **bundle** — que BMC ya diseñó: **"Kit Todo en Uno EPS" a $48.90/m²** (panel +
  fijaciones + selladores + perfilería) para que el reseller "barato" quede caro al sumar lo que no
  incluye (`strategies.json`). **Falta contarlo en cada listing y landing.**

### 2.4 Sitio propio + Calculadora (conversión / CRO)

**El activo más diferencial y peor aprovechado.**

- BMC tiene una **calculadora de cotización instantánea** (techo/pared → BOM → precio → PDF →
  export WhatsApp). La mayoría de los competidores obligan a "solicitá tu cotización y esperá".
- Hoy vive como app (`calculadora-bmc.vercel.app`) pero **no está enganchada a las keywords
  transaccionales** donde sería imbatible.

**Lectura de analista — la oportunidad CRO más clara:**

> Convertir *"cotizar panel sandwich uruguay"* (BMC hoy #5) y *"isopanel precio m2 uruguay"* (#2, con
> gap) en **landing pages con la calculadora embebida arriba de todo**. En vez de mandar al usuario a
> un formulario "te contactamos", le das **el precio en 30 segundos + PDF + botón WhatsApp**. Eso:
> (a) sube el ranking (contenido dedicado + señales de engagement), (b) **convierte muchísimo mejor**
> que una página institucional, (c) alimenta el CRM con un lead ya cotizado.

Esto conecta SEO (§2.2) + CRO + generación de lead en un solo movimiento, usando algo **ya construido**.

### 2.5 Competencia y posicionamiento

**Qué muestra la data (`competitorMap.json`, 31 competidores, `priceGap.js`):**

- **5 tiers.** Tier-1 crítico (7): **Kingspan Bromyros, Kingspan MontFrío, BECAM SA, TDA Uruguay,
  Eco Panels Uruguay, Panel Sandwich Group, Casa del Panel**.
- **El ecosistema Kingspan (Bromyros + MontFrío) domina EPS/PIR** — es el líder de referencia
  premium (baked-in en el system prompt del Market Intel AI).
- **Resellers MLU (Tier-5)** compiten por precio en EPS 50mm pared.
- Multiplicadores de referencia por tier (`priceGap.js`): T1 = 1.3× (premium), T2 = 1.05×, T3 = 0.95×,
  T4 = 0.85×, **T5 = 0.7× (por debajo de BMC)**.

**Lectura de analista — mapa de posicionamiento:**

- BMC está **en la banda media-alta**: por debajo del premium Kingspan, por encima de los resellers.
  Es una buena posición *si se comunica el "por qué"* (servicio, cotización instantánea, kit completo,
  respaldo técnico). Si no se comunica, el cliente solo ve precio y BMC pelea contra el Tier-5 en su
  peor cancha.
- **Panel Sandwich Group es el rival de marketing digital más peligroso** (gana los genéricos de SEO
  y aparece en casi todos los SERP de "panel sandwich"). Kingspan es el rival de *producto/marca*;
  Panel Sandwich Group es el rival de *demanda digital*. **Estrategias distintas para cada uno.**

### 2.6 Precio y márgenes

**Qué muestra la data (`bmcBaselinePrices.json`, USD/m² sin IVA):**

| SKU | Producto | Núcleo | Espesor | Precio público |
|---|---|---|---|---|
| ISOPANEL_EPS_50 | ISOPANEL EPS Pared | EPS | 50mm | **41.88** |
| ISOPANEL_EPS_100 | ISOPANEL EPS Pared | EPS | 100mm | cotización (N/A) |
| ISODEC_EPS_100 | ISODEC EPS Techo | EPS | 100mm | 46.07 |
| ISODEC_PIR_50 | ISODEC PIR Techo | PIR | 50mm | 51.02 |
| ISOROOF_3G_30 | ISOROOF 3G | PIR | 30mm | 48.74 |
| ISOROOF_PLUS_3G_80 | ISOROOF PLUS 3G | PIR | 80mm | 71.76 |
| ISOROOF_FOIL_3G_50 | ISOROOF FOIL 3G | PIR | 50mm | 39.54 |
| ISOWALL_PIR_50 | ISOWALL PIR (fachada) | PIR | 50mm | 98.50 (est.) |
| HIANSA_5G_30 | Hiansa Trapezoidal 5G | PUR | 30mm | 46.73 |

- **Modelo de doble lista:** `venta` (BMC-directo, default para cotizar) vs `web` (Shopify público).
  IVA 22% se aplica una sola vez al total (`calcTotalesSinIVA()`).
- El `product-matrix` compara cada SKU contra una **referencia de mercado *estimada*** (ponderada por
  tier) — **no es una cotización real de competidor**. Útil para dirección, no para fijar precio.

**Lectura de analista:**

- **No hay un problema de precio de lista; hay un problema de *comunicación de valor*.** Con Tier-5
  a 0.7× y Kingspan a 1.3×, BMC no debería competir por ser el más barato. Las **3 estrategias GTM ya
  definidas** son la respuesta correcta y hay que **operacionalizarlas en los canales**:
  1. **"Kit Todo en Uno EPS"** ($48.90/m² all-in) → contra resellers.
  2. **"Galpón Sin Columnas"** (150mm, luz 9m autoportante) → ángulo construcción rápida / obra.
  3. **"PIR Upgrade"** (EPS→PIR, +$9/m², descuento puente 18%, λ=0.022 térmico/fuego) → upsell de margen.
- Recomendación: la brecha `product-matrix` debe leerse como **señal de dónde subir margen** (SKUs
  "por_debajo") **y dónde defender volumen** (SKUs "por_encima"), no como orden de bajar precios.

---

## 3. El embudo BMC y sus fugas

```
                  BMC — embudo de demanda (estado capturado)
  ┌──────────────┬───────────────────────┬──────────────────────────┬─────────────────┐
  │ Etapa        │ Canal que la alimenta │ Fuga detectada           │ Acción (§5)     │
  ├──────────────┼───────────────────────┼──────────────────────────┼─────────────────┤
  │ Awareness    │ Meta Ads, SEO marca   │ 68 campañas zombie        │ Reestructurar   │
  │ (descubrir)  │                       │ ensucian el algoritmo     │ ads (AdEvolve)  │
  ├──────────────┼───────────────────────┼──────────────────────────┼─────────────────┤
  │ Consideración│ SEO genérico, ML,     │ 17 kw sin landing; MLU    │ Landings +      │
  │              │ competidores          │ gana el clic genérico     │ calculadora     │
  ├──────────────┼───────────────────────┼──────────────────────────┼─────────────────┤
  │ Intención    │ ML Q&A, calculadora,  │ 47 preguntas sin          │ SLA Q&A +       │
  │ (cotizar)    │ WhatsApp              │ responder; calc no        │ calc embebida   │
  │              │                       │ conectada a SEO           │                 │
  ├──────────────┼───────────────────────┼──────────────────────────┼─────────────────┤
  │ Conversión   │ CRM_Operativo,        │ sin CAC/ROAS medido →     │ Cerrar loop de  │
  │ (cierre)     │ pipeline deals        │ no se sabe qué canal      │ medición (§6)   │
  │              │ (lead→closed_won)     │ cierra                    │                 │
  ├──────────────┼───────────────────────┼──────────────────────────┼─────────────────┤
  │ Retención /  │ WA follow-ups, email  │ subutilizado; sin         │ Reactivación +  │
  │ referido     │                       │ programa de referidos     │ NPS (fase 90)   │
  └──────────────┴───────────────────────┴──────────────────────────┴─────────────────┘
```

**Lo bueno:** la infraestructura del embudo **ya existe** — canales (`/hub/canales`: ML Manager, WA
Inbox, Omni), CRM (`CRM_Operativo` con gate humano de aprobación), y pipeline de deals
(`stageMachine.js`: lead → qualified → proposal → negotiation → closed_won/lost). **No hay que
construir el embudo; hay que tapar las fugas y medirlo.**

---

## 4. FODA

**Fortalezas**
- Autoridad de marca en SEO (#1 en términos de marca).
- **Calculadora de cotización instantánea** (diferencial real vs. competencia).
- Tablero de inteligencia de mercado ya construido (competidores, precios, SEO, alertas, brief AI).
- Motor de optimización de ads (AdEvolve) listo para usar.
- Canales maduros (ML, WhatsApp Cockpit, Shopify, Omni) + CRM + pipeline.
- 3 estrategias GTM bien pensadas (Kit EPS, Galpón, PIR Upgrade).

**Debilidades**
- 94% de campañas Meta inactivas; sin medición de conversión/CAC.
- 47 preguntas ML sin responder; 12 listings sin imagen.
- 17 keywords transaccionales sin landing propia.
- Calculadora desconectada del SEO transaccional.
- Data de inteligencia **congelada** (junio) + dos ETLs de precio desconectados.

**Oportunidades**
- Temporada alta de techos (invierno jun–ago) — *ahora*.
- Capturar genéricos "panel sandwich" que hoy se lleva Panel Sandwich Group / MLU.
- Bundle "Kit EPS" para neutralizar a los resellers sin romper margen.
- Upsell PIR (margen) sobre demanda EPS existente.

**Amenazas**
- Kingspan (Bromyros+MontFrío) domina el premium EPS/PIR.
- Panel Sandwich Group gana la demanda digital genérica.
- Resellers Tier-5 erosionan precio en EPS 50mm.
- MercadoLibre se lleva el clic orgánico (y cobra comisión sobre la venta).

---

## 5. Plan de acción priorizado (30 / 60 / 90 días)

Formato: **Acción · Por qué · Esfuerzo · Impacto · Owner · KPI**. Impacto/Esfuerzo: A=alto, M=medio, B=bajo.

### Fase 0 — Semana 1 (higiene + descongelar). *Casi todo esto es gratis en medios.*

| Acción | Por qué | Esf. | Imp. | Owner | KPI |
|---|---|---|---|---|---|
| Responder las **47 preguntas ML** y fijar **SLA < 24h** (activar/afinar `mlAutoAnswer.js`) | Demanda caliente que se enfría | B | **A** | Canales/ML | Q&A pendientes → 0; tasa respuesta → 98% |
| Completar **imágenes (12) + fichas (8)** de listings ML | Conversión perdida en temporada alta | B | **A** | Canales/ML | 0 listings sin imagen |
| **Reconciliar el nº real de listings ML** (143 vs 46–48 activos + 197 pausados + penalizaciones) | Decidir sobre dato real | B | M | Canales/ML | Inventario ML auditado |
| **Refrescar la captura de inteligencia**: correr ETL de precios (`POST /api/marketing/etl/run`) + refresh keywords + actualizar `adsIntelligence.json`/`mlPulse.json` con datos de hoy | Todo el plan decide sobre data viva, no de junio | M | **A** | Dev/Marketing | Data < 7 días |
| **Exportar 30 días de Meta + Google** a `adevolve-ai/data/exports/` y llenar `campaign-baseline-template.csv` | Encender el motor de optimización | B | **A** | Marketing | Baseline cargado |

### Fase 1 — 30 días (arreglar el motor de ads + medición)

| Acción | Por qué | Esf. | Imp. | Owner | KPI |
|---|---|---|---|---|---|
| **Pausar las 68 campañas zombie**; auditar cada una de las 4 activas con la grilla Winner/Neutral/Bleeder del playbook AdEvolve | Limpiar aprendizaje del algoritmo | B | **A** | Marketing | 0 zombies activas |
| **Instalar/verificar tracking de conversión** (Meta Pixel + CAPI, Google conv., evento "cotización generada" desde la calculadora) | Sin esto no hay ROAS ni optimización real | M | **A** | Dev | Eventos de conversión disparando |
| **Consolidar a 1–2 campañas Advantage+ (ASC)** (decisión D1 de presupuesto abajo) usando los 3 ángulos de copy existentes | Recomendación de la auditoría; simplifica gestión | M | **A** | Marketing | CPA por lead medido |
| **Tratar el tráfico como objective-aware** (CPC/CTR, reasignación budget-neutral vía AdEvolve; no pausar top-of-funnel por 0 conversiones) | Alinear con el motor real de ads (`analyze.py`), no con una grilla CPA genérica | B | M | Marketing | Presupuesto de tráfico movido al mejor CPC/CTR |
| Cerrar loop: **dashboard de spend/CAC/ROAS por canal** (AdEvolve ingest + conectar Meta/Supermetrics) | Medir para optimizar | M | **A** | Dev | Tablero CAC/ROAS live |

### Fase 2 — 60 días (capturar demanda orgánica + CRO)

| Acción | Por qué | Esf. | Imp. | Owner | KPI |
|---|---|---|---|---|---|
| **Landing pages transaccionales con calculadora embebida** para las top keywords con gap (`cotizar panel sandwich`, `isopanel precio m2`, `panel sandwich montevideo`, `isoroof precio`, `panel techo pir`) | Capturar el genérico que hoy pierde vs PSG/MLU; convertir con la calc | **A** | **A** | Dev/Marketing | +posición SEO; leads cotizados/landing |
| **Optimizar títulos ML** con formato `[Producto] [Núcleo] [Espesor] — [Aplicación]` | Volumen de búsqueda interno ML | B | M | Canales/ML | CTR de listing |
| **Operacionalizar "Kit Todo en Uno EPS"** en listings + landings + copy de ads | Neutralizar resellers Tier-5 sin romper margen | M | **A** | Marketing | % ventas con kit vs suelto |
| **Remarketing sobre cotizadores** (los que usaron la calc y no cerraron) | Lead ya calificado por sí mismo | M | **A** | Marketing | Conversión de remarketing |

### Fase 3 — 90 días (margen + retención + escalar sobre datos)

| Acción | Por qué | Esf. | Imp. | Owner | KPI |
|---|---|---|---|---|---|
| **Campaña "PIR Upgrade"** (upsell EPS→PIR, +$9/m², descuento puente 18%) sobre base de cotizadores EPS | Margen sobre demanda existente | M | **A** | Marketing | % upgrades PIR; margen medio |
| **"Galpón Sin Columnas"** como campaña vertical (obra/arquitectos, keyword `galpón panel sandwich uruguay`) | Segmento de ticket alto poco explotado | M | M | Marketing | Leads galpón; ticket medio |
| **Programa de referidos + reactivación** (WA follow-ups, email dormido/Chatwoot) | Retención subutilizada; CAC más barato es el cliente actual | M | M | Canales | Leads referidos; reactivados |
| **Escalar el presupuesto SOLO en lo que ya probó CAC/ROAS** (decidido con datos vivos, no antes) | Escalar sobre fuga = quemar plata | — | **A** | Dirección | ROAS ≥ objetivo antes de +budget |

### Decisiones de dueño (bloquean ejecución — requieren tu definición)

- **D1 — Presupuesto de medios.** ¿Confirmamos que la banda ASC "$500–1.000" de la auditoría es
  *diaria* (mantiene ~$11k/mes) o *mensual* (recorte agresivo)? Recomendación de analista:
  **mantener ~$11k/mes pero reasignado y medido**, no recortar a ciegas; escalar/recortar recién
  cuando el CAC por canal sea visible (Fase 1). *(ver §6)*
- **D2 — Prioridad de canal.** ¿El foco de los próximos 60 días es **defender/crecer MercadoLibre**
  (donde ya hay demanda pero se paga comisión) o **migrar demanda a canal propio** (landings +
  calculadora, mejor margen)? Recomendación: **ambos**, pero higiene ML es Fase 0 (barato/urgente) y
  canal propio es la apuesta de margen a 60 días.

---

## 6. Reasignación de presupuesto (marco, no orden final)

Presupuesto actual de medios capturado: **~USD 11.000/mes**. Marco recomendado **una vez que haya
tracking de conversión** (no antes — reasignar a ciegas es igual de malo que gastar a ciegas):

| Bloque | Hoy (aprox.) | Propuesta (post-tracking) | Racional |
|---|---|---|---|
| Lead Gen (ASC consolidada) | USD 7.500 (Pilar 1+2) | **USD 6.000–7.500** | Núcleo del motor; mantener hasta ver CAC, luego escalar el ganador |
| Tráfico Web | USD 2.000 | **reasignar por CPC/CTR** (budget-neutral) | Objective-aware: no cortar por 0 conversiones; el motor mueve el presupuesto al tráfico más eficiente |
| Remarketing | USD 1.500 | **USD 1.500–2.500** | Ampliar a "cotizadores" (lead auto-calificado) |
| SEO/CRO (landings + contenido) | USD 0 en medios | **reasignar esfuerzo dev** | Canal de margen propio; capex, no opex de medios |
| Búsqueda Google (marca + genéricos) | ¿? | **test USD 500–1.000** | Defender marca y disputar genéricos a PSG/MLU |

> ⚠️ El número exacto lo decide el **CAC por canal**, que hoy no se mide. **Por eso el tracking
> (Fase 1) es precondición de cualquier movida de plata grande.** El objetivo de AdEvolve/SDD es
> **−20% de CPA en 6 meses**: ese es el norte cuantitativo.

---

## 7. KPIs y tablero de seguimiento

**North Star:** **Costo por lead cotizado** (lead que pasó por calculadora/Q&A) y **CAC → cierre**
(costo por `closed_won` del pipeline).

| Dimensión | KPI | Fuente | Meta 90 días |
|---|---|---|---|
| Ads | CPA / ROAS por campaña | AdEvolve (Meta+Google) | CPA −20% (objetivo SDD) |
| Ads | Campañas activas / zombies | `adsIntelligence` (live) | 0 zombies |
| SEO | Posición media kw P1 | keyword monitor | Top-3 en genéricos clave |
| SEO/CRO | Leads cotizados / landing | calculadora + CRM | Serie creciente |
| ML | Q&A pendientes / tasa respuesta | `mlPulse` (live) | 0 pendientes / 98% |
| ML | Listings completos (img+ficha) | auditoría ML | 100% |
| Embudo | Conversión lead→closed_won | pipeline `stageMachine` | +X% vs baseline |
| Margen | % ventas con Kit EPS / upgrades PIR | CRM/cotizaciones | Serie creciente |

**Cadencia:** revisión semanal (mismo día) de ads (regla AdEvolve) + revisión mensual de embudo/margen.

---

## 8. Riesgos y supuestos

- **Supuesto crítico:** los números de ads/ML/competencia son captura de jun-2026 → **validar con
  data viva en Fase 0** antes de mover plata.
- **Riesgo:** pausar 68 campañas puede, en teoría, tocar alguna con conversión oculta → verificar
  cada una con la grilla del playbook antes de pausar (no pausar a ciegas).
- **Riesgo:** consolidar a ASC reinicia el aprendizaje del algoritmo (7–14 días de ruido) → hacerlo
  con tracking ya funcionando y esperar la ventana de aprendizaje.
- **Deuda técnica que afecta marketing:** **dos ETLs de precio desconectados** (Postgres
  `bmc_market_intel` vs Supabase `bmc_price_monitor`) → unificar para no decidir sobre datos que se
  contradicen.
- **Dependencia:** el tracking de conversión requiere trabajo de dev (Pixel/CAPI + evento
  "cotización generada"). Es la pieza que desbloquea todo lo demás.

---

## 9. Anexos

### 9.1 Tiers de competidores (`competitorMap.json`)

- **T1 Crítico (7):** Kingspan Bromyros, Kingspan MontFrío, BECAM SA, TDA Uruguay, Eco Panels Uruguay, Panel Sandwich Group, Casa del Panel.
- **T2 Secundario (9):** ARMCO, Isopanel Pro, Isopanel Uruguay, MyF Isopaneles, Construmec, Galpones Duque, Isopanel Flores, Eco Panels Ruta 8, FOKO.
- **T3 Indirecto (6):** Group Soluciones, Reyes Refrigeración, Baudin, Vitrilan, Marbex, Barraca Carmela.
- **T4 Watchlist (6):** PreHouse, Isocenter, AG Isopaneles, Greenhouse, Pani, Todo Casas UY.
- **T5 Resellers MLU (3):** EL INSUPERABLE, CELER UY, otros MLU sin marca.

### 9.2 Estrategias GTM activas (`strategies.json`)

1. **Kit Todo en Uno EPS** — $48.90/m² all-in (panel + fijaciones + selladores + perfilería). Contra-reseller.
2. **Galpón Sin Columnas** — 150mm, luz 9m autoportante. Ángulo construcción rápida.
3. **PIR Upgrade** — EPS→PIR (+$9/m², descuento puente 18%, λ=0.022). Upsell de margen.

### 9.3 Dónde vive cada cosa en el código (para ejecutar)

| Necesito… | Está en… |
|---|---|
| API de marketing / intel | `server/routes/marketing.js` (`/api/marketing/*`) |
| Motor de inteligencia + data | `server/lib/marketIntel/` (+ `data/*.json`) |
| Hub UI Market Intel | `src/components/MarketingHubModule.jsx` + `marketing-hub/` |
| Canales (ML/WA/Omni/Pipeline) | `src/components/hub/canales/CanalesModule.jsx` |
| Auto-respuesta ML | `server/lib/mlAutoAnswer.js` |
| Pipeline de deals (embudo) | `server/lib/omni/deals/stageMachine.js` |
| CRM operativo | `server/lib/crmOperativoLayout.js` |
| Motor de ads | repo `adevolve-ai/` (playbook + ingest Google/Meta) |

---

*Documento de revisión. Próximo paso sugerido: definir D1 y D2 (§5), y arrancar Fase 0 esta semana
aprovechando la temporada alta de techos.*
