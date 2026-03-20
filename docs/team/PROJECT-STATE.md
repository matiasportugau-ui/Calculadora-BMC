# Project State — BMC/Panelin

**Última actualización:** 2026-03-20 (Run 23 fusión Judge/MATPROMT; plan soluciones Pista 1 Git vigente)

Fuente única de estado para que todos los agentes estén actualizados. Ver [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) para el protocolo de sincronización.

**Evolución:** Roles, skills, áreas y variables no son estáticos; se ajustan tras modificaciones o crecimiento del dominio. Ver PROJECT-TEAM-FULL-COVERAGE §0.

---

## Cambios recientes

> Historial completo: [CAMBIOS-RECIENTES-ARCHIVE.md](./CAMBIOS-RECIENTES-ARCHIVE.md)

**2026-03-20 (Run 23 fusión — Judge + MATPROMT + Parallel/Serial unificados):** Cierre explícito **run 22 (documental)** + **Presupuesto libre V3** bajo un solo **run 23**. **Judge:** [judge/JUDGE-REPORT-RUN-2026-03-20-run23.md](./judge/JUDGE-REPORT-RUN-2026-03-20-run23.md). **MATPROMT:** [matprompt/MATPROMT-RUN-2026-03-20-run23.md](./matprompt/MATPROMT-RUN-2026-03-20-run23.md). **Parallel/Serial:** [parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run23.md](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run23.md). **Guía:** sección «Bundle — RUN 2026-03-20 / run23» en [MATPROMT-FULL-RUN-PROMPTS.md](./MATPROMT-FULL-RUN-PROMPTS.md). [PROMPT-FOR-EQUIPO-COMPLETO.md](./PROMPT-FOR-EQUIPO-COMPLETO.md) actualizado con bloque fusión. [JUDGE-REPORT-HISTORICO.md](./judge/JUDGE-REPORT-HISTORICO.md) — línea promedio global run23 ~4.7/5.

**2026-03-20 (Plan por solución — avance uno por uno):** Documento [plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md](./plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md): **8 pistas** (Git baseline → smoke prod → Sheets tabs/triggers → npm audit --force → MATRIZ SKUs → billing → Repo Sync → OAuth condicional), cada una con pasos y criterio de hecho. **En curso:** Pista **1** — línea base Git. Siguientes pistas bloqueadas hasta cerrar la anterior o documentar bloqueo.

**2026-03-20 (Run 23 — plan + next steps ejecutables):** Plan [plans/NEXT-STEPS-RUN-23-2026-03-20.md](./plans/NEXT-STEPS-RUN-23-2026-03-20.md). **CI local:** `npm run lint` — 0 errores, 10 warnings; `npm test` — **115 passed**. `npm audit fix` **sin --force** — 4 packages actualizados en lockfile; **7 vulnerabilidades restantes** (5 low, 2 moderate); cierre completo requiere `npm audit fix --force` (aprobación Matias). **Docs:** [E2E-VALIDATION-CHECKLIST.md](./E2E-VALIDATION-CHECKLIST.md) — tabla URLs Cloud Run / Vercel. [PROMPT-FOR-EQUIPO-COMPLETO.md](./PROMPT-FOR-EQUIPO-COMPLETO.md) — run 23 marcado ejecutado. **Siguiente:** revisar/commit `package-lock.json`; E2E manual; tabs/triggers; Repo Sync push.

**2026-03-20 (Implementación calculadora — Presupuesto libre acordeones en V3):** Completado el cableado UI del escenario **Presupuesto libre** en `PanelinCalculadoraV3.jsx`: estado (`librePanelLines`, cantidades por catálogo, Extraordinarios), `results` vía `calcPresupuestoLibre`, `groups` desde `libreGroups` sin duplicar flete; acordeones Paneles / Perfilería (filtro) / Tornillería y herrajes (`FIJACIONES` + `HERRAMIENTAS`) / Selladores / Servicios (flete) / Extraordinarios (campos opcionales); PDF/WhatsApp con escenario «Presupuesto libre». Reporte: [reports/REPORT-SOLUTION-CODING-2026-03-20-full-team-implement.md](./reports/REPORT-SOLUTION-CODING-2026-03-20-full-team-implement.md). `npm test` **115 passed**. Pendiente opcional: acotar tornillería a `PRESUPUESTO_LIBRE_IDS`; portar a `PanelinCalculadoraV3_backup` si aplica.

**2026-03-20 (Full team run 22 — Invoque full team: propagate & synchronize):** Orquestador ejecutó run **0→9** con foco **propagación §4** y checklist **Repo Sync**. **Paso 0:** PROJECT-STATE, PROMPT, BACKLOG; §2.2 transversales (ai-interactive-team, bmc-project-team-sync aplicables; chat-equipo N/A). **0a MATPROMT:** [matprompt/MATPROMT-RUN-PROPAGATE-SYNC-2026-03-20.md](./matprompt/MATPROMT-RUN-PROPAGATE-SYNC-2026-03-20.md). **0b:** [parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run22.md](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run22.md) (serie documental). **1–8:** Mapping/Dependencies/Contract/Networks/Design/Integrations/Reporter/Security/GPT/Fiscal/Billing/Audit/Calc — **estado vigente**; `service-map.md` fecha run22; sin cambios de código app en esta corrida. **Reporter:** [reports/REPORT-SOLUTION-CODING-2026-03-20-run22.md](./reports/REPORT-SOLUTION-CODING-2026-03-20-run22.md). **Repo Sync:** [reports/REPO-SYNC-REPORT-2026-03-20-run22.md](./reports/REPO-SYNC-REPORT-2026-03-20-run22.md) (push remoto **pendiente verificación** Matias). **Judge:** [judge/JUDGE-REPORT-RUN-2026-03-20-run22.md](./judge/JUDGE-REPORT-RUN-2026-03-20-run22.md); `JUDGE-REPORT-HISTORICO.md` actualizado (~4.5/5 run22). **Paso 9:** PROMPT «Próximos prompts» y agenda actualizados; `IMPROVEMENT-BACKLOG-BY-AGENT.md` — fila **MATPROMT** + criterio N=§2. **Knowledge:** nuevo [knowledge/MATPROMT.md](./knowledge/MATPROMT.md); índice [knowledge/README.md](./knowledge/README.md). **Propagación:** roles que deben leer [interactions/TEAM-INTERACTION-QUANTUM-DOC-2026-03-20.md](./interactions/TEAM-INTERACTION-QUANTUM-DOC-2026-03-20.md) §5 — según REPORT run22 §Propagación.

**2026-03-20 (Interacción equipo — análisis «Quantum Evolution Path v∞»):** Documentada instancia de cross-learn sin implementación de stack cuántico: [interactions/TEAM-INTERACTION-QUANTUM-DOC-2026-03-20.md](./interactions/TEAM-INTERACTION-QUANTUM-DOC-2026-03-20.md). Contiene lectura crítica (Phase 0 alineada; Phases 1–3 metáfora/no trazada al repo), tabla de takeaway/skepticism/borrow por **todos los roles §2**, diálogo Parallel/Serial↔Judge y Security↔Networks, síntesis Orchestrator+MATPROMT, cierre Judge (disciplina epistémica), propagación §4. **Afecta a:** Orquestador, MATPROMT, Judge, Parallel/Serial, Fiscal, Contract, Audit/Debug, Reporter, Dependencies, Repo Sync; resto §2 lectura opcional §1 del archivo.

**2026-03-20 (V3 — flete BOM escenarios normales):** En `PanelinCalculadoraV3.jsx`, línea de servicio **FLETE** usa el importe del stepper (`flete`), no `p(SERVICIOS.flete)`, alineado a BUG-01 / presupuesto libre. `bomToGroups` local incluye rama `presupuestoLibre`; si `libreGroups` viniera vacío, se recurre a `bomToGroups(results)` vía `allItems`.

**2026-03-20 (Sync sistema ~100% — fijaciones unitarias + presupuesto libre en helpers):** Cerrada la deriva entre `constants.js` y motor/UI: `calculations.js` — aguja/T1/T2/remache en **unidades** (sin ×100/×1000); nuevo `calcPresupuestoLibre(lineas)` con `presupuestoLibre: true`. `helpers.js` `bomToGroups`: si `presupuestoLibre && allItems`, grupo **PRESUPUESTO LIBRE**. `PanelinCalculadoraV3.jsx` importa `FIJACIONES`/`HERRAMIENTAS` desde `constants.js` y replica fórmulas; presupuesto libre en líneas manuales puede sumar herrajes. `matrizPreciosMapping.js`: SKUs placeholder (ANC*, T1/T2, REMPOP*, APLDX03, etc.) — **confirmar col.D en MATRIZ**. Tests: `validation.js` **115 passed** (+ presupuesto libre). Plan: `IMPLEMENTATION-PLAN-SYSTEM-SYNC-100-2026-03-19.md` fases A/C/E parcialmente D (SKU a validar).

**2026-03-19–20 (Vista previa del techo — implementado en calculadora):** Nuevo `src/components/RoofPreview.jsx`: rejilla por `panel.au`, arrastre de zonas (metros en planta) con `techo.zonas[].preview.x/y`, doble clic / doble toque para ciclar `slopeMark` visual (`off` → `along_largo_pos` → `along_largo_neg`). Botón «Alinear zonas» limpia posiciones y conserva pendiente visual si estaba activa. Integrado en `PanelinCalculadoraV3_backup.jsx` (App canónica). Tests: `validation.js` suite 19 (deserialize `preview`). `npm run lint` (0 errors), `npm test` 113 passed. Plan de equipo: `docs/team/IMPLEMENTATION-PLAN-VISTA-PREVIA-TECHO.md` (Fase 4 RoofBorderSelector compartida sigue opcional).

**2026-03-19 (Full team prompt — sync review + plan 100%):** Generados `docs/team/matprompt/MATPROMT-RUN-SYNC-REVIEW-2026-03-19.md` (bundle §2 + tabla deriva) y `docs/team/IMPLEMENTATION-PLAN-SYSTEM-SYNC-100-2026-03-19.md` (fases A–G, checklist). ~~Deriva motor/UI vs constants~~ → **cerrada 2026-03-20** (ver entrada arriba). Pendiente: validar SKUs MATRIZ col.D y UI completa catálogo `PRESUPUESTO_LIBRE_IDS` en app canónica (`PanelinCalculadoraV3_backup` si aplica).

**2026-03-19 (Precios planilla Mar 2022 — captura usuario):** Actualizados en `constants.js` + datos inline `PanelinCalculadoraV3.jsx` (÷1,22 desde columnas con IVA): **Silicona Neutra Premium Silva Selantes** → `silicona_300_neutra`; **membrana**; **PU gris** → `espuma_pu`; **Tornillo T1** y **punta aguja Type 14×5** (`tornillo_aguja`). T1/aguja interpretados como **precio por unidad ×100** para paquete `x100`. Segunda fila membrana (solo Venta 30) no mapeada. `npm test` OK.

**2026-03-19 (Full team run 21 — MATPROMT 0a + implementación calculadora fachada):** Bundle run21 en `docs/team/MATPROMT-FULL-RUN-PROMPTS.md`. PLAN `parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run21.md`. REPORT `reports/REPORT-SOLUTION-CODING-2026-03-19-run21.md`, Judge `judge/JUDGE-REPORT-RUN-2026-03-19-run21.md`. **Código:** `FIJACIONES.tornillo_t2` con `unidades_por_paquete`; BOM T2 en **unidades** (PU paquete÷100). **Selladores pared:** cinta butilo **opcional** (`inclCintaButilo`, default false); **silicona 300 ml neutra** opcional (`SELLADORES.silicona_300_neutra`, `inclSilicona300Neutra`); `calcSelladorPared(..., opts)`. UI toggles en `PanelinCalculadoraV3.jsx`; sync datos inline. `matrizPreciosMapping`: `SIL300N`. `projectFile.js` defaults. Tests `validation.js`: **111 passed**. Pendientes sin cambio: tabs/triggers, E2E, npm audit --force, billing, Repo Sync externo; validar precios reales silicona 300 en MATRIZ.

**2026-03-19 (Alta rol MATPROMT — prompts por full team run):** Nuevo miembro **§2: MATPROMT** con skill `matprompt` (`.cursor/skills/matprompt/SKILL.md`, agente `.cursor/agents/matprompt-agent.md`). En cada **Invoque full team** el Orquestador ejecuta **paso 0a**: bundle de prompts orientadores por rol + **DELTA** ante tareas nuevas durante el run. Integrado en `PROJECT-TEAM-FULL-COVERAGE.md` §2, `bmc-dashboard-team-orchestrator.md` (orden 0→0a→0b→…), `INVOQUE-FULL-TEAM.md`, `PROMPT-FOR-EQUIPO-COMPLETO.md`, `bmc-project-team-sync` skill. Guía `docs/team/MATPROMT-FULL-RUN-PROMPTS.md`. Criterios Judge: `JUDGE-CRITERIA-POR-AGENTE.md` sección MATPROMT. **N** en §2.1 incrementado en 1 fila.

**2026-03-19 (Full team run 20 — Invoque full team):** Orquestador ejecutó run 0→9 (síntesis). Paso 0: PROJECT-STATE, PROMPT, BACKLOG; §2.2 transversales consideradas. Paso 0b: `parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run20.md` (serie). Pasos 1–8: Mapping/Dependencies/Contract/Networks/Design/Integrations/Reporter/Security/GPT/Fiscal/Billing/Audit/Calc — **estado vigente**; sin cambios de código nuevos en esta corrida. Artefactos: `reports/REPORT-SOLUTION-CODING-2026-03-19-run20.md`, `judge/JUDGE-REPORT-RUN-2026-03-19-run20.md` (promedio ~4.9/5). Refuerzo: OAuth producción Vercel (`https://calculadora-bmc.vercel.app` en orígenes JS del cliente OAuth). Pendientes sin cambio: tabs/triggers manual, E2E Cloud Run, npm audit --force, billing, Repo Sync externo. Paso 9: PROMPT "Próximos prompts" actualizado para run 21.

**2026-03-19 (Protocolo equipo — N dinámico, sin olvidar agentes nuevos):** `PROJECT-TEAM-FULL-COVERAGE.md` ahora define §2.1 (N = filas §2), §2.2 (skills transversales obligatorias a considerar en paso 0: ai-interactive-team, chat-equipo cuando exista, bmc-project-team-sync), §2.3 (checklist obligatoria al dar de alta un rol). `INVOQUE-FULL-TEAM.md`, rule `bmc-project-team-sync`, skill sync, `AGENTS.md` raíz y Orquestador actualizados para no hardcodear “19” y anexar automáticamente todo rol nuevo en §2 al comando “Invoque full team”.

**2026-03-19 (Full team sync + análisis log Calculadora):** Sesión `http://localhost:5174/` analizada (interaction log). Flujo: **solo_techo**, lista **venta**, panel **ISODEC_EPS 100mm Blanco**, **una agua**, zona **6 × 7.84 m** (`techoAnchoModo: paneles`), **pendienteModo incluye_pendiente**, **tipoEst hormigón**, bordes frente **canalón**, fondo **babeta_empotrar**, laterales **gotero_lateral**, **inclSell false** (sin selladores en cotización), **flete 430 USD**, **grandTotal ~3400.49**, **4 grupos** BOM, categorías todas activas. Proyecto: cliente Matias, tel/dirección cargados. Sin cambio de código solicitado; el log muestra muchos eventos intermedios por steppers (largo/ancho). Equipo: estado vigente (deploy Cloud Run + Vercel); pendientes sin cambio (tabs/triggers, E2E, audit).

**2026-03-19 (Deploy post-design + full team):** Cloud Run panelin-calc-00015-74l y Vercel producción desplegados con mejoras de diseño (ConfigPanel, PricingEditor, DimensioningFormulasEditor, wizard steps, tabla resultados). URLs: Cloud Run https://panelin-calc-642127786762.us-central1.run.app; Vercel https://calculadora-bmc.vercel.app.

**2026-03-19 (Calculadora UI/UX — diseño mejorado):** Mejoras de diseño en componentes de la Calculadora: (1) ConfigPanel — tabs con contenedor, espaciado y jerarquía visual; uso de C y FONT desde constants; (2) PricingEditor — encabezados de tabla con C.brand, hover en filas, agrupación de botones (MATRIZ | Descargar/Importar); (3) DimensioningFormulasEditor — estilos alineados con PricingEditor (tabla, hover, botones); (4) PanelinCalculadoraV3_backup — indicadores de paso en wizard (dots), card styling en secciones, tabla de resultados con encabezados C.brand y hover en filas (Costo/Margen/Ganancia). Lint y tests/validation.js OK.

**2026-03-19 (Full team run 19 — Invoque full team, sync updates):** Orquestador ejecutó full team run 0→9. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-19-run19.md. Pasos 1–8: Mapping actualizado (DASHBOARD-INTERFACE-MAP costos editables, fórmulas dimensionamiento; planilla-inventory MATRIZ costo); Dependencies/service-map con ConfigPanel, DimensioningFormulasEditor; Contract 4/4 PASS (runtime); Reporter REPORT-SOLUTION-CODING-2026-03-19-run19.md; Judge JUDGE-REPORT-RUN-2026-03-19-run19.md (promedio 4.96/5); Repo Sync REPO-SYNC-REPORT-2026-03-19-run19.md. Paso 9: PROMPT "Próximos prompts" actualizado. Cambios sincronizados: Calculadora design, costos editables (PricingEditor), fórmulas dimensionamiento download/upload (DimensioningFormulasEditor), MATRIZ costo column. Deploy ya completado (Cloud Run + Vercel). Pendientes: tabs/triggers, E2E, npm audit fix, billing cierre.

**2026-03-19 (Full team run 18 — Invoque full team, deploy completado):** Orquestador ejecutó full team run 0→9. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-19-run18.md. Pasos 1–8: Mapping vigente; Dependencies/service-map actualizados con deploy flow, Cloud Run URL, Vercel; Contract 4/4 PASS (runtime); Reporter REPORT-SOLUTION-CODING-2026-03-19-run18.md; Judge JUDGE-REPORT-RUN-2026-03-19-run18.md (promedio 4.96/5); Repo Sync REPO-SYNC-REPORT-2026-03-19-run18.md. Paso 9: PROMPT "Próximos prompts" actualizado. Deploy completado: Cloud Run panelin-calc con /calculadora. Dockerfile fixes (easymidi --ignore-scripts), .dockerignore, cloudbuild.yaml, deploy script. Pendientes: tabs/triggers, E2E con URL Cloud Run, npm audit fix, billing cierre.

**2026-03-19 (Full team run 17 — Invoque full team, deploy calc):** Orquestador ejecutó full team run 0→9. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-19-run17.md. Pasos 1–8: Mapping vigente; Dependencies/service-map actualizados (run17); Contract 4/4 PASS (runtime); Reporter REPORT-SOLUTION-CODING-2026-03-19-run17.md (deploy options: Cloud Run, Vercel, Netuy); Judge JUDGE-REPORT-RUN-2026-03-19-run17.md (promedio 4.96/5); Repo Sync REPO-SYNC-REPORT-2026-03-19-run17.md. Paso 9: PROMPT "Próximos prompts" actualizado. Pendientes: deploy calc (Cloud Run/Vercel/Netuy), tabs/triggers, E2E, npm audit fix.

**2026-03-19 (Full team run 16 — Invoque full team):** Orquestador ejecutó full team run 0→9. Paso 0: PROJECT-STATE, PROMPT, BACKLOG, REPORT-STUDY-IMPROVEMENTS leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-19-run16.md. Pasos 1–8: Mapping (DASHBOARD-INTERFACE-MAP con mejoras Calculadora); Dependencies/service-map actualizados (Calculadora MATRIZ flow, actualizar-precios-calculadora); Contract 4/4 PASS (runtime); Reporter REPORT-SOLUTION-CODING-2026-03-19-run16.md; Judge JUDGE-REPORT-RUN-2026-03-19-run16.md (promedio 4.95/5); Repo Sync REPO-SYNC-REPORT-2026-03-19-run16.md. Paso 9: PROMPT "Próximos prompts" actualizado. Pendientes sin cambio.

**2026-03-19 (Vercel + Full team):** Calculadora desplegada en Vercel (calculadora-bmc.vercel.app) con últimas modificaciones; vercel.json con installCommand --ignore-scripts (easymidi); scripts/deploy-vercel.sh; VITE_API_URL apunta a Cloud Run para "Cargar desde MATRIZ". Full team run ejecutado. Repo sync pendiente de completar.

**2026-03-19 (Deploy calc + Repo Sync):** Calculadora integrada al servidor Express en /calculadora; Dockerfile.bmc-dashboard actualizado con build de calc (VITE_BASE=/calculadora/); script scripts/deploy-cloud-run.sh para deploy a Cloud Run vía Cloud Build. Repo Sync ejecutado: bmc-dashboard-2.0 y bmc-development-team actualizados. Para deploy: ejecutar `./scripts/deploy-cloud-run.sh` (requiere gcloud CLI).

**2026-03-19 (Calculadora UI — PanelinCalculadoraV3_backup):** Mejoras en la Calculadora de cotización: (1) Accesorios perimetrales seleccionables sobre la vista previa del techo (RoofBorderSelector integrado con zonas); (2) Columnas Costo, % Margen y Ganancia en la tabla de resultados; (3) Botón "Cargar desde MATRIZ" en Config para costo + venta; (4) Enter para avanzar en wizard (Siguiente); (5) Corrección display título dimensiones (padding); (6) Costo añadido a items de cálculo (pared, selladores, perfiles).

**2026-03-18 (Full team run run15 — Study improvements aplicadas):** Orquestador ejecutó full team run 0→9 + aplicación de mejoras del estudio. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run15.md. Pasos 1–8: Mapping vigente; Dependencies/service-map con Apps Script; Contract validado en código (servidor no corriendo; 4/4 PASS en runs previos). Paso 9: Mejoras aplicadas — REPORT-STUDY-IMPROVEMENTS §1 (nota Pendientes_/Pagos_Pendientes), §6 (Shopify /webhooks/shopify ref), §8 (Panelin Evolution 3847); service-map Apps Script; §20 Fases ya presente; PROMPT con Study improvements como input; PROJECT-STATE actualizado. Judge: JUDGE-REPORT-RUN-2026-03-18-run15.md; promedio 4.94/5 (basado en run6). Repo Sync: artefactos listados para sincronizar.

**2026-03-18 (Full team run run6 — post integración Admin Cotizaciones):** Orquestador ejecutó full team run 0→9 tras la integración de "2.0 - Administrador de Cotizaciones" en BMC crm_automatizado. Paso 0: PROJECT-STATE, PROMPT leídos; IMPROVEMENT-BACKLOG-BY-AGENT no presente. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run6.md. Pasos 1–2: Mapping vigente (planilla-inventory y INTEGRACION-ADMIN-COTIZACIONES reflejan Admin_Cotizaciones). Paso 3: dependencies.md y service-map.md actualizados con módulo Admin Cotizaciones y script. Paso 3b: Contract 4/4 PASS (runtime). Pasos 3c–5g: Networks, Design, Integrations, Reporter (REPORT-SOLUTION-CODING-2026-03-18-run6.md), Security, GPT/Cloud, Fiscal, Billing, Audit, Calc — estado vigente. Paso 6: JUDGE-REPORT-RUN-2026-03-18-run6.md; promedio 4.94/5; JUDGE-REPORT-HISTORICO actualizado. Paso 7: REPO-SYNC-REPORT-2026-03-18-run6.md. Paso 8–9: PROJECT-STATE y PROMPT "Próximos prompts" actualizados. Sin cambios de código.

**2026-03-18 (Integración Admin Cotizaciones):** Integración del contenido de "2.0 - Administrador de Cotizaciones" (1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0) en BMC crm_automatizado. Nueva tab Admin_Cotizaciones en destino; script `scripts/integrate-admin-cotizaciones.js` (`npm run integrate-admin-cotizaciones`); doc `docs/google-sheets-module/INTEGRACION-ADMIN-COTIZACIONES.md`. Planilla-inventory actualizado.

**2026-03-18 (Planilla principal dashboard):** Documentada la planilla que integra/genera la info para el dashboard: BMC crm_automatizado (1N-4kyT...); service account `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` con acceso. Nuevo doc docs/google-sheets-module/PLANILLA-PRINCIPAL-DASHBOARD.md; planilla-inventory actualizado con enlace y cuenta.

**2026-03-18 (Full team analysis run — study evaluation):** Se ejecutó un run de análisis completo (19 roles) para evaluar el estudio externo "Análisis Integral y Modernización de la Arquitectura de Gestión Comercial". Sin implementación: no se realizaron cambios de código, config, Sheets ni triggers. Entregable: docs/team/reports/REPORT-STUDY-IMPROVEMENTS-2026-03-18.md (mejoras priorizadas por área, con rationale).

**2026-03-16 (Full team run + apply study improvements):** Orquestador ejecutando run 0→9. **Aplicado:** REPORT-STUDY-IMPROVEMENTS corregido (Shopify referencia, Pendientes_/Pagos_Pendientes, Panelin Evolution); sección 20 Fases de implementación añadida; service-map Apps Script como nodo; PROMPT-FOR-EQUIPO-COMPLETO incluye REPORT-STUDY-IMPROVEMENTS como input. Pendientes sin cambio.

**Full team run 2026-03-17 run 6 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-17-run6.md. Pasos 1–8: Mapping vigente; Dependencies/service-map fecha 2026-03-17; Contract 4/4 PASS (código); Reporter REPORT-SOLUTION-CODING-run6; Judge JUDGE-REPORT-RUN-2026-03-17-run8 (promedio 4.94/5); Repo Sync REPO-SYNC-REPORT. Paso 9: PROMPT y BACKLOG actualizados; sin prompts automatizables; pendientes 1, 3, 6, 7 (Matias).

**Full team run 2026-03-18 run 5 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run5.md. Pasos 1–8: estado vigente. Paso 9: sin entregables automatizables; pendientes 1, 3, 6, 7 (Matias). PROJECT-STATE y PROMPT actualizados.

**Full team run 2026-03-18 run 4 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run4.md. Pasos 1–8: estado vigente. Paso 9: sin prompts automatizables; agenda 1, 3, 6, 7 pendiente (Matias). PROJECT-STATE y PROMPT actualizados.

**Full team run 2026-03-18 run 3 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run3.md. Pasos 1–8: estado vigente; sin cambios de dominio. Paso 9: Agenda pendiente (1 tabs/triggers, 3 deploy, 6 npm --force, 7 Repo Sync opcional) requiere Matias manual o decisión; sin entregables automatizables en este run. PROJECT-STATE y PROMPT actualizados.

**Full team run 2026-03-16 (run7 — post-go-live agenda):** Orquestador ejecutó run completo 0→9. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-16-run7.md creado. Pasos 1–2: Mapping vigente; sin drift. Paso 3: service-map.md actualizado (fecha, PUSH routes). Paso 3b: Contract 4/4 PASS; kpi-report línea 1130 bmcDashboard.js — ruta montada en /api; 404 runtime = restart servidor. Pasos 3c–5g: Networks, Design, Integrations, Reporter (REPORT-SOLUTION-CODING-run7.md), Security (CORS pre-deploy), GPT/Cloud, Fiscal (incumplimiento Medio detectado/corregido), Billing, Audit (latest-report-run7.md + E2E checklist), Calc. Paso 6: Judge 18/19 formales (Sheets N/A); promedio 4.93/5; JUDGE-REPORT-RUN-2026-03-16-run7.md y HISTORICO actualizados. Paso 7: Repo Sync — bmc-dashboard-2.0 y bmc-development-team verificados y artefactos sincronizados. Paso 9: GUIA-RAPIDA-VENDEDORES.md creada; agenda siguiente run actualizada.

**Full team run 2026-03-18 run 2 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run2.md. Pasos 1–8: estado vigente. Paso 9: Contract verificó en código que GET /api/kpi-report existe (bmcDashboard.js ~L1130, montado en /api en index.js); 404 en runtime = reiniciar servidor. Audit/Debug creó docs/team/E2E-VALIDATION-CHECKLIST.md (D1). npm audit fix ejecutado sin --force: no aplicó cambios (fix requiere --force, breaking). PROJECT-STATE y PROMPT actualizados.

**Full team run 2026-03-18 (Invoque full team):** Orquestador ejecutó run 0→9. Paso 0: PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, IMPROVEMENT-BACKLOG leídos (19/19 agentes desarrollados). Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18.md. Pasos 1–8: Estado vigente (Mapping, Dependencies, Contract, Networks, Design, Integrations, Reporter, Security, GPT, Fiscal, Billing, Audit, Calc, Judge, Repo Sync). Paso 9: Reporter creó docs/GUIA-RAPIDA-VENDEDORES.md (C1 post-go-live); PROMPT y PROJECT-STATE actualizados. Pendientes restantes: tabs/triggers manual (Matias), kpi-report runtime verify, deploy, E2E, npm audit fix.

---

## Estado por área

### Sheets / Planillas

- **Workbooks:** 5 (multi-workbook). Principal: `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`. Ver `docs/google-sheets-module/SHEETS-MAPPING-5-WORKBOOKS.md` y `planilla-inventory.md`.
- **Schema activo:** CRM_Operativo
- **Tabs:** Ver `docs/google-sheets-module/planilla-inventory.md` (active_now, conditional)
- **Artefactos:** `planilla-inventory.md` (live), `planilla-map.md` (diff vs blueprint), `FULL-SHEETS-AUDIT-REPORT.md`, `FULL-SHEETS-AUDIT-RAW.json`, `STRATEGIC-REVIEW-FULL-SYSTEM-SYNC.md`, `MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md`

### Dashboard

- **Puertos:** 3001 (canónico), 3849 (standalone), 5173 (Calculadora)
- **URL principal:** http://localhost:3001/finanzas
- **Secciones:** Resumen financiero, Trend, Breakdown, Calendario, Entregas, Metas, Audit, Ventas 2.0 (tabla + filtro proveedor), Stock E-Commerce (KPIs + tabla + export CSV), Invoque (placeholder)
- **Artefactos:** `DASHBOARD-INTERFACE-MAP.md`, `DASHBOARD-VISUAL-MAP.md`, `MAPA-VISUAL-ESTRUCTURA-POR-ESTACION.md`, `PUERTOS-3849-VS-3001.md`

### Infraestructura

- **Producción:** Cloud Run (panelin-calc) — deploy completado. URL: `gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)'`. Calculadora: `<URL>/calculadora`; Dashboard: `<URL>/finanzas`; API: `<URL>/calc`. Alternativas: Vercel, VPS Netuy.
- **ngrok:** puerto 4040 para OAuth
- **Artefactos:** `HOSTING-EN-MI-SERVIDOR.md`, `.env`

### Repos (Repo Sync)

- **bmc-dashboard-2.0:** https://github.com/matiasportugau-ui/bmc-dashboard-2.0.git
- **bmc-development-team:** https://github.com/matiasportugau-ui/bmc-development-team.git
- **Config:** En `.env` ✓
- **Guía:** `docs/team/REPO-SYNC-SETUP.md`

### Integraciones

- **Activas:** Google Sheets, Google Drive, MercadoLibre (OAuth), Shopify
- **Cloud Run calc:** `docs/openapi-calc.yaml`

---

## Plan vigente (equipo completo)

**Plan:** [plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md](./plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md)

| Paso | Contenido | Dependencias |
|------|-----------|--------------|
| **1** | C2, C6, C7 (quick wins) | Ninguna |
| **2** | S1 + C1, C3, C4, C5 (UX Opción A) | S1 aprobado |
| **3** | Skills PROJECT-STATE, orquestador extendido, referencias overlaps | Ninguna |

Todos los agentes deben consultar este plan al iniciar tareas. Al finalizar cada paso, actualizar Cambios recientes.

---

## Pendientes de sincronización

- [x] **KPI Report (inicio):** Implementado 2026-03-16. GET /api/kpi-report + bloque UI en #inicio.
- [x] **Paso 1:** C2, C6, C7 (quick wins) — completado (C2/C6 ya existían; C7 doc creada)
- [x] **Fase 0:** Verificación stack (T0.1–T0.4) — completado
- [x] **Paso 2:** C1–C5 (UX Opción A) — completado
- [x] **Paso 3:** Skills PROJECT-STATE, orquestador extendido — completado
- [ ] **Go-live:** Completar GO-LIVE-DASHBOARD-CHECKLIST — credenciales y stack local ✓; pendiente: 1.4 (compartir workbook con service account), 2.x (tabs manuales), 3.x (Apps Script triggers), 5.x (deploy Cloud Run / VPS Netuy), 6.x (verificación E2E). Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md.
- [x] **Guía usuarios:** docs/GUIA-RAPIDA-DASHBOARD-BMC.md existe
- [x] **Phase 1 (GET):** Iteración 23 tabs Ventas (getAllVentasData, Promise.allSettled); GET /api/ventas?proveedor=; GET /api/ventas?tab=; GET /api/ventas/tabs; GET /api/calendario-vencimientos?month=2026-03 → tab "MARZO 2026". Pendiente: GET /api/stock/history (EXISTENCIAS_Y_PEDIDOS, Egresos)
- [x] **Phase 2 (PUSH):** Implementado 2026-03-16. POST /api/cotizaciones, PATCH /api/cotizaciones/:id, POST /api/pagos, PATCH /api/pagos/:id, POST /api/ventas, PATCH /api/stock/:codigo; append AUDIT_LOG. Pendiente manual: crear tabs CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO; configurar triggers.
- [x] **Planilla-inventory:** Tab Pagos corregida (Pendientes_); nuevos endpoints documentados. Pendiente: documentar columna MONTO autoritativa (D/E) en Pagos
- [x] **Repo Sync:** BMC_DASHBOARD_2_REPO y BMC_DEVELOPMENT_TEAM_REPO configurados en .env ✓
- [ ] **npm audit fix:** **7 vulns restantes** (5 low, 2 moderate) tras `npm audit fix` **sin --force** (2026-03-20 — 4 packages actualizados). Cierre completo: `npm audit fix --force` (vite@8, @google-cloud/storage — **breaking**). Evaluar con Matias en branch separado.
- [ ] **kpi-report runtime:** Verificar que /api/kpi-report retorna 200 (o 503) tras restart servidor. Ruta verificada en código 2026-03-18: existe en bmcDashboard.js, montada en /api (index.js); 404 = reiniciar servidor.
- [x] **Guía vendedores:** docs/GUIA-RAPIDA-VENDEDORES.md creada 2026-03-18 (Reporter, paso 9).
- [x] **Deploy producción:** Cloud Run panelin-calc — deploy completado. Ver service-map.md §5 Deploy flow.
- [ ] **E2E validation:** Ejecutar checklist docs/team/E2E-VALIDATION-CHECKLIST.md con URL Cloud Run (post-deploy). Creado 2026-03-18.

---

## Cómo usar este archivo

- **Antes de trabajar:** Leer "Cambios recientes" y "Pendientes".
- **Después de un cambio:** Añadir fila en "Cambios recientes"; si afecta a otros, añadir en "Pendientes" o escribir Log for [Agent].
- **Sync completo:** Ejecutar "Sync project state" o full team run.

**Supervisión:** El Fiscal (bmc-dgi-impositivo) fiscaliza que el equipo cumpla este protocolo según el ranking de criticidad en [fiscal/FISCAL-PROTOCOL-STATE-RANKING.md](./fiscal/FISCAL-PROTOCOL-STATE-RANKING.md). Controla que no sucedan incumplimientos; si ocurren, comunica a los involucrados para que no pase de nuevo.
