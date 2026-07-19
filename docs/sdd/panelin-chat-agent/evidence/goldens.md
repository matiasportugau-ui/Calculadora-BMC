# Agent golden cases inventory

**Source:** `tests/agentGolden/cases/` · Runner: `tests/agentGolden/runner.mjs` · Script: `npm run test:agent-golden`  
**Date:** 2026-07-18 · **CONFIRMED**

| # | File | Intent (from name) |
|---|------|---------------------|
| 01 | `01-quote-techo.json` | Quote roof |
| 02 | `02-comparar-listas.json` | Compare price lists |
| 03 | `03-no-tool-without-data.json` | No tool without data |
| 04 | `04-aplicar-no-trust-emit.json` | Apply without trust emit |
| 05 | `05-multi-canal-ml.json` | Multi-channel ML |
| 06 | `06-saludo-sin-calculo.json` | Greeting no calc |
| 07 | `07-pedir-medidas.json` | Ask for dimensions |
| 08 | `08-pared-sin-altura.json` | Wall without height |
| 09 | `09-lista-web-vs-venta.json` | Web vs venta list |
| 10 | `10-iva-explicacion.json` | IVA explanation |
| 11 | `11-no-descuento-silencioso.json` | No silent discount |
| 12 | `12-canal-wa-corto.json` | Short WA channel |
| 13 | `13-sin-tool-precio-suelto.json` | No loose price tool |
| 14 | `14-finanzas-no-tool.json` | Finanzas no tool |
| 15 | `15-multi-escenario-sin-datos.json` | Multi-scenario no data |
| 16 | `16-canal-whatsapp-precio.json` | WA channel price ask |
| 17 | `17-canal-ml-limite.json` | ML channel char limit |
| 18 | `18-canal-panelin-chat-saludo.json` | panelin_chat greeting |
| 19 | `19-canal-email-corto.json` | Email channel short |

**Count:** 19 cases (channel pack: chat / whatsapp / mercado_libre / email). Pre-release: `GOLDEN_REQUIRED=1 npm run test:agent-golden` via `pre-release`.
