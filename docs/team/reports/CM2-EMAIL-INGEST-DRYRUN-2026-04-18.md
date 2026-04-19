# cm-2 — Dry-run ingest correo (snapshot → API)

**Fecha:** 2026-04-18

**Comando:**

```bash
BMC_API_BASE=https://panelin-calc-642127786762.us-central1.run.app \
  npm run email:ingest-snapshot -- --dry-run --limit 5
```

**Resultado:** OK — 5 mensajes seleccionados (categoría `ventas`), sin POST a CRM (modo dry-run). Snapshot hermano: `conexion-cuentas-email-agentes-bmc/data/snapshot-latest.json`.

**Siguiente paso (human gate):** ingest real con `--limit 1` y revisión de fila en CRM cuando corresponda la operación; ver [PROCEDIMIENTO-CANALES-WA-ML-CORREO.md](../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) Fase 3.
