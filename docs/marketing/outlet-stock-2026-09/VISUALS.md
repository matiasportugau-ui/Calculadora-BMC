# Outlet BMC — SDD visuals (mock only)

**Fecha:** 2026-09-04  
**Fuente:** [share grok.com](https://grok.com/share/c2hhcmQtNA_1ebce1ca-f6b1-4c05-b638-d88e572d04b6) · inventario verbal 01/09 + reemplazo de paneles 02/09  
**Estado:** revisión. **No implementado** en Shopify ni ML.

## Inventario vigente (02/09)

Paneles ISODEC EPS 100 blanco (reemplaza 10,30 m y 8×4,70 m del 01/09):

| Largo | Piezas | m² (útil 1,12) |
|------:|-------:|---------------:|
| 9,80 m | 1 | 10,98 |
| 5,00 m | 5 | 28,00 |
| 3,60 m | 1 | 4,03 |
| **Total** | **7** | **43,01** |

Lista BMC Directo: **USD 46,07/m²** → lista lote **USD 1.981**. Pack de salida propuesto **USD 1.690**. No vender como kit de techo: faltan remates blancos a juego.

Perfiles 02/09:

| Pieza | Cant. | Estado | Salida |
|---|---:|---|---|
| Bajadas plegadas 2,40 m gris oscuro | 25 | OK | USD 12 c/u · pack 10 USD 110 |
| Babetas atornillar 3 m bordeaux | 50 | 2ª sel. | USD 5 c/u · pack 10 USD 45 |
| Cumbreras rojas importación 3 m | 12 | 2ª sel. | USD 7 c/u · 12 USD 80 |
| Cumbreras trapezoidales 1 m gris | 6 | OK | USD 13 c/u · pack USD 70 |
| Laterales blancos 2,60 m | 7 | OK | USD 20 c/u · **no outlet** |
| Cumbreras ISOROOF 3G 1 m terracota | 4 | OK | ~USD 20 · **no outlet** |

Pack outlet = **lote 6 live**, salida USD 80, reserva USD 280 (vs ~480 lista).

## Mecánica (eBay Live, no eBay.com)

Fuente: [eBay Live FAQ](https://pages.ebay.com/ebaylive-faq).

| Pieza eBay Live | En el mock BMC |
|---|---|
| Current bid + username | Puja actual + cinta (`techos_este`, etc.) |
| Un tap / swipe = próximo incremento | Botón **Pujar USD n** + 2 quick bids |
| Tabla de incrementos | Copiada 1:1 (1 / 2 / 3 / 5 / 10 / 25…) |
| Soft-close: puja en últimos 5 s → +5 s | Implementado en `live.html` |
| Absentee / max proxy | Lote 3 + WhatsApp “máximo oculto” |
| ~2 min por ítem en live | Lotes 2–6 |
| Timed auction | Paneles 48 h (caro, no cabe en 2 min) |
| Auto-cargo al ganador | **No.** WhatsApp + retiro. Bids still firm. |
| Palabra remate | No se usa |

Salidas bajas a propósito (como hosts de eBay Live): la reserva es el piso, no la salida.

## Pantallas mock

| # | Archivo | Qué es |
|---|---------|--------|
| 0 | `index.html` | Brief + checkboxes |
| 1 | `live.html` | Martillo LIVE interactivo (lote 2 bajadas) |
| 2 | `outlet.html` | Catálogo del evento |
| 3 | `pdp-bajadas.html` | Absentee lote 3 babetas |
| 4 | `ml-bajadas.html` | Timed 48 h paneles, cromo eBay |
| 5 | `wa.html` | Aviso live + proxy por WhatsApp |

Fotos en `assets/` son **generadas** (depósito). Para publicar: fotos reales del stock.

Capturas de los mocks: `shot-outlet-desktop.png`, `shot-outlet-mobile.png`, `shot-pdp-desktop.png`, `shot-ml-bajadas.png`, `shot-ml-babetas.png`, `shot-wa.png`, `shot-brief.png`.

Local: `python3 -m http.server 8766 --directory docs/marketing/outlet-stock-2026-09` → http://127.0.0.1:8766/

## Reglas que el mock ya cumple

- No dice “remate”.
- No cobra online.
- Oferta por lote / pack, no por pieza suelta al precio pack.
- Retiro en depósito, flete a cotizar.
- 2ª selección se lee en el sello, no se esconde.
- Laterales blancos y terracota 1 m fuera del outlet.

## Desarrollo (si hay OK)

0. WhatsApp + stories — hoy, cero código.  
1. Colección Shopify `outlet` + form + countdown — 2–4 días.  
2. `/outlet` en calculadora — solo si 1 no alcanza.

Siguiente paso real cuando Lote bajadas + babetas estén OK: pegar el texto de `wa.html`. Todavía sin tocar la web.
