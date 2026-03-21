# Informe — Full Team Run: áreas, capacidades, carencias, riesgos y simulaciones

**Fecha:** 2026-03-13  
**Alcance:** Equipo canónico §2 (`PROJECT-TEAM-FULL-COVERAGE.md`), dominios §1, extensión **OmniCRM Sync** (repo hermano / uso actual), estado en `PROJECT-STATE.md`.  
**Objetivo:** Evaluar si el “full team run” puede ejecutar la tarea hacia el éxito, dónde hay brechas y cómo simular escenarios.

**Actualización operativa:** El mapa de acceso a Sheets y rutas API está **implementado** en `docs/google-sheets-module/SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md` (no repetir aquí; usar ese doc como fuente viva).

---

## 1. Mapa de áreas que abarca hoy el ecosistema

| Área | Qué cubre | Artefactos / repos |
|------|-----------|---------------------|
| **Sheets / Planillas** | Tabs, columnas, CRM operativo, MATRIZ, auditoría | `planilla-inventory`, `bmcDashboard.js`, Apps Script |
| **Dashboard UI** | Finanzas, KPIs, entregas, Invoque Panelin | `dashboard/`, `DASHBOARD-INTERFACE-MAP` |
| **Calculadora / Cotizaciones** | BOM, precios, PDF, Drive, presupuesto libre | `PanelinCalculadoraV3*.jsx`, API `/calc/*` |
| **Infraestructura** | Cloud Run, Vercel, puertos, env | Deploy scripts, `.env` |
| **Integraciones** | MercadoLibre, Shopify, Drive, Sheets API | `server/routes/`, tokens |
| **GPT / Panelin** | OpenAPI, Actions, MCP, drift | `openapi-calc.yaml`, GPT Builder |
| **Fiscal / DGI** | IVA, CFE, conciliación (cuando aplica) | skill `bmc-dgi-impositivo` |
| **Facturación / Billing** | Errores, duplicados, cierre | skill `billing-error-review` |
| **Audit / Debug** | Auditoría dashboard, diagnóstico Cloud Run | audits, `cloudrun-diagnostics` |
| **Reporting / Equipo** | MATPROMT, Reporter, Judge, Parallel/Serial | `docs/team/*` |
| **OmniCRM Sync (canal → Sheets)** | WA, ML, FB, IG → Web App → Sheet | `omnicrm-sync`, `omnicrm-apps-script-v1.1.gs` |

**Nota:** El “equipo completo” en documentación **no** incluye un rol dedicado solo a OmniCRM; el producto se apoya en **Integrations + Security + Networks** (permisos, URL, secretos) y en **Sheets** (esquema de columnas).

---

## 2. Roles del full team (§2) — capacidad para ejecutar bien

| Rol | Fortaleza para llegar al éxito | Límite típico |
|-----|-------------------------------|---------------|
| **Orchestrator** | Orden 0→0a→0b→…→9, handoffs, lectura `PROJECT-STATE` | No sustituye decisión humana de negocio ni credenciales |
| **MATPROMT** | Bundles por run, DELTA ante cambios | Calidad depende de contexto actualizado |
| **Parallel/Serial** | Propone paralelo vs serie según riesgo/carga | Es plan; la ejecución real puede divergir |
| **Mapping** | Alineación planilla ↔ UI ↔ API | Requiere datos MATRIZ/tabs reales |
| **Sheets Structure** | Estructura tabs/dropdowns | Marcado “Matias only” — cuello de botella humano |
| **Networks** | Hosting, URLs, conectividad | No fija billing ni permisos OAuth sin inputs |
| **Dependencies** | Grafo y service-map | Obsoleto si no se commitea tras cambios |
| **Integrations** | ML, Shopify, webhooks | OmniCRM es **otro** cliente HTTP; hay que no mezclar modos |
| **GPT/Cloud** | OpenAPI, drift GPT vs Cloud | Requiere despliegues y archivos sync |
| **Contract** | Validación API vs contrato | APIs 503 sin Sheets config no “fallan contrato” pero sí producto |
| **Calc** | Motor cotización, SKUs | Depende de MATRIZ col.D y reglas de negocio |
| **Security** | OAuth, secretos, CORS | OmniCRM: `OMNI_SECRET`, no pegar manifest en headers |
| **Fiscal** | Cumplimiento y análisis impositivo | No automatiza DGI por sí solo |
| **Billing** | Revisión errores facturación | Desacoplado de OmniCRM salvo que unan datos |
| **Audit/Debug** | Logs, auditorías | Encuentra síntomas; la causa suele ser config |
| **Reporter** | Informes Solution/Coding | Documenta; no despliega |
| **Judge** | Score y mejora continua | Subjetivo; útil para tendencia |
| **Repo Sync** | `bmc-dashboard-2.0`, `bmc-development-team` | Requiere `git push` y acuerdos de rama |

---

## 3. Carencias y brechas (hacia el “éxito” operativo)

### 3.1 Técnicas / producto (estado vigente en docs)

- **Sheets en Cloud Run:** endpoints financieros/KPI pueden responder **503** si credenciales o config Sheets no están en el deploy — el “éxito” de API completa depende de **config producción**.
- **Pista 3 (tabs/triggers):** trabajo **manual** en planilla; el equipo documenta pero no cierra sin Matias.
- **E2E:** checklist existe; ejecución **manual** frecuentemente pendiente o parcial.
- **MATRIZ SKUs:** código vs col.D — validación humana recurrente en backlog.
- **Repos hermanos:** sync documentado; **push** a veces pendiente verificación.
- **OmniCRM:** confusión **Webhook vs Google Sheets**; **headers** con manifest pegado; **columnas** inglés (script) vs hoja BMC español — requiere **pestaña dedicada** o **script adaptado**.

### 3.2 Organizativas / proceso

- **N dinámico (§2.1):** olvidar un rol nuevo en §2 rompe el “full team” nominal.
- **Evidencia vs documental:** muchos runs “documentales” — el informe del Judge no reemplaza prueba en producción.
- **Un solo dueño de planilla:** Sheets Structure y tabs → riesgo de demora.

### 3.3 Riesgos (resumen)

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Drift GPT ↔ Cloud Run | Acciones rotas | Run 38-type drift + OpenAPI único |
| Secreto Web App expuesto | Abuso POST | `OMNI_SECRET` + rotación |
| Import JSON malformado | Cola bloqueada | Plantilla `omnicrm-settings-google-sheets.example.json` + sanitización UI |
| Columnas Sheet ≠ payload | Datos en columnas incorrectas | Tab `CRM BMC` con headers del script o `CONFIG.headers` = hoja real |

---

## 4. Simulaciones (qué pasaría si…)

| Escenario | Resultado esperado | Falla típica |
|-----------|-------------------|--------------|
| **A)** Full team run solo documental, sin smoke prod | Informes Judge/Reporter OK; producto puede estar roto en prod | 503 Sheets, URL vieja `/exec` |
| **B)** OmniCRM en modo Webhook con URL Apps Script | POST llega pero sin `_targetSheet` / flujo equivocado | Filas en tab equivocado o campos vacíos |
| **C)** Apps Script sin `SPREADSHEET_ID` (standalone) | Run en editor falla; Web App puede OK si despliegue ligado | Confusión “¿por qué testInsert falla?” |
| **D)** Merge a `main` sin pull en máquina local | Conflictos o carpetas anidadas `Calculadora-BMC/` | `.gitignore` ya lo mitiga; disciplina git |
| **E)** Cambio de precios MATRIZ sin actualizar `constants`/mapping | Cotizaciones desfasadas | Calc + Mapping deben correr en mismo sprint |

---

## 5. Conclusión: ¿el full team “alcanza” el éxito?

- **Sí en diseño:** el protocolo (Orquestador + MATPROMT + roles §2 + `PROJECT-STATE`) **cubre** arquitectura, código, seguridad, reporting y mejora continua.
- **Condicional en la práctica:** el éxito **operativo** (usuarios cotizando, CRM alimentado, APIs 200 con datos reales) depende de:
  1. **Config** (Sheets, OAuth, URLs, secretos, despliegues),
  2. **Datos** (MATRIZ, tabs),
  3. **Ejecución** de smoke/E2E **fuera** del solo informe del Judge.

**Recomendación:** Tratar cada “full team run” con **Definition of Done** explícita: p. ej. “smoke GET/POST OmniCRM + fila visible en Sheet” **o** “503 Sheets documentado como bloqueo con owner”.

---

## 6. Próximos pasos sugeridos (puente a tu roadmap)

1. **Run siguiente (según `PROMPT-FOR-EQUIPO-COMPLETO` + `RUN-ROADMAP-FORWARD-2026.md`):** incluir **checklist OmniCRM** (tipo Google Sheets, import plantilla, pestaña alineada).
2. **Unificar** hoja BMC español vs columnas OmniCRM (decisión: tab nueva vs script custom).
3. **Asignar owner** a Pista 3 (tabs/triggers) y a evidencia E2E prod.

---

*Referencias internas:* [`PROJECT-TEAM-FULL-COVERAGE.md`](../PROJECT-TEAM-FULL-COVERAGE.md), [`PROJECT-STATE.md`](../PROJECT-STATE.md), [`PROMPT-FOR-EQUIPO-COMPLETO.md`](../PROMPT-FOR-EQUIPO-COMPLETO.md). OmniCRM (repo hermano): `omnicrm-sync/docs/INTERNAL-RUNBOOK.md`.
