# Calculadora BMC — Claude Code context

## Stack
- **Frontend**: React 18 + Vite 7, desplegado en Vercel (https://calculadora-bmc.vercel.app)
- **Backend**: Express 5 + Node 20, desplegado en GCP Cloud Run (port 3001)
- **Storage**: Google Sheets (precios/CRM), PostgreSQL (logística transportista), GCS (tokens/assets)
- **AI**: Anthropic SDK 0.80, OpenAI 6.32, Google GenAI 0.24 — todos usados en server/
- **Test**: `node tests/validation.js` (63 assertions) + Playwright E2E

## Comandos clave
```bash
npm run dev              # Solo frontend (Vite :5173)
npm run dev:full         # API :3001 + Vite :5173
npm run gate:local       # lint + tests (correr antes de commit)
npm run gate:local:full  # lint + tests + build (pre-deploy)
npm test                 # validation.js + roofVisualQuoteConsistency.js
npm run lint             # ESLint sobre src/
npm run matriz:pull-csv  # Sincronizar precios desde Google Sheets BROMYROS
npm run smoke:prod       # Smoke test contra producción
```

## Archivos críticos
| Archivo | Propósito |
|---|---|
| `src/utils/calculations.js` | Motor de cálculo puro (techo, pared, fijaciones, selladores) |
| `src/data/constants.js` | Catálogo de paneles, fijaciones, selladores, perfiles — precios USD sin IVA |
| `src/data/pricing.js` | Capa dinámica: lee MATRIZ CSV (override sobre constants.js) |
| `src/utils/calculatorConfig.js` | IVA, lista activa, flete — persiste en localStorage |
| `server/routes/bmcDashboard.js` | Google Sheets orchestration (CRM, finanzas, MATRIZ) |
| `server/config.js` | Todas las env vars con defaults |
| `docs/team/PROJECT-STATE.md` | Fuente única de verdad del estado del proyecto |

## Convenciones
- ES modules (`type: "module"` en package.json) — usar `import/export`, nunca `require()`
- Precios **siempre** USD sin IVA en constantes. IVA se aplica UNA VEZ al final con `getIVA()` (default 22%)
- Funciones de cálculo son **puras** (sin side effects) — van en `src/utils/calculations.js`
- Lógica de negocio en `src/utils/` y `src/data/` — NUNCA mezclar con componentes React
- Backend usa `pino` para logging estructurado — no usar `console.log` en server/
- Variables de entorno: `.env` local (gitignored), `.env.example` como template

## Reglas de negocio
Ver `BUSINESS_LOGIC.md` para: familias de paneles, fórmulas de fijaciones, escenarios, IVA.

## Agentes y skills
`.cursor/agents/` — 19 agentes definidos. `.cursor/skills/` — 51+ skills.
No crear agentes nuevos sin revisar el catálogo existente primero.
