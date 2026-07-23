# Evidence — agent goldens (R2)

**Date:** 2026-07-23  
**Runner:** `npm run test:agent-golden` → `tests/agentGolden/runner.mjs`  
**Count:** **19** JSON cases under `tests/agentGolden/cases/`  
**Release gate:** `pre-release` sets `GOLDEN_REQUIRED=1`

| # | File | Intent (from filename) |
|---|------|------------------------|
| 01 | `01-quote-techo.json` | Quote techo happy path |
| 02 | `02-comparar-listas.json` | Compare web vs venta |
| 03 | `03-no-tool-without-data.json` | No tool without data |
| 04 | `04-aplicar-no-trust-emit.json` | aplicar_estado_calc trust rules |
| 05 | `05-multi-canal-ml.json` | Multi-channel ML |
| 06 | `06-saludo-sin-calculo.json` | Greeting without calc |
| 07 | `07-pedir-medidas.json` | Ask for measures |
| 08 | `08-pared-sin-altura.json` | Wall without height |
| 09 | `09-lista-web-vs-venta.json` | List web vs venta |
| 10 | `10-iva-explicacion.json` | IVA explanation |
| 11 | `11-no-descuento-silencioso.json` | No silent discount |
| 12 | `12-canal-wa-corto.json` | WA short channel |
| 13 | `13-sin-tool-precio-suelto.json` | No free-floating price tool |
| 14 | `14-finanzas-no-tool.json` | Finanzas no tool |
| 15 | `15-multi-escenario-sin-datos.json` | Multi-scenario without data |
| 16 | `16-canal-whatsapp-precio.json` | WA price channel |
| 17 | `17-canal-ml-limite.json` | ML channel limits |
| 18 | `18-canal-panelin-chat-saludo.json` | Panelin chat greeting |
| 19 | `19-canal-email-corto.json` | Email short channel |

**Note:** Child SDD said 15 — stale. promptfoo under `evals/promptfoo/` covers **presupuestación orchestrator**, not full Panelin dialogue.
