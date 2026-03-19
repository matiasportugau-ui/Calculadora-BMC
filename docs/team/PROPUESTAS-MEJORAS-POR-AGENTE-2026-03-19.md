# Propuestas de mejoras por agente — Run Full Team 2026-03-19

**Tarea:** Cada agente propone individualmente las mejoras que le facilitarían y mejorarían sus tareas en su área.

**Origen:** Solicitud de Matias en chat con el equipo completo. Las propuestas serán analizadas posteriormente.

---

## 1. Mapping (bmc-planilla-dashboard-mapper)

**Área:** Sheets, Dashboard (mapeo), cross-reference planilla ↔ dashboard ↔ API

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Export periódico de estructura de planillas** — Un script o proceso que exporte la estructura actual (tabs, columnas, tipos) a JSON/Markdown. Así puedo detectar drift sin acceso directo a Sheets. | Alto | Medio |
| 2 | **Muestra de respuestas API reales** — Archivos JSON de ejemplo de `/api/kpi-financiero`, `/api/ventas`, etc. para validar que el contrato documentado coincide con lo que devuelve el servidor. | Alto | Bajo |
| 3 | **Decision log de cambios estructurales** — Documento que registre por qué se añadió cada tab/columna (ej. "CONTACTOS para Shopify", "PAGADO para cierre"). Me ayuda a entender el "por qué" y evitar mapeos incorrectos. | Medio | Bajo |
| 4 | **Notificación cuando cambia la planilla** — Si Matias añade una tab o columna, un checklist o nota en PROJECT-STATE que diga "Mapping: verificar y actualizar planilla-inventory". | Medio | Bajo |

---

## 2. Design (bmc-dashboard-design-best-practices)

**Área:** Dashboard UI, UX, jerarquía, estados loading/error

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Capturas o mockups del estado actual** — Screenshots o descripción visual de cada sección (Finanzas, Operaciones, Ventas, etc.) para evaluar mejoras sin tener que levantar el servidor. | Alto | Bajo |
| 2 | **Restricciones de negocio documentadas** — Qué acciones el usuario puede hacer, qué no, y por qué (ej. "no editar pagos cerrados"). Me evita proponer UX que viole reglas de negocio. | Alto | Bajo |
| 3 | **Métricas de uso (si existen)** — Qué secciones se usan más, qué flujos son lentos. Aunque sea cualitativo ("ventas usa mucho el filtro por proveedor"), me orienta hacia time-saving real. | Medio | Variable |
| 4 | **Design system básico** — Colores, tipografías, espaciado ya definidos en un solo lugar. Evito inconsistencias al proponer nuevos componentes. | Medio | Bajo |

---

## 3. Sheets Structure (bmc-sheets-structure-editor)

**Área:** Tabs, dropdowns, estructura (Matias only)

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Checklist ejecutable por tab** — Para cada tab a crear (CONTACTOS, Ventas_Consolidado, etc.), un checklist con pasos exactos: "1. Crear tab, 2. Añadir columna X con validación Y". Reduzco errores al guiar a Matias. | Alto | Bajo |
| 2 | **Plantilla de validación por columna** — Lista de columnas con tipo de validación (dropdown, número, fecha) y valores permitidos. Así no hay ambigüedad al configurar. | Medio | Bajo |
| 3 | **Orden de creación documentado** — Si hay dependencias entre tabs (ej. PAGADO depende de Pagos_Pendientes), documentar el orden correcto de creación. | Medio | Bajo |

---

## 4. Networks (networks-development-agent)

**Área:** Infraestructura, hosting, migración, endpoints, storage

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Acceso a logs de Cloud Run (read-only)** — O export periódico de logs recientes. Puedo diagnosticar errores de conectividad, timeouts, CORS sin depender de descripciones verbales. | Alto | Medio |
| 2 | **Estado actual de servicios** — Un endpoint o script que devuelva: servidor 3001 up/down, Sheets API reachable, ngrok activo, Cloud Run status. Me permite evaluar migraciones con datos reales. | Alto | Bajo |
| 3 | **Workbook de staging** — Copia del workbook principal para pruebas de migración sin afectar producción. Crítico para validar cambios de hosting. | Alto | Medio |
| 4 | **Documentación de decisiones de infra** — Por qué Cloud Run vs VPS, por qué puerto X, restricciones de firewall. Me evita proponer opciones que ya se descartaron. | Medio | Bajo |

---

## 5. Dependencies (bmc-dependencies-service-mapper)

**Área:** Grafo de dependencias, service map, integration checklist

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Script de health check unificado** — Un script que pruebe todos los entry points (3001, 3849, 5173, /api/*, Sheets) y genere un reporte OK/FAIL. Actualizo el service map con datos reales. | Alto | Bajo |
| 2 | **Notificación cuando se añade un endpoint** — Convención: al crear una ruta nueva, actualizar una lista (ej. ENDPOINTS.md) o el service-map. Evito que el mapa quede desactualizado. | Medio | Bajo |
| 3 | **Matriz de dependencias env vars** — Tabla: módulo X requiere env var Y. Me ayuda a detectar configs faltantes antes de deploy. | Medio | Bajo |

---

## 6. Integrations (shopify-integration-v4, browser-agent-orchestration)

**Área:** Shopify, MercadoLibre, OAuth, webhooks

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Logs de webhooks (Shopify, ML)** — Export o acceso a logs de webhooks recibidos (sin datos sensibles). Puedo validar HMAC, payloads, y detectar fallos de integración. | Alto | Medio |
| 2 | **Estado de OAuth documentado** — Qué apps están configuradas (ML, Shopify), redirect URIs, scopes. Evito proponer cambios que rompan OAuth existente. | Alto | Bajo |
| 3 | **Checklist pre-go-live de integraciones** — Pasos para verificar que Shopify/ML funcionan en producción (tokens, webhooks, CORS). | Medio | Bajo |

---

## 7. GPT/Cloud (panelin-gpt-cloud-system, openai-gpt-builder-integration)

**Área:** OpenAPI, GPT Builder, Cloud Run, drift closure

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Respuestas reales de Cloud Run calc** — Ejemplos de JSON que devuelve el servicio panelin-calc. Valido que OpenAPI y GPT Builder apunten a contratos correctos. | Alto | Bajo |
| 2 | **Snapshot de GPT Builder config** — Export de instrucciones, actions, operationIds actuales. Detecto drift entre repo y Builder sin acceso a la UI. | Alto | Medio |
| 3 | **Checklist de drift** — Lista de puntos a verificar cuando cambia OpenAPI: operationIds, schemas, auth. Me guía en cada cambio. | Medio | Bajo |

---

## 8. Fiscal (bmc-dgi-impositivo)

**Área:** Oversight, fiscalización, protocolo PROJECT-STATE, alternativas

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Ranking de criticidad actualizado** — FISCAL-PROTOCOL-STATE-RANKING con ejemplos concretos de incumplimientos por nivel (Crítico, Alto, Medio, Bajo). Me permite clasificar con consistencia. | Alto | Bajo |
| 2 | **Log de incumplimientos resueltos** — Breve registro: "Incumplimiento X detectado, agente Y corrigió en Z". Sirve para no repetir y para mejorar criterios. | Medio | Bajo |
| 3 | **Contexto de restricciones fiscales** — Si hay reglas DGI/CFE que afectan el dashboard (ej. retención, facturación), documentarlas. Me ayuda a evaluar alternativas. | Medio | Bajo |

---

## 9. Billing (billing-error-review)

**Área:** Facturación, errores, duplicados, cierre mensual

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Export estándar de facturación** — Formato acordado para CSV/XLS de facturas, pagos, notas de crédito (columnas, nombres). Puedo automatizar validaciones si el formato es estable. | Alto | Medio |
| 2 | **Reglas de negocio explícitas** — Qué constituye duplicado, qué tolerancia de redondeo, qué estados de pago son válidos. Reduzco falsos positivos en la revisión. | Alto | Bajo |
| 3 | **Checklist de cierre mensual** — Pasos que administración debe seguir (orden, validaciones). Puedo verificar que el proceso esté documentado y completo. | Medio | Bajo |

---

## 10. Audit/Debug (bmc-dashboard-audit-runner, cloudrun-diagnostics-reporter)

**Área:** Auditoría, logs, diagnóstico

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Acceso a logs del servidor** — Últimas N líneas cuando hay error, o export periódico. Diagnóstico sin "reproducir manualmente". | Alto | Medio |
| 2 | **Endpoint de diagnóstico** — `/api/diagnostic` (o similar) que devuelva: versión, env vars presentes (sin valores), estado de Sheets, estado de integraciones. Solo en dev/staging. | Alto | Bajo |
| 3 | **E2E checklist con datos reales** — Si hay ambiente de staging con datos, poder ejecutar el checklist contra él. Valido flujos completos. | Medio | Variable |

---

## 11. Reporter (bmc-implementation-plan-reporter)

**Área:** Planes Solution/Coding, handoffs, reportes

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Feedback post-implementación** — Después de que Solution/Coding ejecutan un plan: qué tareas fueron útiles, cuáles ambiguas, qué faltó. Mejoro los siguientes planes. | Alto | Bajo |
| 2 | **Prioridades explícitas** — Cuando hay muchos pendientes, una indicación de qué es bloqueante vs nice-to-have. Ordeno mejor las tareas. | Alto | Bajo |
| 3 | **Plantilla de handoff** — Formato estándar para "Solution entrega X → Coding puede empezar Y". Consistencia en los planes. | Medio | Bajo |

---

## 12. Orchestrator (bmc-dashboard-team-orchestrator, ai-interactive-team)

**Área:** Coordinación, orden, handoffs, diálogo entre agentes

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Resumen de pendientes por prioridad** — En PROJECT-STATE, clasificar pendientes: bloqueante / alto / medio / bajo. Ordeno el run según impacto. | Alto | Bajo |
| 2 | **Criterios de "skip" documentados** — Cuándo omitir un paso (ej. "2b solo si hay cambios estructurales"). Evito ejecutar pasos innecesarios o saltar los que sí aplican. | Medio | Bajo |
| 3 | **Log de decisiones del run** — Breve registro: "Paso 5c omitido porque no hay cambios OpenAPI". Útil para el siguiente run y para el Judge. | Medio | Bajo |

---

## 13. Contract (bmc-api-contract-validator)

**Área:** Validar respuestas API contra contrato canónico

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Script de validación automática** — Script que haga curl a cada endpoint, compare con contrato (planilla-inventory, DASHBOARD-INTERFACE-MAP) y reporte PASS/FAIL. Ejecutable en cada run o pre-deploy. | Alto | Medio |
| 2 | **Muestras de respuesta real** — JSON de cada endpoint cuando está OK. Actualizo contratos cuando hay drift y valido que el script usa el formato correcto. | Alto | Bajo |
| 3 | **Contrato versionado** — Si el contrato cambia, indicar versión o fecha. Evito validar contra una versión vieja. | Medio | Bajo |

---

## 14. Calc (bmc-calculadora-specialist)

**Área:** Calculadora 5173, BOM, precios, Drive, PDF

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Constantes y fórmulas documentadas** — Lista de constantes (precios, márgenes) y fórmulas clave (calcTechoCompleto, etc.) en un solo doc. Evito errores al proponer cambios. | Alto | Bajo |
| 2 | **Casos de prueba de cálculo** — Input + output esperado para cálculos críticos. Valido que los helpers no se rompan. | Alto | Medio |
| 3 | **Flujo Cotizaciones → Sheets documentado** — Qué campos se envían, en qué orden, qué validaciones. Me ayuda a integrar con Mapping y Design. | Medio | Bajo |

---

## 15. Security (bmc-security-reviewer)

**Área:** OAuth, tokens, env vars, CORS, HMAC

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Checklist de seguridad pre-deploy** — Lista ejecutable: CORS, env vars, tokens, HMAC, headers. Marco cada ítem al revisar. | Alto | Bajo |
| 2 | **.env.example completo y actualizado** — Todas las vars necesarias (sin valores), con descripción. Detecto configs faltantes o expuestas. | Alto | Bajo |
| 3 | **Documentación de flujos OAuth** — Diagrama o descripción: ML redirect, Shopify, dónde se guardan tokens. Valido que no haya fugas. | Medio | Bajo |

---

## 16. Judge (bmc-team-judge)

**Área:** Evaluación, ranqueo, reporte por run, promedio histórico

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Feedback del usuario sobre entregables** — Después de cada run: qué reportes/artefactos fueron útiles, cuáles no. Ajusto criterios de evaluación. | Alto | Bajo |
| 2 | **Entregables esperados por agente** — Lista explícita: "Mapping entrega planilla-inventory actualizado". Evalúo con criterios claros. | Medio | Bajo |
| 3 | **Histórico de scores con contexto** — Breve nota por run: "Run 5: sin cambios de dominio, estado vigente". El promedio tiene más sentido con contexto. | Medio | Bajo |

---

## 17. Parallel/Serial (bmc-parallel-serial-agent)

**Área:** Estrategia paralelo vs serie, mejor combinación de agentes

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Scores del Judge actualizados** — JUDGE-REPORT-HISTORICO con scores recientes. Decido mejor qué paralelizar según desempeño histórico. | Alto | Bajo |
| 2 | **Grafo de dependencias entre pasos** — Qué pasos dependen de cuáles (ej. Design depende de Mapping). Genero planes más precisos. | Alto | Bajo |
| 3 | **Tiempo estimado por paso (si existe)** — Aunque sea aproximado, me ayuda a balancear carga en paralelo. | Medio | Variable |

---

## 18. Repo Sync (bmc-repo-sync-agent)

**Área:** Sincronizar bmc-dashboard-2.0 y bmc-development-team

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Mapa de artefactos por repo** — Tabla: archivo/carpeta → va a dashboard-2.0 o development-team. Evito enviar artefactos al repo equivocado. | Alto | Bajo |
| 2 | **Checklist pre-push** — Qué verificar antes de pushear (lint, que no haya secrets). Reduzco errores en sync. | Medio | Bajo |
| 3 | **Log de syncs** — Registro de qué se sincronizó y cuándo. Útil para detectar drift entre runs. | Medio | Bajo |

---

## 19. Chat de Equipo Interactivo (chat-equipo-interactivo)

**Área:** Diálogo conversacional con el equipo

| # | Propuesta | Impacto | Esfuerzo |
|---|-----------|---------|----------|
| 1 | **Resumen de estado al iniciar** — PROJECT-STATE resumido en 3–5 líneas. Respondo más rápido sin leer el doc completo cada vez. | Medio | Bajo |
| 2 | **Preguntas frecuentes** — Doc con respuestas a "¿qué pendientes hay?", "¿cómo invoco full team?". Reduzco latencia en preguntas recurrentes. | Medio | Bajo |
| 3 | **Transición fluida a full team** — Cuando el usuario pide "Invoque full team" desde el chat, el handoff al Orquestador sea explícito y sin pérdida de contexto. | Medio | Bajo |

---

## Resumen por prioridad (para análisis posterior)

| Prioridad | Cantidad | Ejemplos |
|-----------|----------|----------|
| **Alto impacto, bajo esfuerzo** | 15+ | Decision log, restricciones negocio, muestras API, checklist health check |
| **Alto impacto, medio esfuerzo** | 8+ | Export estructura planillas, workbook staging, script validación contrato |
| **Medio impacto, bajo esfuerzo** | 12+ | Notificaciones, documentación, plantillas |

---

## Próximo paso

Matias analizará estas propuestas y decidirá cuáles implementar. El equipo estará disponible para ejecutar las que se prioricen.

**Documento generado:** Run Full Team 2026-03-19 — Tarea: propuestas individuales por agente.
