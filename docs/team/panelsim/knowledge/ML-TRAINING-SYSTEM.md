# Sistema de entrenamiento Mercado Libre — BMC (consultas + documentos)

**Propósito:** Un solo lugar que define **cómo capturar todas las consultas**, **qué documentos usar** y **cómo entrenar** (humanos, PANELSIM o modelos) con evidencia del marketplace **sin perder el hilo** entre KB, simulación y auditoría.

**Audiencia:** Matias, equipo comercial, Integrations, PANELSIM, SIM-REV.

---

## 1. Mapa de documentos y artefactos

| Qué | Dónde | Para qué sirve |
|-----|--------|-----------------|
| **Voz, métricas y reglas** (historial analizado) | [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md) | Base de conocimiento + checklist; alimenta prompts y simulaciones. |
| **Plataforma ML** (publicaciones, envíos, reputación, MP/Ads — marco operativo) | [`ML-PLATAFORMA-BUENAS-PRACTICAS-BMC.md`](./ML-PLATAFORMA-BUENAS-PRACTICAS-BMC.md) | Complemento al KB de respuestas; enlaces oficiales; qué hace el repo vs el panel vendedor. |
| **Simulación en ciego por tandas de 10** | [`../reports/ML-SIM-ITERATIVE-BLIND-IMPROVEMENT.md`](../reports/ML-SIM-ITERATIVE-BLIND-IMPROVEMENT.md) | Mejora iterativa: modelo/KB vs respuesta humana, tanda a tanda. |
| **Auditoría automática (preguntas + órdenes + IA)** | `npm run ml:ai-audit` → informes `ML-AI-AUDIT-REPORT-*.md` en [`../reports/`](../reports/) | Panorama operativo y recomendaciones; no sustituye el KB ni las tandas. |
| **Export de tanda (ciego o gold)** | `npm run ml:sim-batch` | JSON por offset/limit para una tanda concreta. |
| **Export del corpus completo** | `npm run ml:corpus-export` | **Captura total** de consultas (y respuestas) para entrenamiento, RAG o backup. Ver §3. |
| **Gold runs (borrador IA → respuesta humana → Panelin)** | [`reports/ml-gold-runs/`](./reports/ml-gold-runs/) | Tabla versionada de Q:id + pregunta + borrador + columna **gold**; tras corrección, `POST /api/agent/train` (ver [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md) §11). |
| **Cálculo / no inventar precios** | [`../../knowledge/Calc.md`](../../knowledge/Calc.md) | Obligatorio en cotizaciones asistidas. |
| **Identidad PANELSIM** | [`../AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md) | Límites y modo aprobación. |

---

## 2. Flujo de entrenamiento recomendado

```
[1] Corpus completo     →  ml:corpus-export (captura JSON local)
[2] KB y reglas         →  ML-RESPUESTAS-KB-BMC.md (actualizar cuando cambie el negocio)
[3] Simulación tandas   →  ml:sim-batch blind → responder con KB → gold → comparar
[4] Auditoría periódica →  ml:ai-audit (visión + órdenes)
[5] Mejoras             →  actualizar KB / prompts / CRM rules → repetir desde [3]
```

- **Onboarding humano:** leer KB §1–§4 + completar **una** tanda piloto en [`../reports/ml-sim-runs/`](../reports/ml-sim-runs/).
- **Modelo asistido:** inyectar en system prompt: resumen del KB + “no inventar precios” + checklist del KB §7.

---

## 3. Captura completa de consultas (corpus)

### Comando

```bash
npm run start:api    # otra terminal si hace falta
npm run ml:corpus-export
```

Opciones:

- **`--out /ruta/archivo.json`** — destino explícito.
- **`--minimal`** — recorta textos (muestras cortas); útil para vistas rápidas sin guardar mensajes largos.
- **`BMC_API_BASE`** — si la API no está en `http://127.0.0.1:3001`.

**Salida por defecto:** `docs/team/panelsim/reports/ml-corpus/exports/ML-CORPUS-FULL-<timestamp>.json`

### Privacidad y uso

- El archivo **full** puede incluir **texto de compradores** y datos de mensajería ML.
- **No** publicar en repos abiertos ni compartir sin necesidad.
- Los archivos bajo `exports/` están **ignorados por git** (ver `.gitignore`) para evitar commits accidentales; la captura se **regenera** con el comando cuando haga falta.

### Uso para “training system”

| Uso | Cómo |
|-----|------|
| **Práctica humana** | Importar muestras a hoja o LMS; comparar con columna “modelo KB”. |
| **RAG / asistente** | Fragmentar `buyer_text` + `answer.text` en chunks; etiquetar por `item_id` / intención. |
| **Eval de modelo** | Hold-out por fechas; medir alineación con respuesta humana (no siempre “igual”, sí política BMC). |
| **Backup operativo** | Guardar JSON en almacenamiento privado (Drive cifrado, etc.). |

---

## 4. Relación con la API

- Preguntas: `GET /ml/questions` (paginado) — mismo origen que el análisis del KB.
- Órdenes (para contexto de conversión): `GET /ml/orders` — usado en `ml:ai-audit`, no en `ml:corpus-export`.

---

## 5. Checklist: “¿está armado el sistema de entrenamiento?”

- [ ] API local con OAuth ML OK (`npm run ml:verify` o `/auth/ml/status`).
- [ ] KB [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md) revisado al menos trimestralmente.
- [ ] Corpus exportado cuando haya cambios fuertes de política o de catálogo.
- [ ] Al menos una tanda documentada en `ml-sim-runs/` o plan explícito para hacerlas.
- [ ] `ml:ai-audit` corrido tras cambios grandes en logística o en volumen de consultas.

---

## 6. Mantenimiento

| Frecuencia | Acción |
|------------|--------|
| Mensual | Correr `ml:ai-audit` o revisar informe más reciente. |
| Tras cambios de precios / envío | Actualizar KB + re-export corpus si entrenás modelos. |
| Por sprint comercial | Cerrar 1–2 tandas de simulación en ciego y archivar conclusiones. |

---

*Este documento es el **hub** del sistema; los demás archivos enlazados conservan el detalle técnico.*
