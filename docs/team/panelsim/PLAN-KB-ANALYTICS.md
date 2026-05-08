# Plan: KB Analytics endpoint + Admin coverage visual

> **Estado:** spec aprobada · pendiente de implementación.
> **Branch:** `claude/kb-management-ai-customization-Lp62C`
> **Alcance:** Fase 4 del plan global "KB multi-canal y Admin" (ver iniciativa raíz).
> **Decisiones tomadas:**
> - Privacidad de misses en producción: **Opción B opt-in** (`KB_ANALYTICS_LOG_MISS_QUESTION`, default `false`).
> - Tab Analytics actual (`/api/ai-analytics/trends`): **mergear ahora** en el endpoint nuevo, deprecar el legacy con sunset en una release.
> - Esta spec se persiste en este archivo como ancla de PRs futuros.

---

## 1. Problema

Hoy el Admin del agente (`src/components/AgentAdminModule.jsx`) muestra:

- **Stats tab**: contadores planos (total, pending, byCategory, bySource, health.score) — sin temporalidad, sin cobertura por canal, sin top-N.
- **Health tab**: listas de `stale | zeroRetrieval | mlGap` — no hay simétrico para WA, no hay timeline.
- **Analytics tab**: lee `docs/team/knowledge/events-log.jsonl` vía `/api/ai-analytics/trends` — fuente distinta (eventos curados de "knowledge environment"), no agrega los retrievals del chat ni la cobertura por canal.

Al mismo tiempo, el repo tiene infraestructura ya cableada que no se está aprovechando para visualización:

- `appendTrainingSessionEvent` registra `chat_turn` con `kbMatches:N` por turno → ✅ data para timeline de hit-rate.
- `entry.retrievalCount` y `entry.lastRetrievedAt` se actualizan en cada `findRelevantExamples` → ✅ data para top retrieved + never retrieved.
- `channelRenderer.entryNeedsMLOverride` y `getHealthEntries().mlGap` → ✅ data para coverage ML; falta paralelo WA.

**Síntoma operativo:** equipo no sabe (a) qué consultas reales del cliente están fallando, (b) qué entradas KB están "muertas", (c) cuánta cobertura tiene cada canal sin entrar a inspeccionar entradas a mano.

## 2. Goals

1. **Endpoint único** `GET /api/agent/training-kb/analytics` que subsume:
   - Stats actuales (`getTrainingStats()`).
   - Health actual (`getHealthEntries()`) + `waGap` simétrico.
   - Cobertura por canal calculada sobre `entries`.
   - Series temporales de retrieval/miss derivadas de `data/training-sessions/SESSION-*.jsonl`.
   - Datos del legacy `/api/ai-analytics/trends` (eventos de `events-log.jsonl`) bajo namespace `knowledgeEnv`.
2. **Tabs Admin consolidados**: Stats absorbe la visualización merged; tab "Analytics" se elimina; tab "Salud KB" gana sección WA.
3. **Privacidad opt-in** para captura de prompts en producción cuando `kbMatches:0`.
4. **Sin libs nuevas**: gráficos con SVG inline + divs `width:%`.
5. **Cap de costo de cómputo**: window máximo 90 días, cache 5 min, lectura por prefijo de archivo (filename ya contiene fecha).

## 3. Endpoint shape

### 3.1 Request

```
GET /api/agent/training-kb/analytics?days=30&include=knowledge_events
Authorization: Bearer <API_AUTH_TOKEN>
```

| Param | Default | Constraint | Descripción |
|---|---|---|---|
| `days` | `30` | `1 ≤ N ≤ KB_ANALYTICS_WINDOW_MAX_DAYS` (default 90) | Ventana hacia atrás |
| `include` | `kb` | `kb`, `kb,knowledge_events`, `all` | Bundles a incluir |
| `path` | (ninguno) | absoluto o relativo | Override del events-log para `knowledge_events` (paridad con legacy) |

### 3.2 Response

```jsonc
{
  "ok": true,
  "windowDays": 30,
  "generatedAt": "2026-05-07T12:34:56.000Z",
  "cacheHit": false,

  "kb": {
    "summary": {
      "totalEntries": 87,
      "activeEntries": 85,
      "pendingEntries": 2,
      "totalRetrievals": 451,        // suma retrievalCount en window
      "uniqueRetrieved": 62,
      "hitRate": 0.803,              // turns con kbMatches>0 / total turns
      "healthScore": 78
    },

    "coverageByChannel": {
      "chat": { "applicable": 85, "withOverride": null, "withGap": null, "note": "sin límite de chars" },
      "ml":   { "applicable": 85, "withOverride": 23, "withGap": 12, "withGapPct": 14.1 },
      "wa":   { "applicable": 85, "withOverride": 8,  "withGap": 19, "withGapPct": 22.4 }
    },

    "byCategory": [
      { "category": "sales",          "count": 34, "withMlOverride": 14, "withWaOverride": 5, "retrievals": 198 },
      { "category": "product",        "count": 28, "withMlOverride":  9, "withWaOverride": 3, "retrievals": 142 },
      { "category": "conversational", "count": 21, "withMlOverride":  0, "withWaOverride": 0, "retrievals":  98 },
      { "category": "math",           "count":  4, "withMlOverride":  0, "withWaOverride": 0, "retrievals":  13 }
    ],

    "bySource": [
      { "source": "manual",      "count": 41 },
      { "source": "autolearned", "count": 38 },
      { "source": "import",      "count":  8 }
    ],

    "topRetrieved":   [ { "id", "question", "category", "retrievals", "lastRetrievedAt" }, …10 ],
    "neverRetrieved": [ { "id", "question", "createdAt", "ageDays", "source" }, …10 ],

    "retrievalTimeline": [           // una fila por día en window
      { "date": "2026-04-08", "turns": 28, "kbHits": 22, "kbMisses": 6, "hitRate": 0.786 }
    ],

    "missAnalysis": {
      "totalMisses": 89,
      "totalTurns": 451,
      "missRate": 0.197,
      "missesByDay":      [ { "date", "misses" } ],
      "capturedQuestions": [         // ver §4 Privacidad
        { "question", "ts", "convId", "mode": "developer" | "production" }
      ]
    },

    "health": {
      "score": 78,
      "stale": 4,
      "zeroRetrieval": 11,
      "mlGap": 12,
      "waGap": 19,                   // NEW
      "conflicts": 2
    },

    "trends": [                      // delta vs window previo
      "Hit rate 30d: 80.3% (vs 71.2% del mes anterior, +9.1 pp)",
      "Categoría 'sales' acumula 44% de los retrievals",
      "11 entradas activas no han sido retrieveadas en 30 días",
      "WA gap en aumento: 19 entradas (+4 vs mes anterior)"
    ]
  },

  "knowledgeEnv": {                 // solo si include incluye knowledge_events
    "filePath": "/abs/path/to/events-log.jsonl",
    "parsedInWindow": 142,
    "skipped": 0,
    "byTag":    [ { "key", "count" } ],
    "bySource": [ { "key", "count" } ],
    "byWeek":   [ { "key", "count" } ],
    "decisions": { "approved": 12, "rejected": 3, "pending": 5 },
    "scoreStats": { "avg": 7.8, "min": 1, "max": 10, "n": 142 },
    "trends": [ "Tag 'pricing' acelerándose +30% vs primera mitad" ]
  }
}
```

### 3.3 Errores

| Caso | Status | Body |
|---|---|---|
| Sin `API_AUTH_TOKEN` configurado | 503 | `{ ok:false, error: "API_AUTH_TOKEN not configured" }` |
| Token inválido | 401 | `{ ok:false, error: "Unauthorized" }` |
| `days` fuera de rango | 400 | `{ ok:false, error: "days must be 1..N" }` |
| `events-log` ausente al pedir `include=knowledge_events` | 200 con `knowledgeEnv.ok=false` | merge no falla; el bloque KB sigue siendo válido |

## 4. Privacidad — captura de misses (Opción B opt-in)

### 4.1 Diseño

Hoy `agentChat.js:986-997` (línea aprox.) loga turnos en producción solo con `questionLen, responseLen, hedgeCount`. Con la flag activada:

```js
// En agentChat.js, dentro del !devMode branch del log de turn:
const logQuestion = config.kbAnalyticsLogMissQuestion && trainingExamples.length === 0;
appendTrainingSessionEvent({
  type: "chat_turn",
  mode: "production",
  provider,
  conversationId,
  turnIndex,
  questionLen: lastUserMessage.length,
  responseLen: visibleAssistantText.length,
  hedgeCount,
  // NUEVO: solo si flag on Y miss real
  ...(logQuestion ? { question: sanitizeForPrompt(lastUserMessage, 200) } : {}),
});
```

### 4.2 Configuración

`.env.example` — sumar:
```
# KB analytics — captura de prompts del cliente cuando NINGUNA entrada matchea (kbMatches:0).
# Default: false (no se loga texto en producción, solo en devMode).
# CUANDO TRUE: la pregunta se loga sanitizada y truncada a 200 chars en data/training-sessions/.
# Implicancia PII: clientes citan teléfonos / RUTs / direcciones — el flag debería estar off
# salvo que el operador acepte revisar logs y purgar PII antes de compartir corpus.
# KB_ANALYTICS_LOG_MISS_QUESTION=false

# Cap del rango de la query del endpoint /api/agent/training-kb/analytics?days=N.
# Default 90. No subir de 365 — el parseo lineal de SESSION-*.jsonl crece con N.
# KB_ANALYTICS_WINDOW_MAX_DAYS=90
```

`server/config.js` — exponer ambos flags en `config.kbAnalyticsLogMissQuestion` y `config.kbAnalyticsWindowMaxDays`.

### 4.3 Operación

- Documentar en [`docs/team/panelsim/knowledge/ML-TRAINING-SYSTEM.md`](knowledge/ML-TRAINING-SYSTEM.md) §8 nueva sección "Privacidad de prompts en producción".
- El Admin muestra `capturedQuestions` agrupadas y permite **acción explícita "+ crear KB"** que prefilea una nueva entrada con la pregunta del cliente como `question`.

## 5. UI — Stats tab refactorizado

```
┌─ ESTADÍSTICAS ──────────────────────────── [ventana: 30d ▾] [↺] ──┐
│                                                                    │
│ ┌──────┬──────────┬──────────┬─────────┬───────┐                  │
│ │Total │Pendientes│ Hit rate │ Health  │ Gaps  │                  │
│ │  87  │    2     │  80.3%   │ 78/100  │  31   │                  │
│ └──────┴──────────┴──────────┴─────────┴───────┘                  │
│                                                                    │
│ ── Cobertura por canal ──────────────────────────────────────────  │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ chat  ████████████████████████████ 85 (sin límite)             │ │
│ │ ml    ███████████ 23 ovr · ⚠ 12 gaps      [⚡ Auto-fix ML]     │ │
│ │ wa    ████  8 ovr · ⚠ 19 gaps             [⚡ Auto-fix WA]     │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ── Retrievals por día ──────────────────────────────────────────── │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ ▁▃▅▇▆▅▆▇█▇▆▅▆▇▆▅▄▆▇▇▆▅▆▇▇▆▅▆▇█  (sparkline SVG inline)        │ │
│ │ 451 turns · 362 hits (80.3%) · 89 misses                       │ │
│ │ ↑ +9.1pp vs mes anterior                                       │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ── Por categoría ──────────────────────────────────────────────── │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ sales          ████████████████ 34  (198 r · ML 14 · WA 5)    │ │
│ │ product        █████████████ 28     (142 r · ML  9 · WA 3)    │ │
│ │ conversational ██████████ 21         (98 r · ML  0 · WA 0)    │ │
│ │ math           ████ 4                (13 r)                   │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌── Por fuente ────────┐  ┌── Top recuperadas (10) ─────────────┐ │
│ │ manual         41    │  │ 1 ¿Plazo de entrega?           47   │ │
│ │ autolearned    38    │  │ 2 ¿Flete a Maldonado?          31   │ │
│ │ import          8    │  │ 3 ¿Espesor para galpón?        28   │ │
│ └──────────────────────┘  └─────────────────────────────────────┘ │
│                                                                    │
│ ── Nunca recuperadas (≥30d) ───────────────────────────────────── │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ • ¿ISOROOF en verde? (45d, manual)         [archivar]          │ │
│ │ • PIR vs EPS técnica (38d, import)         [archivar]          │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ── Misses recientes (devMode + opt-in producción) ──────────────  │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ Prompts sin match KB — candidatos a entrada nueva              │ │
│ │ • "¿tienen panel para piso?"        2026-05-05  conv 7d3a      │ │
│ │ • "descuento para 800m²?"           2026-05-04  conv b1c2      │ │
│ │                       [+ crear KB] [ver corpus completo]       │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ── Knowledge environment (events-log.jsonl) ────────────────────── │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ Tags top 5 · By source · scoreStats · trends                   │ │
│ │ (subsume el ex-tab Analytics, mismo formato actual)            │ │
│ └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### 5.1 Health tab — delta

Solo se suma una sección WA paralela a la ML existente:

```
┌─ SALUD KB ──────────────────────────────────────────┐
│  Entradas vencidas (4)            (existente)        │
│  Sin uso en 30 días (11)          (existente)        │
│  Gap canal ML (12)  [⚡ Auto-fix] (existente)        │
│  Gap canal WA (19)  [⚡ Auto-fix WA]   ← NUEVO       │
└─────────────────────────────────────────────────────┘
```

`POST /api/agent/training-kb/generate-wa-overrides` — análogo al ML existente, prompt a Haiku pidiendo síntesis ≤700 chars con tono amigable WA.

## 6. Migración del endpoint legacy

### 6.1 Estrategia

| Paso | Acción | Cuándo |
|---|---|---|
| 1 | Crear `/api/agent/training-kb/analytics` con `include=knowledge_events` que internamente llama `buildAiEnvironmentTrends()` | PR de Fase 4 |
| 2 | Migrar `AgentAdminModule.jsx` AnalyticsTab → embebida dentro del nuevo Stats tab consumiendo `kb.*` + `knowledgeEnv.*` | mismo PR |
| 3 | Eliminar `AgentAdminModule.jsx` AnalyticsTab del menú TABS (línea 1959) y borrar la función `AnalyticsTab` (líneas 1034-1129) | mismo PR |
| 4 | `/api/ai-analytics/trends` queda activo, sumar header `Deprecation: true, Sunset: 2026-08-07` | mismo PR |
| 5 | `PanelinDevPanel.jsx:163` queda apuntando al legacy (low-risk dev panel) | sin cambio en este PR |
| 6 | Migrar `PanelinDevPanel.jsx` al nuevo endpoint y eliminar `routes/aiAnalytics.js` + `lib/aiEnvironmentTrends.js` (mover su lógica a `kbAnalytics.js` si no se hizo en paso 1) | follow-up PR |

### 6.2 Consumers a tocar

```
src/components/AgentAdminModule.jsx:1043   → reemplazar por nuevo endpoint
src/components/AgentAdminModule.jsx:971-1129  → StatsTab + AnalyticsTab → Stats merged
src/components/PanelinDevPanel.jsx:163    → SIN CAMBIO en este PR (follow-up)
```

## 7. Touchpoints completos

### 7.1 Backend

| Archivo | Tipo | Cambio |
|---|---|---|
| `server/lib/trainingKB.js` | edit | extender `getTrainingStats()` y `getHealthEntries()` con `waGap` (>800 chars + !goodAnswerWA, paralelo a `mlGap`) |
| `server/lib/kbAnalytics.js` | **NEW** | helpers: `readSessionEventsInWindow(daysBack)`, `computeRetrievalTimeline(events)`, `computeMissAnalysis(events)`, `computeCoverageByChannel(entries)`, `computeTopAndNever(entries)`, `computeTrends(currWindow, prevWindow)`. Cache en módulo: `Map<string,{generatedAt,payload}>` con TTL 5 min |
| `server/routes/agentTraining.js` | edit | nuevo `GET /agent/training-kb/analytics`, nuevo `POST /agent/training-kb/generate-wa-overrides` |
| `server/routes/agentChat.js` | edit | en branch `!devMode`, si `config.kbAnalyticsLogMissQuestion && trainingExamples.length===0`, sumar `question: sanitizeForPrompt(lastUserMessage, 200)` al `appendTrainingSessionEvent` |
| `server/config.js` | edit | exponer `kbAnalyticsLogMissQuestion` (bool default false) y `kbAnalyticsWindowMaxDays` (number default 90) |
| `server/routes/aiAnalytics.js` | edit | añadir headers `Deprecation: true, Sunset: …`; sumar comentario apuntando a `/agent/training-kb/analytics` |
| `.env.example` | edit | documentar `KB_ANALYTICS_LOG_MISS_QUESTION`, `KB_ANALYTICS_WINDOW_MAX_DAYS` |
| `tests/kbAnalytics.test.js` | **NEW** | fixtures de SESSION-*.jsonl + KB entries; snapshot test del shape de respuesta; test de cache TTL; test de cap de window |

### 7.2 Frontend

| Archivo | Tipo | Cambio |
|---|---|---|
| `src/components/AgentAdminModule.jsx` `StatsTab` (~971) | rewrite | reemplaza fetch a `/agent/stats` por `/agent/training-kb/analytics?days=30&include=knowledge_events`; layout nuevo (ver §5) |
| `src/components/AgentAdminModule.jsx` `AnalyticsTab` (~1034-1129) | delete | función completa + entrada en `TABS` línea 1959 |
| `src/components/AgentAdminModule.jsx` `HealthTab` (~1244) | edit | sumar 4ª sección `waGap` con `headerAction` análogo al ML; sumar `autoFixWAGaps()` que llama al nuevo endpoint |
| `src/components/AgentAdminModule.jsx` mini-componentes | new (inline) | `KBSparkline` (SVG ~30 líneas), `KBBar` (div % ~10 líneas), `KBStatCard` (~15 líneas) |

### 7.3 Docs

| Archivo | Cambio |
|---|---|
| Este archivo | spec viva |
| `docs/team/panelsim/knowledge/ML-TRAINING-SYSTEM.md` | sumar §8 "Analytics endpoint" con shape, ventana, cache; §9 "Privacidad de prompts en producción" con flag opt-in y procedimiento de purgado |
| `.env.example` | comentarios sobre los nuevos flags (parte de §7.1) |

## 8. Test plan

### 8.1 Unit tests (`tests/kbAnalytics.test.js`)

```js
test("readSessionEventsInWindow ignores files outside window")
test("readSessionEventsInWindow caps malformed lines without crash")
test("computeRetrievalTimeline groups by day in chronological order")
test("computeMissAnalysis only includes question text in devMode and prod-with-flag")
test("computeCoverageByChannel correctly counts withGap for ml and wa")
test("getTrainingStats includes waGap symmetric to mlGap")
test("getHealthEntries includes waGap entries")
test("analytics endpoint caps days at KB_ANALYTICS_WINDOW_MAX_DAYS")
test("analytics endpoint cache TTL hits don't re-read sessions")
test("analytics endpoint with include=knowledge_events merges knowledgeEnv namespace")
```

### 8.2 Integration test

- Levantar API con `tests/setup.js`, popular KB con 5 entries (1 con override ML, 1 con override WA, 1 con goodAnswer >800, 1 con retrievalCount=0 desde 31d, 1 fresh).
- Generar SESSION-*.jsonl con 10 turnos (8 hits, 2 misses).
- Llamar `GET /api/agent/training-kb/analytics?days=30` con `Authorization: Bearer ${API_AUTH_TOKEN}`.
- Assertar: `summary.hitRate === 0.8`, `coverageByChannel.wa.withGap === 1`, `health.waGap === 1`, `topRetrieved[0].id` matches entry con más `retrievalCount`.

### 8.3 Frontend smoke

- `npm run dev:full`, login dev (Ctrl+Shift+D), navegar a Admin → Stats.
- Verificar render de las 5 cards top, sparkline, barras de coverage, by category, top retrieved.
- Click `[⚡ Auto-fix WA]` con KB que tiene 1 waGap → la entrada gana `goodAnswerWA` no vacío.
- Toggle ventana 7d / 30d / 90d → endpoint responde, UI se actualiza.

## 9. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Parseo de JSONL lento si crecen los SESSION files | Media | filename ya tiene fecha → skip antes de leer; cache 5 min en memoria; cap window 90d |
| `capturedQuestions` filtra PII si flag mal configurado | Baja-media | default off, doc explícita en `.env.example`, sanitización con `sanitizeForPrompt(200)`, recordatorio operativo en ML-TRAINING-SYSTEM.md §9 |
| `auto-fix WA` consume créditos Haiku si se dispara por error | Baja | mismo gate que ML: `requireDevModeAuth` + click manual + retorno con `processed/generated/failed` |
| Borrar AnalyticsTab rompe el bookmark/atajo de algún operador | Baja | sumar `Sunset` header al endpoint legacy; comunicación interna de la merge |
| Breaking change en shape para PanelinDevPanel | Baja | dev panel queda apuntado al legacy; migración en follow-up PR |
| Cache TTL desincroniza con cambios manuales en KB | Baja | cache key incluye `kb.updatedAt`; al `saveTrainingKB` hacer `clearAnalyticsCache()` |

## 10. Effort estimate revisado

| Sub-tarea | Estimación |
|---|---|
| Backend `kbAnalytics.js` + endpoint + waGap symmetry | 5h |
| Backend `generate-wa-overrides` + flag + config wiring | 1.5h |
| Frontend Stats refactor (layout + sparkline + bars) | 3h |
| Frontend Health WA section + auto-fix | 1h |
| Tests unit + integration + frontend smoke | 2h |
| Docs (este file + ML-TRAINING-SYSTEM §8-9 + `.env.example`) | 1h |
| **Total Fase 4** | **~13.5h** (vs estimación inicial de 3-4h optimista; merge de Analytics suma ~3h sobre el plan anterior) |

## 11. Order of operations recomendado

1. **PR 1 — Backend foundation** (5h): `waGap` symmetry + `kbAnalytics.js` + endpoint nuevo + tests unit. Sin tocar UI. Endpoint vivo y testeable con curl.
2. **PR 2 — Frontend merge** (4h): Stats tab refactor + AnalyticsTab eliminado + Health WA section. Consume el endpoint del PR 1.
3. **PR 3 — Privacy opt-in + WA auto-fix** (2.5h): `KB_ANALYTICS_LOG_MISS_QUESTION` flag + `generate-wa-overrides`. Sumar fila Misses al UI del PR 2.
4. **PR 4 — Docs + sunset legacy** (2h): este archivo + ML-TRAINING-SYSTEM §8-9 + `.env.example` + headers `Deprecation` en `/api/ai-analytics/trends`.

## 12. Out of scope (follow-ups)

- **Migración de PanelinDevPanel** al endpoint nuevo + eliminación de `aiAnalytics.js` + `aiEnvironmentTrends.js`.
- **`responseBySurface: { ml, wa, ig, email }`** mapa por entrada (vs campos sueltos) → solo si superamos 3 canales activos.
- **Indexación por canal en `findRelevantExamples`** para KB grandes (>500 entries).
- **Daily snapshot de healthScore** persistido (hoy se calcula on-the-fly desde entries; un snapshot histórico permitiría la barra "Health 30d" en sparkline).
- **Detección automática de duplicados/conflictos en `topMisses`** → si N misses parafraseados apuntan a una entrada existente, sugerir unmark o reescritura del `question` para que matchee.
