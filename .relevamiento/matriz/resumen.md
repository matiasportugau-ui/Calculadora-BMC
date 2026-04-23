# RESUMEN EJECUTIVO

**Fecha:** 2026-04-23
**Branch:** `claude/bmc-production-audit-3Pjos`

```
RESUMEN EJECUTIVO
- Dominios verdes: 0/8
- Dominios amarillos: 6/8  (cotizaciones, crm, precios, ventas/envíos, pagos/fiscal, dashboards)
- Dominios rojos: 2/8      (calculadora/código por deuda de ramas/PRs; automatizaciones/infra por 3 modelos de deploy)
- Credenciales expuestas: NO (búsqueda exhaustiva, 0 matches de sk-*, AIza*, PRIVATE KEY, Bearer tokens o passwords hardcodeadas en archivos trackeados)
- Gaps críticos: gh CLI ausente, gcloud ausente, Drive API ausente, ADC ausente — ver .relevamiento/matriz/gaps.md
- Próximo paso recomendado: responder P1 (modelo deploy canónico) + P2 (master de precios) para bajar los 2 dominios rojos a amarillo antes de cualquier cambio estructural.
```

## Qué encontré en una línea por dominio

1. **Cotizaciones** 🟡 — master = workbook `1N-4ky...` tab `CRM_Operativo`; dos schemas coexisten y legacy quote routes siguen activas.
2. **CRM** 🟡 — mismo workbook; extensión Chrome OmniCRM Sync fuera de este repo (estado = duda abierta).
3. **Precios** 🟡 — MATRIZ `1oDMkBgWx...` es fuente declarada pero `constants.js` hardcodeado y el flujo de sync es manual.
4. **Ventas/envíos** 🟡 — tres capas: Sheet 2.0-Ventas (`1KFNKW...`), Stock E-Commerce (`1egtKJ...`) y Postgres Transportista (todavía duda abierta sobre estado en vivo).
5. **Pagos/fiscal** 🟡 (RO estricto) — Sheet Pagos Pendientes (`1AzHha...`) + Calendario (`1bvnbY...`); columna MONTO vs D/E documentada pero frágil.
6. **Calculadora/código** 🔴 — master = `matiasportugau-ui/calculadora-bmc` branch `main` (commit `1118dfd` 2026-04-22); rojo por 84 ramas y 20 PRs open / 15 draft sin consolidar.
7. **Dashboards** 🟡 — backend canónico `server/routes/bmcDashboard.js` (2781 líneas); 5 Apps Script `.gs` sin pipeline automatizado de deploy.
8. **Automatizaciones/infra** 🔴 — project `chatbot-bmc-live` en us-central1; **tres modelos de deploy coexisten** (GH Actions Artifact Registry, Cloud Build GCR full-stack, Cloud Build auxiliar) — la imagen activa del servicio `panelin-calc` depende de quién desplegó último.

## Qué NO pude hacer (documentado en `.relevamiento/matriz/gaps.md`)

- Listar repos de `matiasportugau-ui/*` (falta `gh` CLI; MCP scope limitado a `calculadora-bmc`).
- Confirmar Cloud Run services y su última revisión (falta `gcloud`).
- Leer Drive/Sheets en vivo (faltan `gspread`, `google-api-python-client`, ADC).
- Verificar Apps Script deployado vs repo.
- Verificar estado del `shop-chat-agent/` como servicio separado.
- Examinar `.env` del repo local (por protocolo: existe pero no se abre).

## Archivos generados en este relevamiento

```
.relevamiento/
├── logs/
│   ├── preflight.txt
│   └── env-check.txt
├── dumps/
│   ├── repo-root.txt
│   ├── repo-structure.txt
│   ├── repo-structure-2.txt
│   ├── package.json.txt
│   ├── server-core.txt
│   ├── deploy-configs.txt
│   ├── duplicados-check.txt
│   └── extra-modules.txt
├── inventarios/
│   ├── prs-open-top20.json
│   ├── referencias-externas.txt
│   ├── sheet-ids-found.txt
│   ├── sheet-ids-where.txt
│   └── sheet-ids-names.txt
└── matriz/
    ├── matriz.md              ← Parte 1 (entregable)
    ├── inventario-crudo.md    ← Parte 2
    ├── conflictos.md          ← Parte 3
    ├── preguntas.md           ← Parte 4
    ├── resumen.md             ← este archivo
    ├── gaps.md                ← limitaciones del entorno
    ├── credenciales-sospechas.txt
    ├── credenciales-detalle.txt
    └── dominio-*.txt          ← inventario por dominio (8)
```
