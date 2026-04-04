# PanelRendering — ISODEC / ISOROOF (local cache)

Imágenes de **catálogo Shopify** (BMC Uruguay) usadas en el visor y referenciadas en `src/data/quoteVisorShopifyFamilies.json` para familias **ISODEC_*** e **ISOROOF_***.

## Regenerar

Desde la raíz del repo:

```bash
npm run panel:rendering:sync
```

Esto descarga URLs únicas del CDN a `images/` y actualiza `manifest.json`.

- `--dry-run`: solo lista destinos, sin escribir archivos.

## Contenido

- `images/` — PNG, JPG, AVIF según el archivo en Shopify.
- `manifest.json` — URL original, ruta local, familias asociadas.

Los activos siguen siendo propiedad de BMC / según uso del sitio; esta carpeta es una **cachía de trabajo** para diseño, pruebas offline o bake de texturas. En producción la app sigue pudiendo cargar las mismas URLs remotas.

**Nota:** `ISOROOF_COLONIAL` no tiene entradas propias en `quoteVisorShopifyFamilies.json` (usa fallback visual como otras familias); por eso no aparece en `manifest.json` hasta que el mapping de Shopify incluya galería para esa clave.
