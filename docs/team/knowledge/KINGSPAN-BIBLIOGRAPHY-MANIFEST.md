# Manifiesto de bibliografía técnica (Kingspan / paneles)

Este documento define el significado operativo del JSON de bibliografía (guías PDF, hubs CAD, detalles de terceros) y cómo usar el esquema en [`KINGSPAN-BIBLIOGRAPHY-MANIFEST.schema.json`](./KINGSPAN-BIBLIOGRAPHY-MANIFEST.schema.json).

## Campos principales

| Campo | Uso |
|--------|-----|
| `manifestVersion` | Versión del **forma** del manifiesto (p. ej. `1.0.0`). Cambiar cuando se agreguen campos obligatorios o se rompa compatibilidad. |
| `fecha_local` | Fecha de negocio o de exportación en zona local (`YYYY-MM-DD`). |
| `retrieved_at` | Opcional. Momento ISO 8601 en que se verificaron los enlaces o se generó el manifiesto. |
| `EXPORT_SEAL` | Bandera **declarativa**: el autor indica que el paquete está listo para uso downstream (export a KB, memoria técnica, etc.). **No** es firma criptográfica ni certificación legal. |
| `links` | Objeto cuyas claves son categorías (p. ej. `UK_IE_oficial_PDF`). Cada valor es un array de entradas con `titulo`, `url` y opcionalmente `nota`, `source_tier`, `document_id`. |

## `source_tier` (recomendado en cada entrada)

Valores sugeridos (alineados al esquema):

- `manufacturer_official`: documentación publicada por el fabricante para el producto/sistema.
- `regional_official`: guía regional (GB/IE, Nordics, CEE) en sitio del fabricante o CDN oficial.
- `third_party_library`: biblioteca CAD o PDF de terceros (p. ej. ARCAT); no sustituye DTA ni memoria del fabricante.
- `hub_listing`: página de listado (recursos, bundles); la descarga puede requerir login.

## Buenas prácticas

1. **HTTPS** y dominios revisados manualmente (evitar typosquatting).
2. Para URLs con IDs opacos (`ASS_*` en CDN), registrar `retrieved_at` o `document_id` para trazabilidad cuando cambien los enlaces.
3. Separar explícitamente **oficial** vs **no oficial** en las claves del objeto `links` o con `source_tier` en cada ítem.
