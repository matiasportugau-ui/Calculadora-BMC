# Guía de estudio — desarrollo y liderazgo técnico (tema por tema)

**Propósito:** Plan autónomo para estudiar **documentación oficial**, **buenas prácticas** y **tendencias relevantes** (sin perseguir hype en cada capítulo), desde **definición del producto** hasta **operación en producción**. Pensado para quien lidera o construye en stacks como el de Calculadora BMC (React + Vite, Express, extensiones Chrome MV3, Cloud Run, integraciones).

**Cómo usarla:** Elegí un bloque (A–H). Por sesión: **~2 h** = (1) leer la sección canónica enlazada, (2) aplicar **un** ítem de la checklist a un archivo real o un ADR de una línea. Repetí en ciclos; no hace falta terminar un “curso” antes de construir.

---

## Mapa por materia

Cada fila: **Documentación** (fuente de verdad) → **Práctica** (hábito repetible) → **Tendencia** (priorizar solo si cambia tu default) → **Ancla en este repo** (opcional: dónde ver el patrón).

| ID | Materia | Documentación (empezar por acá) | Práctica | Tendencia / nota | Ancla BMC (ejemplos) |
|----|---------|----------------------------------|----------|------------------|----------------------|
| **A** | Producto y alcance | Jobs-to-be-done / problem framing (cualquier guía corta de descubrimiento); plantillas de one-pager (scope, no-goals, métricas). | Un one-pager por iniciativa: alcance, restricciones, “fuera de alcance”, criterio de éxito. | Slices verticales + flags; definir NFR (latencia, offline, compliance) **antes** del último sprint. | `docs/team/PROJECT-STATE.md`, `programs/bmc-panelin-master.json` |
| **B** | Frontend (SPA) | [React](https://react.dev/) (sitio actual), [Vite](https://vite.dev/guide/), [MDN](https://developer.mozilla.org/) (`postMessage`, `MessageEvent`, same-origin). | Límites de componentes, accesibilidad básica, estado predecible; evitar “god components”. | Framework meta: útil para SEO masivo; para hub interno, **estabilidad y bundle** suelen importar más. | `src/`, `AGENTS.md` (gate `lint` / `build`) |
| **C** | Backend y APIs | [Express](https://expressjs.com/) (versión del repo), guías Node HTTP; si exponés contrato: OpenAPI. | Logging estructurado, timeouts, errores con forma consistente; CORS **explícito** en prod. | Contratos tipados (Zod/OpenAPI) en el borde público; health vs readiness diferenciados. | `server/index.js`, `server/routes/` |
| **D** | Extensiones (MV3) | [Chrome Extensions — Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/), messaging, service worker lifecycle. | Permisos mínimos (`matches` / `host_permissions`); mensajes async con `sendResponse` correcto; manejar **context invalidated**. | MV3 sigue endureciendo políticas — releer changelog del store y deprecations. | Repo hermano `calculadora-bmc-wa-extension`, `scripts/wa-extension-load.sh`, `docs/wa-cockpit/` |
| **E** | Seguridad | [OWASP Top 10](https://owasp.org/www-project-top-ten/), [API Security Top 10](https://owasp.org/www-project-api-security/); CSP en MDN. | Allowlist de orígenes (incl. `chrome-extension://` por ID si aplica); modelo de amenaza para same-origin XSS + tokens. | Tokens cortos, vaults/env, menor privilegio en SA; revisar periodicamente superficies nuevas (`postMessage`). | `.cursor/skills/bmc-security-reviewer/`, gates humanos (`docs/team/HUMAN-GATES-ONE-BY-ONE.md`) |
| **F** | Datos e integraciones | Docs del driver (`pg`), APIs que uses (Sheets/GCP según hub del repo). | Migraciones versionadas; idempotencia en webhooks/ingest; reintentos con backoff. | Event-driven donde la escala lo exija; antes: **simplicidad medible**. | `docs/google-sheets-module/README.md`, workers bajo `server/lib/` |
| **G** | Observabilidad y operación | Guías del proveedor de hosting (Cloud Run logging); introducción SRE (four golden signals). | Logs correlacionables (request id), dashboards mínimos, runbooks para 503 Sheets / OAuth / disco lleno. | SLO y error budget en lugar solo de “más métricas”. | `npm run smoke:prod`, `docs/procedimientos/`, `.cursor/rules/disk-space-recovery.mdc` |
| **H** | Liderazgo técnico | Plantillas ADR / RFC cortas (1 página); CODEOWNERS; Definition of Done con gates. | Riesgos explícitos (Chrome stable vs Beta, disco, gates cm-0…2); automatizar lo repetible (`gate:local`, CI). | Equipos async: menos docs largos, más **decision records** y comandos reproducibles. | `.github/CODEOWNERS`, `AGENTS.md`, `PROJECT-TEAM-FULL-COVERAGE.md` |

---

## Progresión sugerida: de la idea a producción estable

No es waterfall estricto; es **órden de prioridades** cuando el tiempo es finito.

1. **Semanas iniciales (creación)**  
   A (alcance + NFR) → bosquejo de modelo de amenazas mínimo (E) → C (primer API + CORS/logging consciente) → D si hay extensión (permisos mínimos).

2. **Núcleo de producto**  
   B + C en iteraciones verticales; contrato API donde haya cliente externo (GPT/MCP/extension).

3. **Maduración (“late dev”)**  
   E endurecido (allowlists), G (runbooks + smoke automatizado), F (integraciones resilientes).

4. **Mantenimiento**  
   Revisiones cortas trimestrales: OWASP aplicado a rutas nuevas, extension MV3 changelog, revisión de CORS/orígenes.

---

## Ritmo de estudio (plantilla por bloque)

Usá esta plantilla cada vez que abras un tema:

| Paso | Tiempo | Acción |
|------|--------|--------|
| 1 | 45–60 min | Leer solo la parte del manual que responde a **una pregunta concreta** (ej.: “¿Cómo debe responder sendMessage cuando el SW se reinicia?”). |
| 2 | 30–45 min | **Una aplicación:** parche menor, checklist en PR, o nota ADR (“Decidimos X porque Y; alternativa rechazada: Z”). |
| 3 | 15 min | Anotar **siguiente duda** en `SESSION-WORKSPACE-CRM.md` o follow-up local. |

---

## Lecturas cruzadas con el ejemplo “WA Cockpit ↔ SPA”

Si estudiás D + E juntos (recomendado una vez):

- **Aislamiento:** content script isolated vs página; solo confiar mensajes validados (`origin` / `source`).
- **CORS:** diferencia entre SPA same-origin al API vs `fetch` desde service worker con `chrome-extension://`.
- **Resiliencia:** “Extension context invalidated” → UX de recuperación (recargar pestaña) y guards en código.
- **Automatización:** script que elige navegador compatible con `--load-extension` (`scripts/wa-extension-load.sh`).

---

## Comandos del repo útiles como “parcial de estudio”

| Objetivo de estudio | Comando / doc |
|---------------------|-----------------|
| Calidad antes de merge | `npm run gate:local` / `npm run gate:local:full` — ver tabla en raíz `AGENTS.md` |
| Contrato vs UI rota | `npm run test:contracts` (API arriba) |
| Producción rápido | `npm run smoke:prod` |
| Salud proyecto | skill `bmc-holistic-project-health`; `PROJECT-STATE.md` |
| WhatsApp cockpit | Hub `docs/wa-cockpit/README.md` |

---

## Mantenimiento del documento

Quién cierre una fase de estudio o detecte docs rotas: PR pequeño actualizando **solo** enlaces o la columna “Ancla BMC”. No duplicar aquí contenido ya canónico en `google-sheets-module` ni en procedimientos de deploy.

---

**Versión:** 1.0 (2026-05-07)  
**Relacionado:** [orientation/README.md](./README.md), [EXPERT-DEV-TRACEABILITY.md](./EXPERT-DEV-TRACEABILITY.md), raíz [`AGENTS.md`](../../../AGENTS.md).
