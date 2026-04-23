# CONFLICTOS DETECTADOS — Parte 3

**Fecha:** 2026-04-23
**Criterio:** duplicaciones, referencias a fuentes posiblemente abandonadas, divergencias entre docs y código, credenciales expuestas, endpoints sin repo vivo o repos sin deploy.

---

## 1. [CRÍTICO] Tres modelos de deploy coexisten para `panelin-calc`

Hay tres caminos distintos para desplegar la API + frontend a Cloud Run, y los tres están vivos en el repo:

### Modelo A — Servicios separados (GitHub Actions, Artifact Registry)
- `.github/workflows/deploy-calc-api.yml` → servicio **`panelin-calc`** con `server/Dockerfile` (solo API Express :8080) · imagen `us-central1-docker.pkg.dev/chatbot-bmc-live/cloud-run-repo/panelin-calc:<sha>`
- `.github/workflows/deploy-frontend.yml` → servicio **`panelin-calc-web`** con `Dockerfile` (nginx sirviendo Vite dist) · imagen `cloud-run-repo/panelin-calc-web:<sha>`
- Triggered by push a `main` con paths filtrados.

### Modelo B — Imagen full-stack (Cloud Build manual)
- `cloudbuild.yaml` → construye `Dockerfile.bmc-dashboard` (stack completo: Express sirve `/api` + SPA `/calculadora` + `/finanzas`) · imagen **`gcr.io/$PROJECT_ID/panelin-calc`** (GCR legacy, no Artifact Registry)
- `scripts/deploy-cloud-run.sh` lo dispara manualmente.

### Modelo C — Cloud Build auxiliares
- `cloudbuild-api.yaml` → mismo destino que Modelo A pero vía Cloud Build (no GH Actions).
- `cloudbuild-frontend.yaml` → mismo destino que Modelo A pero vía Cloud Build (no GH Actions).

**Conflicto concreto:**
- El Modelo A sube a **Artifact Registry** (`us-central1-docker.pkg.dev/chatbot-bmc-live/cloud-run-repo/`).
- El Modelo B sube a **GCR** (`gcr.io/$PROJECT_ID/`) — registry **antiguo**, ya deprecated por Google.
- Ambos modelos llaman al servicio **`panelin-calc`** en la misma región, lo cual significa que la imagen activa depende de quién hizo el último deploy.
- Desde este entorno no puedo llamar `gcloud run services describe panelin-calc` para verificar cuál imagen está sirviendo tráfico ahora.

**Impacto:** rollback y hotfix tienen flujo diferente según modelo. La URL `panelin-calc-642127786762.us-central1.run.app` puede estar sirviendo API-only (Modelo A) o full-stack (Modelo B), sin que el repo indique cuál.

---

## 2. [CRÍTICO] Directorio `docs 2/` duplica `docs/`

`docs 2/` (con espacio) existe en la raíz con un subconjunto de docs:
- `docs 2/ARCHITECTURE.md`, `CALC-PARED.md`, `CALC-TECHO.md`, `DEPLOYMENT.md`, `ML-OAUTH-SETUP.md`, `PRICING-ENGINE.md`, `SCENARIOS.md`, `UI-COMPONENTS.md`, `AGENTS.md`, `ARCHITECTURE.md`, `GOOGLE_DRIVE_SETUP_PROMPT.md`, `UPDATE-REPORT-v3.1.0.md`, `CHANGELOG.md`, `openapi-calc.yaml`, `API-REFERENCE.md`
- `docs 2/bmc-dashboard-modernization/` (con al menos `Code.gs` y `IMPLEMENTATION.md`)

Mismos nombres que en `docs/` pero versionado separado. `.gitignore` no los ignora → están trackeados.

**Riesgo:** un agente puede editar `docs/ARCHITECTURE.md` y el otro `docs 2/ARCHITECTURE.md`, perdiendo sincronía silenciosamente.

**Recomendación para dueño (no ejecutada):** decidir una carpeta master y eliminar la otra (o rename a `archive/`).

---

## 3. [MEDIO] `docs.zip` en raíz (133 KB)

Archivo ZIP con snapshot de `docs/`. Trackeado en git, comprimido en modo `method=store` (no real compression). Refleja un estado anterior de la carpeta. Misma familia de problema que #2.

---

## 4. [MEDIO] Dos estrategias paralelas para precios en runtime

- **Camino A:** Frontend lee `src/data/constants.js` hardcodeado; `src/utils/pricingOverrides.js` aplica overrides runtime via `PricingEditor.jsx`.
- **Camino B:** Backend endpoint `GET /api/actualizar-precios-calculadora` descarga CSV desde Sheet MATRIZ (`1oDMkBgWx...`), pasa por `src/data/matrizPreciosMapping.js` (SKU→path) y se importa con `csvPricingImport.js`.

**Problema:** ambos caminos pueden estar aplicando precios diferentes al mismo SKU. La sincronización es manual. Docs en `MATRIZ-PRECIOS-CALCULADORA.md` y `PRICING-ENGINE.md` describen pedazos distintos del flujo.

---

## 5. [MEDIO] Inconsistencia nombre tab Pagos Pendientes

- Código API (`bmcDashboard.js`) usa `getFirstSheetName()` para detectar el tab real, que según `planilla-inventory.md` es **`Pendientes_`** (con guión bajo final).
- Docs legacy (varios `.md` en `docs/team/`) y algunos scripts (`setup-sheets-tabs.js`) todavía mencionan **`Pagos_Pendientes`** como nombre de tab.
- Esto ya fue resuelto en código (detección dinámica), pero docs no se actualizaron consistentemente.

---

## 6. [MEDIO] Columna "MONTO" vs D/E en tab Pendientes_

Documentado en `planilla-inventory.md` (nota 2026-03-27): existe ambigüedad sobre qué columna usar para KPIs de saldo:
- **MONTO** = referencia operativa oficial.
- **PRECIO_VENTA (col D)** e **COSTO_COMPRA (col E)** = contexto, no reemplazan a MONTO.

Riesgo de drift si algún agente (humano o IA) escribe código nuevo leyendo de D/E sin conocer la convención.

---

## 7. [BAJO] Carpetas anidadas mencionadas en `.gitignore` como "creadas por accidente"

`.gitignore` lista explícitamente:
```
# Nested copies / other projects accidentally created inside this repo (never commit)
Calculadora-BMC/
OmniCRM-Sync/
```
Esto sugiere que clones/copias aparecieron dentro del propio repo en sesiones pasadas. No están trackeadas (gitignore funciona), pero su existencia como gap en el pensamiento del equipo queda registrada.

---

## 8. [BAJO] Múltiples repos GPT/chatbot referenciados sin estado conocido

Al menos 13 repos en `matiasportugau-ui` aparecen referenciados en docs y env.example:
```
2026_Mono_rep
Calculadora-BMC
Calculadora-BMC-GPT
ChatBOT
Chatbot-Truth-base--Creation
GPT-PANELIN-V3.2
GPT-Panelin-Calc
aistudioPAnelin
bmc-cotizacion-inteligente
bmc-dashboard-2.0
bmc-development-team
chatbot-2311
conexion-cuentas-email-agentes-bmc
```

Desde este entorno (MCP scope = solo `calculadora-bmc`) **no puedo verificar**:
- Cuáles están activos / archivados.
- Cuáles comparten código con `calculadora-bmc`.
- Cuáles están efectivamente deployados a algún lado.

**Riesgo potencial:** forks viejos con credenciales commiteadas, pipelines muertos drenando CI quota, etc. Esto es **duda abierta**.

---

## 9. [BAJO] API stubs duplicados

- `api/cotizar.js` (Vercel serverless, CommonJS-style con `export default handler`)
- `app/api/chat/route.ts` (Next.js App Router, TypeScript)

Ambos son stubs que no se usan en producción (producción = Cloud Run `panelin-calc`). Pueden inducir a pensar que el repo también corre como app Vercel full-stack, cuando sólo Vite SPA + API serverless lo hace.

---

## 10. [BAJO] 84 ramas abiertas + 20 PRs + 15 drafts

Volumen alto de deuda de integración. PR #89 (`integration/2026-04-22`) es un draft de "release" que intenta juntar #76 + #83 → indica que el proceso de consolidación está activo pero inconcluso.

Múltiples ramas con el mismo propósito aparente (ej. 6 ramas `cursor/ceo-ai-agent-*`, 5 ramas `cursor/chat-de-equipo-interactivo-*`, 4 ramas `copilot/sub-pr-3-*`) sugieren experimentación sin limpieza.

---

## 11. [INFO] Credenciales expuestas (ubicación, sin valores)

Búsqueda completa en el árbol git-tracked:

| Patrón buscado | Resultado |
|---|---|
| `sk-[a-zA-Z0-9]{30,}` (OpenAI API keys) | **0 matches** |
| `sk-ant-[a-zA-Z0-9-]{30,}` (Anthropic keys) | **0 matches** |
| `AIza[0-9A-Za-z_-]{30,}` (Google API keys) | **0 matches** |
| `BEGIN .*PRIVATE KEY` | **0 matches** |
| `Bearer [A-Za-z0-9_\-\.]{20,}` | **0 matches** |
| `password\s*[:=]\s*["'][a-zA-Z0-9!@#$%^&*]{6,}` (hardcoded) | **0 matches** |
| `token\s*[:=]\s*["'][a-zA-Z0-9_\-\.]{20,}` (hardcoded) | **0 matches** |
| `mywolfy` (password histórica del contexto) | 1 match → `docs/team/CALCULATE-QUOTE-DIAGNOSTIC.md:249` — **línea dice explícitamente "sin resultados. No hay password hardcodeada"**. No hay exposición. |
| Archivos `service-account*.json` | 0 matches (correctamente en `.gitignore`) |
| Archivos `*credentials*.json` | 0 matches |

**Detalles completos:** `.relevamiento/matriz/credenciales-sospechas.txt` y `credenciales-detalle.txt`.

**Conclusión credenciales:** ninguna clave real expuesta en el código trackeado. Todas las menciones de `API_KEY`, `API_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, etc. son **lecturas de `process.env.*`**, no valores literales. Esto es posture correcta.

**Único gap residual:** no puedo examinar `.env` (presente, en `.gitignore`) — no lo voy a abrir, no lo voy a commitear, por regla.

---

## 12. [INFO] Endpoints deployados sin repo vivo / Repos vivos sin deploy

Desde este entorno **no puedo confirmar** qué endpoints están realmente corriendo en Cloud Run ni qué repos tienen deploy activo. Todos los ítems en esta categoría quedan como **duda abierta** hasta que se pueda correr `gcloud run services list` o similar.

Lo que sí puedo decir basado en el repo:
- **Workflows de deploy existen para:** `panelin-calc` y `panelin-calc-web` (Cloud Run) + Vercel.
- **Webhooks definidos en código:** `/webhooks/ml`, `/webhooks/whatsapp`, `/webhooks/shopify`. El shopify usa `shopify.app.toml` + Prisma dentro de `shop-chat-agent/`, que tiene Dockerfile propio → podría ser un servicio **separado** no cubierto por los workflows `deploy-*.yml`.

---

## 13. [INFO] Apps Script (.gs) sin pipeline de deploy automatizado

5 archivos `.gs` en `docs/bmc-dashboard-modernization/`:
- `Code.gs`, `CalendarioRecordatorio.gs`, `PagosPendientes.gs`, `StockAlertas.gs`, `VentasConsolidar.gs`

Estos se despliegan **manualmente** al proyecto Apps Script bound a cada workbook. No hay `.github/workflows/deploy-gs.yml`. No puedo verificar si la versión del Apps Script activo en Google Workspace coincide con la del repo.
