# Plan — Email analytics, reporting, synthesis, completion & response

**Scope:** `conexion-cuentas-email-agentes-bmc` (IMAP multi-cuenta) + integración con **PANELSIM** / **Calculadora-BMC** (agentes, skills, docs).  
**Goal:** Alinear el stack con **best practices** operativas y de producto para bandeja compartida, sin inventar datos y con trazabilidad.

---

## 1. Best practices (resumen ejecutivo)

### 1.1 Analytics (métricas y calidad de datos)

| Práctica | Por qué importa | Estado actual (repo correo) |
|----------|-----------------|-----------------------------|
| **Definir ventana temporal explícita** (`daysBack`, zona horaria) | Evita comparar períodos incomparables | OK: `accounts.json` + metadatos en reporte |
| **Deduplicación / threading** | No contar el mismo hilo 3 veces | Parcial: depende de UIDs por cuenta; sin `In-Reply-To` / `References` agregados al snapshot |
| **Métricas por intención** (entrada vs salida, por categoría de negocio) | Priorizar trabajo real | Parcial: categorías rules-based |
| **Separar volumen vs valor** (ruido vs acción requerida) | No optimizar “muchos mails” si son newsletters | Falta: capa “acción requerida” / heurística de ruido |
| **Privacidad y retención** | GDPR / buen hábito; menos superficie de fuga | OK local + `.gitignore`; falta política documentada de retención y redacción en exports |
| **Observabilidad** (sync OK, latencia, errores por cuenta) | Diagnosticar caídas IMAP | Parcial: logs en consola; falta `STATUS` estructurado de errores por cuenta |

### 1.2 Reporting (legibilidad y acción)

| Práctica | Por qué importa | Estado actual |
|----------|-----------------|----------------|
| **Un “executive layer” fijo** (KPIs + excepciones) | Lectura en &lt; 2 minutos | OK: bullets + tablas en Markdown |
| **Drill-down opcional** (detalle por categoría/cuenta) | No abrumar | OK: `reports.json` |
| **Formato estable para agentes** (`PANELSIM-ULTIMO-REPORTE.md`, `PANELSIM-STATUS.json`) | Parsing predecible | OK |
| **Versionado de esquema** (`reportSchemaVersion`) | Evitar roturas al cambiar JSON | Falta |
| **Alertas** (picos, casilla caída, categoría vacía inesperada) | Proactividad | Falta |

### 1.3 Synthesis (LLM)

| Práctica | Por qué importa | Estado actual |
|----------|-----------------|----------------|
| **Grounding obligatorio** (solo citar hechos del snapshot/reporte) | Anti-alucinación | Parcial: `summary` recibe mensajes; falta checklist en prompt |
| **Citas / IDs** (messageId, índice, cuenta) | Verificación humana | Parcial |
| **Instrucciones por rol** (ventas vs admin vs soporte) | Respuestas útiles | Falta perfiles en config |
| **Límites de tokens y truncado explícito** | Costo y calidad | Parcial |
| **Salida estructurada** (JSON schema opcional) | Automatización downstream | Falta |

### 1.4 Completion (cierre de loops / “done”)

| Práctica | Por qué importa | Estado actual |
|----------|-----------------|----------------|
| **Estados explícitos** (nuevo, en curso, esperando cliente, resuelto) | Equipo alineado | Falta en producto (no hay CRM en este repo) |
| **Definición de “completado”** por tipo (pedido, factura, reclamo) | Menos mails “colgados” | Falta |
| **Seguimiento fuera del mail** (ticket, Sheet, CRM) | Fuente de verdad única | Fuera de alcance inmediato; **integración** es fase posterior |
| **SLA ligero** (ej. “respuesta &lt; 48h en ventas”) | Priorización | Falta métricas + reloj |

### 1.5 Response (borradores y envío)

| Práctica | Por qué importa | Estado actual |
|----------|-----------------|----------------|
| **Human-in-the-loop** antes de enviar | Riesgo legal/reputacional | OK: `draft` + aprobación; sin SMTP en v0.1 |
| **Plantillas por categoría / tono BMC** | Consistencia | Falta biblioteca de plantillas versionada |
| **No exponer datos sensibles en logs** | Seguridad | Revisar `console.error` en fetch |
| **Segundo factor para SMTP futuro** (confirmación explícita) | Menos errores | Roadmap README |

---

## 2. Principios de diseño para este proyecto

1. **Local-first:** snapshot + reportes en disco; sin subir contenido a git.
2. **Rules-first, model-second:** clasificación estable; LLM para resumen/borrador, no para clasificación crítica hasta tener golden tests.
3. **Agent-safe:** salidas con rutas fijas y JSON pequeño para PANELSIM.
4. **Progressive disclosure:** reporte corto por defecto; detalle y LLM opcionales.

---

## 3. Roadmap de implementación

### Phase 0 — Baseline y contrato (1–2 días)

| Entregable | Detalle | Criterio de aceptación |
|------------|---------|------------------------|
| **Esquema de snapshot** | Documentar campos mínimos: `messageId`, `uid`, `accountId`, `date`, `from`, `subject`, `category`, opcional `inReplyTo`, `references`, `threadKey` | `README` o `docs/DATA-MODEL.md` en repo correo |
| **`reportSchemaVersion` + `snapshotSchemaVersion`** | Enteros en `PANELSIM-STATUS.json` y cabecera del Markdown | Agentes pueden detectar cambios |
| **Guía de privacidad** | Qué no pegar en chats; retención sugerida de `data/` | Doc corto en repo correo |

### Phase 1 — Analytics más útiles (3–5 días)

| ID | Trabajo | Implementación sugerida |
|----|---------|-------------------------|
| **A1** | Threading ligero | Al parsear, extraer headers `In-Reply-To` / `References`; calcular `threadKey` (hash o root message-id); conteos por hilo opcionales en reporte |
| **A2** | Métricas por cuenta + categoría | Ya hay matriz; añadir **tasa** (msjs/día) si `daysBack` fijo |
| **A3** | `syncHealth` en STATUS | **Hecho (v0.1+):** por cuenta `ok` \| `auth_error` \| `network` \| `tls_error` \| `env_missing` \| `error`; mensaje corto en snapshot; `PANELSIM-STATUS` + `PANELSIM_EMAIL_RESULT`. |
| **A4** | Heurística “posible spam/newsletter” | Lista en `classification.json` o reglas de asunto/remitente; bandera `noiseCandidate` en mensaje |

**Aceptación:** `panelsim-update` produce STATUS con `syncHealth` y, si A1 está hecho, campos de thread en snapshot (o documentados como futuros).

### Phase 2 — Reporting (2–4 días)

| ID | Trabajo | Detalle |
|----|---------|---------|
| **R1** | Sección “Excepciones” | Top N categorías con variación vs corrida anterior (requiere archivo `snapshot-previous.json` opcional o histórico rolling) |
| **R2** | Export CSV opcional | **Hecho:** `npm run export-csv` → columnas `accountId,date,category,from,subject,messageId` |
| **R3** | Alertas configurables | En `reports.json`: umbrales (ej. `ventas` &gt; 50 en 24h) → sección o archivo `ALERTS.md` |

**Aceptación:** config documentada; al menos **R2** o **R3** en producción “internal”.

### Phase 3 — Synthesis (LLM) robusta (3–5 días)

| ID | Trabajo | Detalle |
|----|---------|---------|
| **S1** | Prompt library | **Parcial:** `config/summary-prompts.example.json` + `npm run summary -- --profile <name>`; archivo opcional `summary-prompts.json` |
| **S2** | Salida con secciones fijas | Ej.: `Hechos citados`, `Prioridades`, `Riesgos`, `Siguientes pasos sugeridos (no enviados)` |
| **S3** | Modo JSON opcional | `--json` para pipeline automatizado |
| **S4** | Tests con snapshot anonimizado | Fixture en repo (sin datos reales) para regresión de prompt |

**Aceptación:** `npm run summary` con perfil y prueba de que no inventa un pedido en fixture.

### Phase 4 — Completion (operativo, depende de proceso BMC) (ongoing)

| ID | Trabajo | Opciones |
|----|---------|----------|
| **C1** | Estados manuales | CSV/Sheet local “messageId → estado” consumido por `report` (segunda fuente) — **o** integración futura CRM/Admin Sheet |
| **C2** | Definición de “done” por categoría | Doc de negocio + checklist en `docs/team/panelsim/` |
| **C3** | SLA | Métricas solo si hay timestamps de primera respuesta (requiere tracking enviados o integración); **fase tardía** |

**Aceptación:** al menos **C2** documentado; **C1** opcional si el equipo quiere tracking ligero.

### Phase 5 — Response (borradores y envío) (variable)

| ID | Trabajo | Detalle |
|----|---------|---------|
| **P1** | Plantillas Markdown por categoría | `templates/reply-ventas.md` con variables `{{nombre}}` |
| **P2** | `draft` no interactivo con `--yes` para CI | **Hecho:** `npm run draft -- --match N --yes` |
| **P3** | SMTP opcional | Detrás de flag `BMC_EMAIL_SMTP_ENABLED`, doble confirmación, solo cuenta saliente acotada |

**Aceptación:** **P1** + **P2** sin SMTP; **P3** solo con spec de seguridad firmada.

### Phase 6 — Integración Calculadora-BMC / PANELSIM (1–2 días)

| Entregable | Detalle |
|------------|---------|
| Actualizar skill `panelsim-email-inbox` | Sección “Qué mirar primero”: STATUS → reporte → summary |
| `docs/team/panelsim/` | Runbook: “cómo se define done” + enlace a este plan |
| Opcional: variable `BMC_EMAIL_INBOX_REPO` en `.env.example` ya referenciada |

---

## 4. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Alucinaciones en resumen | Prompts con grounding; límites; sección “solo datos del reporte” |
| Fuga de PII en logs / PRs | Revisar logs; nunca commitear `data/`; redactar en ejemplos |
| Dependencia de IMAP frágil | `syncHealth` + reintentos + documentar IP/DNS (ya visto en IMAP setup) |
| Scope creep CRM | Mantener completion **documentado** o **CSV ligero** hasta haber CRM |

---

## 5. Métricas de éxito del programa

- **Tiempo de lectura** del informe ejecutivo &lt; 2 minutos para un operador.
- **Un comando** (`panelsim-update`) deja artefactos listos para el agente.
- **Cero** recomendaciones LLM sin anclaje al snapshot en pruebas de regresión.
- **Estado de sync** visible por casilla sin abrir logs.

---

## 6. Orden recomendado de ejecución

```text
Phase 0 → Phase 1 (A3 primero si hay dolor operativo) → Phase 2 (R2 útil pronto)
         → Phase 3 → Phase 5 (P1, P2) → Phase 4 según negocio → Phase 6 continuo
```

**Quick wins (implementados 2026-03-24):** A3 (`syncHealth`), R2 (CSV), P2 (`draft --yes`), S1 parcial (perfiles `summary`). Pendientes típicos: S2–S4, R3, threading.

---

## 7. Owners sugeridos

| Área | Owner típico |
|------|----------------|
| IMAP / snapshot / reportes | Dev repo `conexion-cuentas-email-agentes-bmc` |
| Reglas de negocio / categorías / “done” | Operaciones + Matias |
| Prompts LLM | MATPROMT + revisión humana |
| Integración CRM/Sheets | Planilla / Google Sheets agent |

---

*Última actualización: 2026-03-23*
