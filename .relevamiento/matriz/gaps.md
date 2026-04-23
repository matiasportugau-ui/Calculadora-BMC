# GAPS DE RELEVAMIENTO

Fecha: 2026-04-23
Entorno: Claude Code en contenedor remoto (session)

## Herramientas NO disponibles

| Herramienta | Estado | Impacto |
|---|---|---|
| `gh` CLI | NO instalado | No se puede listar `gh repo list matiasportugau-ui` ni bajar metadata arbitraria de repos. Solo acceso vía **GitHub MCP**, y este está **restringido al repo `matiasportugau-ui/calculadora-bmc`** (ver system prompt: "Repository Scope"). |
| `gcloud` CLI | NO instalado | No hay acceso CLI a Cloud Run, Scheduler, Secret Manager, IAM de `chatbot-bmc-live`. Imposible confirmar revisiones actuales, env vars, URLs o jobs. |
| `gspread` (Python) | NO instalado | No se puede listar ni leer Sheets. |
| `google-api-python-client` | NO instalado | No se puede listar Drive ni leer metadata de Sheets/Docs. |
| ADC (`application_default_credentials.json`) | NO existe | Sin credenciales, ni siquiera instalando las libs se podría acceder a Drive/Sheets desde este entorno. |

## Herramientas disponibles

| Herramienta | Versión |
|---|---|
| `git` | 2.43.0 |
| `rg` (ripgrep) | 14.1.0 |
| `jq` | 1.7 |
| `python3` | 3.11.15 |
| `node`/`npm` | (según repo; .nvmrc no verificado aún) |
| GitHub MCP (scope: `matiasportugau-ui/calculadora-bmc` **únicamente**) | vía `mcp__github__*` |
| Acceso a árbol de archivos local `/home/user/Calculadora-BMC` | sí (branch `claude/bmc-production-audit-3Pjos`) |

## Consecuencias sobre el alcance

1. **GitHub:** solo puedo relevar el repo `calculadora-bmc` (vía MCP + checkout local). No puedo confirmar el estado de:
   - `matiasportugau-ui/GPT-Panelin-Calc`
   - Cualquier otro repo del usuario.
   - Dependerá de qué referencias aparezcan en el código y docs del repo local.

2. **GCP (project `chatbot-bmc-live`):** todo el dominio "Cloud Run / deploys / secrets / scheduler" queda como **duda abierta**. Lo único inferible viene de los archivos de deploy dentro del repo (`cloudbuild.yaml`, `Dockerfile`, workflows de `.github/`, scripts en `scripts/`, `docs/procedimientos/*`).

3. **Drive / Sheets / Docs:** no puedo enumerar ni abrir ningún Sheet o Doc. Todo lo que aparezca de referencias a Sheets (ej. `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA`) queda **sin verificación de existencia/pestañas/contenido**. Lo marcaré como referencia-en-código con `duda abierta` sobre el estado actual del Sheet.

4. **Cloud Run URLs y revisiones:** no puedo confirmar `https://panelin-api-642127786762.us-central1.run.app` ni la última revisión. Se tomará lo que figure en código/docs del repo como `inferencia` a verificar fuera de este entorno.

5. **Credenciales expuestas:** la búsqueda se limita al repo local (`/home/user/Calculadora-BMC` + `dumps/` que se generen de él). No puedo buscar en otros repos del org.

## Lo que sí se va a entregar

- Matriz (Parte 1) cubriendo los 8 dominios, marcando claramente `hecho confirmado` / `inferencia` / `duda abierta`.
- Inventario crudo (Parte 2) basado en:
  - Arbol de archivos de `calculadora-bmc` (local).
  - Metadata del repo vía GitHub MCP.
  - Referencias a Sheets/Cloud Run/otros sistemas extraídas con `rg` del código y docs.
- Conflictos (Parte 3): duplicados, fuentes referenciadas que no existen en el repo, credenciales expuestas si las hay.
- Preguntas (Parte 4) al dueño (Matías) para cerrar las dudas abiertas más críticas.
- Resumen (Parte 5).

## Lo que NO se va a entregar (por falta de acceso)

- Confirmación en vivo de estado de Cloud Run services.
- Confirmación en vivo de Sheets y sus pestañas.
- Listado de otros repos del usuario `matiasportugau-ui`.
- Listado de secretos en Secret Manager.
- Confirmación de rama activa de otros repos (solo `calculadora-bmc`).
