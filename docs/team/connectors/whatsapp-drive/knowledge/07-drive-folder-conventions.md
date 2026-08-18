# Convenciones de carpetas Drive

Helpers: `src/utils/quotationNaming.js`. Fechas en **America/Montevideo**.

## Árbol personal (GIS) — raíz `Panelin BMC Cotizaciones`

```
Panelin BMC Cotizaciones/          ← o rootFolderId configurado por usuario
├── {RUT} - {RazónSocial|Nombre}/  ← buildDriveClientFolderName
│   └── {QUOTATION_CODE}/          ← buildDriveQuotationFolderName
│       ├── {CODE}_{YYYY-MM-DD}_{slug}.pdf
│       └── {CODE}.bmc.json
├── (legado flat) BMC-… — cliente…/   ← isLegacyFlatQuotationFolder (em dash)
└── BMC Envíos Coordinaciones/
    └── ENV-….bmc-envios.json
```

## Archivo empresa

Misma jerarquía cliente → código bajo `DRIVE_QUOTE_FOLDER_ID`.

HTML mirrors (agentes): a menudo **planos** en el root del folder de quotes, no anidados.

## Naming

- `montevideoYmd()` → `YYYY-MM-DD`.
- `sanitizeFileSegment` quita `/ \ ? * : " < > |` y recorta.
- Cliente: RUT compacto (máx 14) + label (máx 35) → folder máx 72.
- Código de cotización: folder máx 40.
- Slug de cliente en filename: máx 30.

## Para el conector WA

Si el hilo nombra un **código BMC** o un cliente con RUT:

1. Buscar folder `{code}` bajo el cliente (server OAuth o GIS según quién creó el archivo).
2. Leer `{CODE}.bmc.json` — no el PDF — para reanudar números.
3. El PDF se puede **adjuntar/enviar** (link) por WhatsApp; no indexar el binario como KB.

No asumir que el token GIS ve el archivo empresa, ni viceversa (`drive.file` + dos clients).
