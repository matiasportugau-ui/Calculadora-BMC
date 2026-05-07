# AE-Agent × Calculadora — Contract

**Última actualización:** 2026-05-07

Toda cotización emitida por el chat Panelin (AE-Agent) atraviesa **una sola
superficie HTTP**: las rutas `/calc/*` montadas en el mismo proceso, vía
loopback `127.0.0.1:${config.port}`. Este documento describe el contrato.

## Tools que cotizan

| Tool | Endpoint | Notas |
|---|---|---|
| `calcular_cotizacion` | `POST /calc/cotizar` | Single source of truth. Inyecta `source: "ae_agent"` en el body. |
| `presupuesto_libre` | `POST /calc/cotizar/presupuesto-libre` | Para BOM manual (líneas sueltas). Inyecta `source: "ae_agent"`. |
| `generar_pdf` | `POST /calc/cotizar/pdf` | Loopback con fallback puntual a `publicBaseUrl` solo en error de transporte. |

Las tools **read-only** (`obtener_precio_panel`, `obtener_catalogo`,
`obtener_escenarios`, `obtener_informe_completo`, `comparar_listas`,
`comparar_escenarios`) también usan el cliente cuando hacen HTTP, pero pueden
ejecutar lógica in-memory (catálogo, comparaciones derivadas) sin llamar a la
red.

## Cliente compartido

[`server/lib/calcLoopbackClient.js`](../../../server/lib/calcLoopbackClient.js)
expone `postCotizar`, `postCotizarPdf`, `postPresupuestoLibre` y
`getCalcEndpoint`. Todos resuelven contra `http://127.0.0.1:${config.port}`.
La salida normalizada es siempre `{ ok, status, body, error }`.

`postCotizarPdf` cae a `config.publicBaseUrl` solo si el `fetch` lanza un
error de transporte (no 4xx/5xx). El fallback emite un log estructurado
`event: "ae_agent_quote_pdf_fallback"`.

## Provenance — campo `source`

`POST /calc/cotizar` y `POST /calc/cotizar/pdf` aceptan un campo opcional
`source: "ae_agent" | "calculator"` en el body.

- `"ae_agent"` → la cotización quedó archivada en `quoteRegistry.js` con
  `source: "ae_agent"`. `listar_cotizaciones_recientes` la surface.
- ausente o cualquier otro valor → se trata como `"calculator"` (default).

## Archivado durable

Toda cotización AE-agent queda archivada en
[`server/lib/quoteRegistry.js`](../../../server/lib/quoteRegistry.js)
(GCS-backed, fallback in-memory cuando `GCS_QUOTES_BUCKET` no está seteado):

| Camino | Entrada en registry | Tipo |
|---|---|---|
| `calcular_cotizacion` (sin PDF) | `recordCalcEvent` | `kind: "calc_only"` |
| `calcular_cotizacion` + `generar_pdf` | `registerQuotation` (camino PDF) | sin `kind` (entrada canónica con `pdf_id`/`pdfUrl`) |

`recordCalcEvent` es **idempotente** dentro de una ventana de 5 minutos por
hash de body — protege contra reintentos del mismo turno.

## Listados — `calc_only` vs PDF

- La tool **`listar_cotizaciones_recientes`** llama `listQuotations` **sin**
  `omitCalcOnly` — el agente ve también filas `kind: "calc_only"`.
- **`GET /calc/cotizaciones`** (auth) **excluye** `calc_only` por defecto para
  listas orientadas a PDF/operador. Query opcional
  **`include_calc_only=true`** devuelve el universo completo (debug / soporte).

## Logs estructurados

Cada tool emite una línea JSON al stdout para Cloud Logging / pino:

```json
{ "event": "ae_agent_quote", "tool": "calcular_cotizacion", "scenario": "solo_techo",
  "lista": "web", "duration_ms": 12, "ok": true }
```

Nunca incluyen `cliente.{nombre,rut,telefono,direccion}` ni el cuerpo del
mensaje del usuario — sólo metadatos no PII.

## Guardrail del prompt

El system prompt del chat (`server/lib/chatPrompts.js`) contiene una **REGLA
DURA** cerca del tope del bloque de tools:

> **REGLA DURA — Precios y totales.** No emitas USD/m², subtotal sin IVA,
> IVA o total con IVA salvo que provengan del último resultado de
> `obtener_precio_panel`, `calcular_cotizacion`, `presupuesto_libre` o
> `comparar_listas`. Si te falta el dato, llamá la tool primero.

## Tests

- [`tests/calcLoopbackClient.test.js`](../../../tests/calcLoopbackClient.test.js)
  — 15 unit + integration (host, fallback, error normalization).
- [`tests/quoteRegistryCalcEvent.test.js`](../../../tests/quoteRegistryCalcEvent.test.js)
  — dedupe + listado + `omitCalcOnly`.
- [`tests/agentTools.test.js`](../../../tests/agentTools.test.js) — 242
  contract tests, default fetch stub delega `/calc/cotizar*` a
  `runCalculation`+`buildGptResponse`.

`npm run gate:local` debe quedar verde antes de merge.

## Verificación end-to-end

1. `npm run dev:full` → API en `:3001`, Vite en `:5173`.
2. Chat AE-Agent: pedir cotización de techo (ej. "techo 8×6, ISODEC 50 web").
3. Logs: confirmar `event: "ae_agent_quote", tool: "calcular_cotizacion", ok: true`.
4. Pedir PDF: `event: "ae_agent_quote", tool: "generar_pdf"` con `pdf_id` y
   `gcs_url` poblados.
5. Pedir "últimas cotizaciones": la entrada recién creada aparece con
   `source: "ae_agent"`.
6. Validar paridad: `curl -X POST http://127.0.0.1:3001/calc/cotizar` con el
   mismo body devuelve `resumen.total_usd` idéntico al que mostró el chat.
