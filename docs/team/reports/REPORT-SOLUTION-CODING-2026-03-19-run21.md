# REPORT — Solution / Coding — RUN 2026-03-19 / run21

## Resumen ejecutivo

Se ejecutó **full team run 21** con foco en **MATPROMT paso 0a** (bundle en `MATPROMT-FULL-RUN-PROMPTS.md`) e **implementación** en calculadora de fachada alineada a pedido operativo.

## Implementación (Coding)

| Área | Cambio |
|------|--------|
| **T2 fachada** | BOM en **unidades**; `PU = precio paquete ×100 ÷ 100`. Campo `unidades_por_paquete` en `FIJACIONES.tornillo_t2`. |
| **Cinta butilo** | **Opcional**; default `inclCintaButilo: false`. Toggle UI cuando hay pared y selladores activos. |
| **Silicona 300 ml neutra** | Nuevo ítem `SELLADORES.silicona_300_neutra` (precios placeholder); opción `inclSilicona300Neutra`; cantidad por `metros_cobertura_por_unid` (default 8 m junta/unid). |
| **API/canónico** | `calcSelladorPared(perimetro, cantPaneles, alto, opts?)`, `calcParedCompleto` acepta `inclCintaButilo`, `inclSilicona300Neutra`. |
| **MATRIZ** | SKU `SIL300N` → `SELLADORES.silicona_300_neutra` en `matrizPreciosMapping.js`. |
| **Proyecto .bmc.json** | Defaults `inclCintaButilo` / `inclSilicona300Neutra` en `projectFile.js`. |
| **Tests** | `tests/validation.js`: aserciones T2 unid, sin cinta por defecto, con cinta/sil300. **111 passed.** |

## Pendientes (sin este run)

- Ajustar precios reales silicona 300 en MATRIZ / constants.
- Sincronizar `docs/index.html` embebido si se usa como referencia viva (opcional).
- Tabs/triggers Sheets, E2E Cloud Run, npm audit --force, billing, Repo Sync externo (sin cambio).

## Handoff

- **Judge:** evaluar MATPROMT + Calc + cobertura tests.
- **Repo Sync:** commit sugerido tras revisión usuario.
