# Networks & Development Agent — Ejemplos de Uso

Prompts y escenarios que activan el skill `networks-development-agent`.

---

## 1. Análisis de hosting

**Prompt:**
> Evalúa si nuestro servicio de hosteo (Netuy VPS / Cloud Run) puede aprovecharse mejor para el dashboard BMC. Revisa documentación del proveedor, cruza con uso actual y documenta capacidad ociosa y upgrade paths.

**Estructura esperada:**
- CONTEXTO: dominio=hosting, alcance=evaluación
- ARTEFACTOS: HOSTING-EN-MI-SERVIDOR.md, /api/server-export
- OUTPUT: reporte con resumen, tabla de planes/límites, recomendaciones

---

## 2. Almacenamiento de datos

**Prompt:**
> ¿Podemos usar el almacenamiento del host para logs persistentes, cache de Sheets o backups de AUDIT_LOG? Evalúa sin proponer migración de datos críticos sin plan de rollback.

**Estructura esperada:**
- CONTEXTO: dominio=storage, alcance=evaluación
- RIESGOS: no migrar datos críticos sin validación
- OUTPUT: propuesta técnica con opciones (disco local, GCS, ML_TOKEN_STORAGE)

---

## 3. Email como canal inbound

**Prompt:**
> Evalúa Gmail API o IMAP para usar el mail como canal inbound: consultas de clientes, notificaciones logísticas, leads. Define flujos hacia CRM/Sheets y coordinación.

**Estructura esperada:**
- CONTEXTO: dominio=email, alcance=propuesta
- ARTEFACTOS: Gmail API docs (web browsing)
- OUTPUT: plan con flujos, OAuth, parsing, integración con /api/coordinacion-logistica

---

## 4. Plan de migración

**Prompt:**
> Documenta procedimientos y riesgos para migrar el dashboard de ngrok a hosting propio en Netuy. Incluye checklist de backup, rollback y validación post-migración.

**Estructura esperada:**
- CONTEXTO: dominio=migration, alcance=plan
- RIESGOS: ML_REDIRECT_URI_DEV, downtime, drift de config
- OUTPUT: checklist ordenado, dependencias, monitoreo

---

## 5. Descubrimiento de servicios

**Prompt:**
> Revisa qué APIs o capacidades de Google Cloud, MercadoLibre y Shopify no estamos usando. Prioriza por impacto vs esfuerzo.

**Estructura esperada:**
- CONTEXTO: dominio=discovery, alcance=evaluación
- ARTEFACTOS: reference.md, docs de proveedores (web browsing)
- OUTPUT: tabla de APIs no usadas, webhooks disponibles, recomendaciones priorizadas

---

## 6. Prompt estructurado (plantilla)

```
## CONTEXTO
- Dominio: [hosting | storage | email | migration | discovery]
- Alcance: [evaluación | propuesta | plan | implementación]
- Restricciones: [presupuesto, tiempo, compliance]

## OBJETIVO
[Pregunta o tarea en una frase. Criterios de éxito.]

## ARTEFACTOS
- docs/bmc-dashboard-modernization/DASHBOARD-VISUAL-MAP.md
- .cursor/skills/networks-development-agent/reference.md
- curl http://localhost:3849/api/server-export (si el servidor está levantado)

## FORMATO DE SALIDA
- Resumen ejecutivo (3–5 líneas)
- Hallazgos (tabla o lista)
- Recomendaciones (alto/medio/bajo impacto)
- Próximos pasos
- Riesgos y mitigaciones
```
