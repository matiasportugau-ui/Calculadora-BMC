# CRM_Operativo — Canonical column map

**Single human-readable source of truth** for the `CRM_Operativo` tab column
layout. Headers live in **row 3**; data starts at **row 4**.

> **Why this file exists.** The same column layout is currently encoded in four
> places in code (see *Sources* below). Until they are unified in code, this
> document is the reference they must all agree with. When you add/rename/move a
> column in the sheet, update this table **and** every source that addresses that
> column. A drift between the write side and the read side = silent data
> corruption (a value written to column X is read back from column Y).

## Sources that must stay in sync with this map

| Source | File | Role | Shape |
|--------|------|------|-------|
| Write contract | `server/lib/crmRowMapper.js` (`CRM_WRITE_CONTRACT`) | header-anchored writes (email, quote, WA) | logical key → header aliases + fallback letter |
| Read parser | `server/lib/crmRowParse.js` (`parseCrmRowAtoAK`) | reads a row into a named object (9 consumers) | 0-based index → field name |
| Gate/taxonomy block | `server/lib/crmOperativoLayout.js` (`Col`, default tails, range helpers) | AG–AN letters + gate defaults | letter constants |
| Cotizaciones CRUD | `server/routes/bmcDashboard.js` (`CRM_TO_BMC`) | header text → BMC canonical key | header → BMC key |

## Column table

Legend — **Key** = `CRM_WRITE_CONTRACT` logical key · **BMC key** = `CRM_TO_BMC`
mapping (cotizaciones CRUD only) · **Read** = parsed by `parseCrmRowAtoAK` ·
writers: **E**=email-ingest, **Q**=quote append, **W**=WhatsApp, **M**=ML-sync.

| Col | idx | Header (row 3) | Key | BMC key | Read | Writers / notes |
|-----|-----|----------------|-----|---------|------|-----------------|
| A | 0 | ID | — | COTIZACION_ID | — | Q writes correlation_id; usually `=ROW()-3`. Keep as Plain Text/Number (not Date). |
| B | 1 | Fecha | `fecha` | FECHA_CREACION | ✓ | E Q W M |
| C | 2 | Cliente | `cliente` | CLIENTE_NOMBRE | ✓ | E Q W M · first-empty-C = row finder |
| D | 3 | Teléfono | `telefono` | TELEFONO | ✓ | E Q W (W falls back to chatId); M leaves "" |
| E | 4 | Ubicación / Dirección | `ubicacion` | DIRECCION | ✓ | E Q W; M "" |
| F | 5 | Origen | `origen` | ORIGEN | ✓ | values: `Email-Auto` / `Calculadora-Panelin` / `WA-Auto` / `ML` |
| G | 6 | Consulta / Pedido | `consulta` | NOTAS | ✓ | E Q W M |
| H | 7 | Categoría | `categoria` | — | — | E Q W M |
| I | 8 | *(unverified)* | — | — | — | **M writes `"Alta"`** (priority); E/Q/W leave "" |
| J | 9 | Estado | `estado` | ESTADO | ✓ | E Q W M (default `Pendiente`) |
| K | 10 | Responsable | `responsable` | ASIGNADO_A | — | Q=vendedor, W=vendedor, M=`PANELSIM` |
| L | 11 | *(unverified)* | — | — | — | **M writes `"Responder ML"`** |
| M | 12 | *(unverified; maybe «Fecha próxima acción» → FECHA_ENTREGA)* | — | FECHA_ENTREGA? | — | **M writes `today()`** |
| N | 13 | *(unverified)* | — | — | — | **M writes `"Nuevo"`** |
| O | 14 | *(unverified)* | — | — | — | M `"No"` |
| P | 15 | *(unverified)* | — | — | — | M `"No"` |
| Q | 16 | *(unverified)* | — | — | — | M "" |
| R | 17 | Probabilidad de cierre | `probabilidad` | — | — | E Q W M |
| S | 18 | Urgencia | `urgencia` | — | — | E Q W; M `"Hoy"` |
| T | 19 | Validar stock | `validarStock` | — | — | E Q W M (default `No`) |
| U | 20 | *(unverified)* | — | — | — | — |
| V | 21 | Tipo de cliente | `tipoCliente` | — | — | E Q W; M `"ML"` |
| W | 22 | Observaciones | `observaciones` | COMENTARIOS_ENTREGA | ✓ | E Q W M · **M embeds `Q:<id>` dedup key** |
| X | 23 | *(unverified)* | — | — | — | M writes a date |
| Y–AA | 24–26 | *(unverified)* | — | — | — | M mostly "" |
| AB | 27 | *(unverified)* | — | — | — | M `"Sí"` |
| AC–AD | 28–29 | *(unverified)* | — | — | — | M "" |
| AE | 30 | *(unverified)* | — | — | — | M `"SI"` |
| AF | 31 | Respuesta sugerida | `respuestaSugerida` | — | ✓ | W M (suggested AI reply) |
| AG | 32 | Provider IA | `providerIa` | — | ✓ | `Col.PROVIDER_IA` · W M |
| AH | 33 | Link presupuesto | `linkPresupuesto` | — | ✓ | `Col.LINK_PRESUPUESTO` · Q writes PDF/Drive URL |
| AI | 34 | Aprobado enviar | `aprobadoEnviar` | — | ✓ | `Col.APROBADO_ENVIAR` · gate, default `No` |
| AJ | 35 | Enviado el | `enviadoEl` | — | ✓ | `Col.ENVIADO_EL` |
| AK | 36 | Bloquear auto | `bloquearAuto` | — | ✓ | `Col.BLOQUEAR_AUTO` · gate, default `No` |
| AL | 37 | Tipo contacto | — (`tipoContacto` read) | — | ✓ | `Col.TIPO_CONTACTO` · taxonomy (`crmTaxonomy.js`) |
| AM | 38 | Tags taxonomía | — (`tagsTaxonomia` read) | — | ✓ | `Col.TAGS_TAXONOMIA` |
| AN | 39 | Notas taxonomía | — (`notasTaxonomia` read) | — | ✓ | `Col.NOTAS_TAXONOMIA` |

*(unverified)* = header text not yet confirmed against the live sheet. The
ML-sync writer (`server/ml-crm-sync.js`) writes these columns positionally with
hard-coded values; confirm their real headers before migrating ML-sync onto
`CRM_WRITE_CONTRACT`.

## Per-writer ranges (current)

| Writer | Range(s) | Anchoring |
|--------|----------|-----------|
| Email ingest (`bmcDashboard.js`) | `B:W` + `AG:AK` | header-anchored (`crmRowMapper`) ✓ |
| Quote append (`crmAppend.js`) | append `B:AK` (+ `A` correlation) | header-anchored ✓ |
| WhatsApp (`server/index.js`) | `B:W` + conditional `AF:AG` + `AH:AK` | header-anchored ✓ (data block) |
| ML-sync (`server/ml-crm-sync.js`) | `B:AK` (dense positional) | **positional** (sanitized + width-guarded; not yet header-anchored) |

## Future work (deferred)

1. **Migrate ML-sync onto `CRM_WRITE_CONTRACT`** once the *(unverified)* headers
   above are confirmed — add the ML-specific keys (I/L/M/N/O–AE) to the contract.
2. **Unify the four sources in code** into a single canonical module that the
   write contract, read parser, `Col`, and `CRM_TO_BMC` all derive from. Highest
   friction is the read side: `parseCrmRowAtoAK` has 9 consumers with no contract
   tests — migrate behind a deprecated re-export and add consumer tests first.
