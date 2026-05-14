# Walkthrough · Administrador de Cotizaciones

Este directorio guarda el material crudo para los tooltips, "?" y popup-tips del módulo `/hub/cotizaciones`. Lo genera `scripts/playwright-admin-cot-walkthrough.mjs`.

## Cómo correrlo

1. Levantar dev:full con la flag prendida:

   ```bash
   VITE_FEATURE_ADMIN_COT_V2=true npm run dev:full
   ```

2. En otra terminal:

   ```bash
   npm run walkthrough:admin-cot
   ```

3. **Variantes**:

   ```bash
   # Browser visible (debug)
   npm run walkthrough:admin-cot:headed

   # Con token (cubre flows con backend real)
   BMC_COCKPIT_TOKEN=<token> npm run walkthrough:admin-cot

   # Otro base URL (preview Vercel, por ej.)
   PLAYWRIGHT_BASE_URL=https://preview-foo.vercel.app npm run walkthrough:admin-cot
   ```

## Qué produce

```
docs/walkthrough/admin-cot/
├── source.json                       # registro estructurado de cada step
├── screenshots/                      # 1 PNG por step (gitignored)
│   ├── 01-open-page.png
│   ├── 02-topbar-breadcrumb.png
│   └── …
└── README.md                         # este archivo
```

### `source.json` shape

```jsonc
{
  "generatedAt": "2026-05-14T…",
  "baseUrl": "http://127.0.0.1:5173",
  "url": "http://127.0.0.1:5173/hub/cotizaciones",
  "flag": "VITE_FEATURE_ADMIN_COT_V2=true",
  "mode": "dry" | "live",
  "stepCount": 24,
  "okCount": 22, "skippedCount": 2, "failCount": 0,
  "steps": [
    {
      "id": "kpi-stale",
      "intent": "KPI: ≥14 días sin enviar",
      "selector": ".adminCot__stat:has(.adminCot__stat-label:text-is(\"≥14 días sin enviar\"))",
      "helpType": "tooltip",   // tooltip | callout | first-time-tip | inline-?
      "helpText": {
        "short": "Cotizaciones envejecidas que conviene cerrar",
        "long":  "Filas con más de 14 días desde la consulta…"
      },
      "screenshot": "screenshots/08-kpi-stale.png",
      "status": "ok",
      "durationMs": 412,
      "boundingBox": { "x": 412, "y": 184, "w": 180, "h": 76 }
    }
  ]
}
```

## Modo dry vs live

| Modo | Cuándo | Qué cubre | Qué saltea |
|---|---|---|---|
| **dry** | Sin `BMC_COCKPIT_TOKEN` (auto-load falla) | Topbar, breadcrumb, ⌘K hint, panel de token, ⌘K palette, skin cycle, reduced-motion, focus | KPIs, toolbar, tabla, drawer, kebab, bulk, batch modal |
| **live** | Con `BMC_COCKPIT_TOKEN` inyectado | Todo (incluye los pasos del backend) | nada |

Steps `optional: true` se reportan como `skipped` en dry mode y no rompen el script.

## Phase 2 (separado)

El JSON es input para una PR futura que va a:

1. Crear componentes `<Tooltip />`, `<HelpButton />`, `<Callout />`, `<FirstTimeTip />` que consumen este JSON
2. Mapear cada `step.id` a un anchor en el componente real (ej: `<HelpButton id="kpi-stale" />` junto al KPI)
3. Permitir override editorial del `helpText` desde un panel admin (i18n incluido)

Por ahora **el JSON es el contrato** — si cambiás IDs acá hay que actualizarlos en Phase 2.

## Re-runs (idempotency)

Cada corrida **reemplaza** `source.json` y los PNGs cuyo `stepIdx` coincida — los PNGs de runs previos con índices mayores no se borran automáticamente. Si necesitás un reset total, borrá `screenshots/` antes de re-correr.

## Troubleshooting

- **Token autoload falla en headless** — el script inyecta `BMC_COCKPIT_TOKEN` en `localStorage["bmc_cockpit_token"]` antes del primer `goto`. Si el token expiró o no corriste el cockpit, dejá `BMC_COCKPIT_TOKEN` vacío y andá a dry mode (los pasos con backend salen como `skipped`).
- **`page.goto` timeout > 5s** — el frontend `dev:full` no terminó de levantar. Esperá a ver `Vite … ready` en la otra terminal antes de correr `npm run walkthrough:admin-cot`. Para preview Vercel, asegurate que `PLAYWRIGHT_BASE_URL` apunta a un deploy ya terminado.
- **CI corre dry y no falla pero el `source.json` queda chico** — el job de Lint corre el script sin token, así que los pasos `optional: true` salen `skipped` y no rompen el run. Si CI marca `failCount > 0`, hay un step non-optional roto: revisá el log inline (`status === "fail"` solo se levanta para steps non-optional).
