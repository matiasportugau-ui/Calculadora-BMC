# Conocimiento comparative — team / IAlfred review

_Generated 2026-10-11 22:17 UTC_

## Purpose
Compare **legacy Conocimiento** vs **BQ-derived rules** (Enviados × Dropbox, n=2054 totals, ~36% archive) so the team can select what to keep, tune, or retire.

## Snapshot
- Live tab `Conocimiento`: **28** rows
- Legacy (pre-2026-10-11): **17**
- Added this session (BQ/HITL): **9**
- Other same-day rows (not this pack): **2**
- BigQuery: `chatbot-bmc-live.bmc_quote_knowledge.fact_quote_io` (**2054** rows with total)
- Local pack: `~/.ialfred/ops/quote-knowledge-2026-10-11/`
- Append result: `Conocimiento!A10:L18` (plus any later rows)

## Evidence baselines (from BQ sample)

| Metric | Value |
|--------|------:|
| Median quote USD | ~2,384 |
| Sum sample | ~$6.94M |
| USD/m² median | ~56 |
| WA / ML / LL n | 880 / 547 / 213 |
| WA vs ML median USD | ~2.9k vs ~1.9k |

## A. Legacy rules (keep — already proven by hitCount)

| category | conf | hits | trigger (short) |
|----------|-----:|-----:|------------------|
| escenario | 0.96 | 7191 | consulta especifica paneles con largos puntuales sin mencionar 'pared' |
| escenario | 0.95 | 3552 | cliente pide varias propuestas (propuesta 1 / propuesta 2) con cantida |
| espesor | 0.93 | 12201 | cliente pide 2 espesores distintos de la misma familia (ej: 'Isodec 10 |
| terminacion | 0.92 | 4938 | consulta menciona accesorios de remate/goteros con medidas lineales (e |
| familia | 0.95 | 9121 | consulta menciona 'Isoroof' o 'ISOROOF' con dimensiones 'ancho x largo |
| general | 0.95 | 10332 | cualquier consulta de paneles donde el cliente ya definió cantidades y |
| terminacion | 0.88 | 9965 | consulta ISOPANEL o ISODEC sin color explícito |
| escenario | 0.85 | 3379 | consulta ISOPANEL o ISODEC sin estructura explícita y el contexto no l |
| general | 0.99 | 684 | Admin planilla Editar Cotización AO openDrive openBmc calculadora edit |
| general | 0.99 | 1774 | Admin Link Presupuesto M PDF factura cliente 🧾 presupuesto link |
| general | 0.98 | 21 | iconos Admin emoji tamaño fuente planilla estilo 🧮 🧾 |
| general | 0.99 | 409 | Google Drive upload service account quota invalid_grant refresh token  |
| general | 0.98 | 1650 | openDrive openBmc cargar cotización wizard paso a paso bloqueado medid |
| general | 0.96 | 11304 | instalación montaje procedimiento cómo se coloca cómo se instala isopa |
| general | 0.98 | 13244 | montfrio kingspan isodec isopanel isoroof video procedimiento ficha an |
| escenario | 0.95 | 13277 | completo con todo kit instalación montaje colocación jornal isopanel t |
| general | 0.94 | 566 | sanitaria eléctrica yeso revestimiento aplacado cielorraso caños table |

## B. New BQ/HITL rules (appended active — review for keep/tune)

| # | category | conf | decision | trigger (short) | overlaps legacy? |
|---|----------|-----:|----------|-----------------|------------------|
| 2 | origen | — | **KEEP** | WA/LL quote-ready | Complements legacy; no conflict |
| 3 | escenario | — | **KEEP/TUNE** | EM + adjuntos/planos | Extends missing_geometry; needs attachment pipeline |
| 4 | familia | — | **KEEP** | IsoPanel techo→IsoDec | Complements IsoRoof-as-techo rule |
| 5 | familia | — | **KEEP** | IsoDec pared→IsoPanel | Inverse of #4; confirm wording |
| 6 | familia | — | **TUNE** | WA sin familia default | May over-default; watch false techos |
| 7 | pricing | — | **KEEP** | USD/m² sanity band | NEW category pricing — wire into calc QA |
| 8 | espesor | — | **KEEP** | Espesor ladder techo | Aligns with dual-espesor hitCount=449 |
| 9 | origen | — | **KEEP** | FB medidas → directo | Small n=86; low risk |
| 10 | comercial | — | **TUNE** | Priorizar WA/LL recontacto | Ops not calc; wire commercial-followup skill |

### Full text of new rules

#### `origen` · conf=0.86 · `dcda2ab1…`

**Trigger:** origen=WA o LL y la consulta trae familia + espesor + medidas (largos/m2/cantidad)

**Rule:** Cotizar sin ronda extra de aclaración salvo datos críticos faltantes (color/entrega). WA/LL llegan quote-ready en ~80%+ con familia/espesor; mediana WA ~USD 2.9k.

#### `escenario` · conf=0.91 · `c98d7844…`

**Trigger:** origen=EM (mail) o la consulta dice 'ver planos'/'plano WPP'/'adjunto' o hay archivos adjuntos (PDF, imagen, plano, DWG) sin medidas numéricas usables en el texto

**Rule:** Analizar adjuntos antes de cotizar: leer PDF/imagen/plano si está disponible; extraer largos, anchos, m2, cantidad de paneles, familia y espesor cuando se vean. Si el adjunto no alcanza para geometría confiable, NO inventar medidas: marcar datos_faltantes=medidas_desde_plano_o_adjunto y pedir largo útil / m2 / cantidad. EM tiene alta tasa de 'ver planos' (~17%).

#### `familia` · conf=0.84 · `06829a90…`

**Trigger:** consulta menciona isopanel (o 'panel sandwich') para TECHO / cubierta / techos sin aclarar pared

**Rule:** Preferir familia IsoDec (o IsoRoof si el cliente pide 3G/FOIL/PLUS/Colonial) en lugar de IsoPanel. Observado: humanos reescriben IsoPanel→IsoDec con frecuencia; IsoPanel→IsoRoof también aparece en techos.

#### `familia` · conf=0.82 · `2222920f…`

**Trigger:** consulta menciona isodec pero el uso es claramente PARED / muro / fachada / divisiones interiores

**Rule:** Evaluar IsoPanel (pared) en lugar de IsoDec. Observado rewrite IsoDec→IsoPanel (n≈89). Confirmar con el cliente si hay duda techo vs pared.

#### `familia` · conf=0.78 · `2ab44d81…`

**Trigger:** consulta sin familia de producto y origen=WA

**Rule:** Default operativo histórico: IsoDec EPS (techo) si el contexto es cubierta/techo; si es pared, IsoPanel. En archivo Dropbox, cuando la consulta no trae familia, WA suele cerrar en IsoDec.

#### `pricing` · conf=0.85 · `8d817931…`

**Trigger:** se generó un presupuesto con total USD y área m2 conocida (quote_total_usd / quote_area_m2)

**Rule:** Sanity-check USD/m2: banda típica ~USD 46–62/m2 según familia (IsoPanel~46, IsoDec EPS~57, IsoRoof~60, IsoDec~62). Si USD/m2 < 40 o > 100, marcar para revisión humana antes de enviar. Mediana global ~USD 56/m2; ticket mediano ~USD 2.4k.

#### `espesor` · conf=0.8 · `9168d958…`

**Trigger:** cliente pide un solo espesor pero el caso de uso es techo IsoRoof/IsoDec y el espesor pedido es ambiguo o muy bajo (p.ej. 30mm) sin confirmar aislamiento

**Rule:** Ofrecer ladder de opciones en paralelo (30/50/80 o 100/150) sin pedir que elija antes — alineado a regla multi-espesor existente. Humanos frecuentemente suben 30→50/80 y 100↔150/200 en el archivo final.

#### `origen` · conf=0.83 · `dc1fb963…`

**Trigger:** origen=FB y la consulta trae medidas claras

**Rule:** FB suele venir muy completo (medidas ~97%, completo ~65%). Priorizar cotización directa; mediana ~USD 2.6k.

#### `comercial` · conf=0.81 · `9049a714…`

**Trigger:** lead de seguimiento comercial / ranking de recontacto

**Rule:** Priorizar WA y LL sobre ML/CL a igual antigüedad: tickets medianos más altos (WA~USD 2.9k vs ML~USD 1.9k) y mayor tasa de datos completos.

## C. Explicitly NOT added (HITL skipped)

| Draft | Why skipped | Revisit? |
|-------|-------------|----------|
| #1 ML/CL ask family+espesor before calc | Matias skipped | **YES** — still high leverage for incomplete ML leads |

## D. Selection matrix for team

Mark one column per rule in review:

| Rule | KEEP as-is | TUNE wording | WIRE into code | RETIRE |
|------|:--:|:--:|:--:|:--:|
| #2 WA/LL quote-ready | ☐ | ☐ | ☐ | ☐ |
| #3 EM + adjuntos/planos | ☐ | ☐ | ☐ | ☐ |
| #4 IsoPanel techo→IsoDec | ☐ | ☐ | ☐ | ☐ |
| #5 IsoDec pared→IsoPanel | ☐ | ☐ | ☐ | ☐ |
| #6 WA sin familia default | ☐ | ☐ | ☐ | ☐ |
| #7 USD/m² sanity band | ☐ | ☐ | ☐ | ☐ |
| #8 Espesor ladder techo | ☐ | ☐ | ☐ | ☐ |
| #9 FB medidas → directo | ☐ | ☐ | ☐ | ☐ |
| #10 Priorizar WA/LL recontacto | ☐ | ☐ | ☐ | ☐ |
| Draft #1 ML/CL clarify (not live) | ☐ | ☐ | ☐ | ☐ |

## E. Recommended wiring (after selection)

1. **#7 pricing** → Log Cotizaciones / calc QA gate (flag USD/m² outliers).
2. **#3 adjuntos** → ensure mail/WA attachment path feeds vision/PDF extract before clarify.
3. **#10 comercial** → `/commercial-followup` ranking weight by origen.
4. **#4/#5 familia** → scenario router unit tests with golden consultas.
5. Resume Dropbox full run (~64% left) to harden medians before changing bands.

## F. Resume prompts

```
IAlfred/team: Review docs/team/knowledge/CONOCIMIENTO-COMPARATIVE-2026-10-11.md
Fill selection matrix (KEEP/TUNE/WIRE/RETIRE) for rules #2–#10 and draft #1.
Then implement WIRE items only.
```

```
Continue quote-knowledge: resume Dropbox full_run_6616.py (skips cache),
re-run finalize + bq load --replace, refresh USD/m² bands in rule #7.
```
