# Panelin Evolution — Flujo completo

**Propósito:** Documentar el ecosistema Invoque Panelin: proxy, collector, viewer y APIs externas.

---

## 1. Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  BMC Dashboard (3001)                                           │
│  Finanzas, Operaciones, Ventas, Stock, KPI Report               │
│  Link "Abrir Invoque Panelin" ──────────────────────────────┐  │
└───────────────────────────────────────────────────────────────│──┘
                                                                │
                                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Panelin Evolution (3847)                                        │
│  Viewer: Panorama, KPIs, Consultas, Calculadora BMC,           │
│          Invocar a Panelin (GPT Sim)                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Chat: pregunta → usuario responde → siguiente campo      │   │
│  │  Fallback: "respuesta rápida" cuando OpenAI falla        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
       │                                    │
       │ POST /api/chat                     │ POST /calc/cotizar
       ▼                                    │ POST /calc/cotizar/pdf
┌──────────────────┐                        │
│  Proxy OpenAI    │                        │
│  (3848)          │                        │
│  → api.openai.com│                        │
└──────────────────┘                        ▼
                              ┌──────────────────────────────┐
                              │  Cloud Run Calculator API     │
                              │  panelin-calc-642127786762    │
                              │  /calc/cotizar, /calc/cotizar/pdf│
                              └──────────────────────────────┘
```

---

## 2. Componentes

### 2.1 Proxy OpenAI (3848)

**Ubicación:** `~/.panelin-evolution/proxy-openai.js`  
**Script:** `./run_proxy_openai.sh` (desde Calculadora-BMC)

| Aspecto | Detalle |
|---------|---------|
| Puerto | 3848 |
| Endpoint | `POST /api/chat` |
| Entrada | `{ messages, system?, model? }` |
| Salida | `{ ok: true, text }` o `{ ok: false, error }` |
| Modelos | gpt-4o-mini (default), gpt-4o |
| Requiere | `OPENAI_API_KEY` en .env o env |

**Por qué existe:** El viewer (3847) llama al proxy para evitar CORS al llamar directo a api.openai.com.

### 2.2 Panelin Evolution Viewer (3847)

**Ubicación:** `~/.panelin-evolution/viewer/`  
**Script:** `./run_invoque_panelin.sh` o `~/.panelin-evolution/launch.sh`

| URL | Vista |
|-----|-------|
| http://localhost:3847/viewer/ | Panorama |
| http://localhost:3847/viewer/#gpt-sim | Invocar a Panelin (chat GPT) |

**Funcionalidad:** Chat guiado para extraer params (escenario, familia, espesor, color, dimensiones, bordes, etc.) y llamar a API de cotización.

### 2.3 Collector (collect.js)

**Ubicación:** `~/.panelin-evolution/collect.js`  
**Salida:** `~/.panelin-evolution/data/snapshots/YYYY-MM-DD.json`, `latest.json`

**Recolecta:**
- Commits de 4 repos (Calculadora-BMC, Panelin1103, Calculadora-BMC-GPT, GPT_Panelin)
- Streams: calculator-core, ui-ux, backend-api, gpt-integration, testing, ci-devops, integrations, documentation, skills, fiscal
- KPIs: velocidad, líneas, tipos commit, horarios, hotspots, coupling, sesiones, streak
- Transcripts de agentes Cursor
- Inventario de skills

### 2.4 Cloud Run Calculator API

**URL:** `https://panelin-calc-642127786762.us-central1.run.app`  
**Endpoints:** `/calc/cotizar`, `/calc/cotizar/pdf`, `/calc/catalogo`, `/calc/escenarios`

---

## 3. Flujo de cotización (Invocar a Panelin)

1. Usuario abre gpt-sim (3847/viewer/#gpt-sim)
2. Sistema pregunta por campos: escenario, familia_techo, espesor_techo, color_techo, largo, ancho, tipoEst, borde_frente, borde_fondo, inclSell
3. **Si OpenAI funciona:** GPT genera preguntas conversacionales
4. **Si OpenAI falla (cuota, etc.):** Fallback "respuesta rápida" — parseo por reglas (ej. "solo techo" → escenario, "150" → espesor)
5. Cuando todos los campos están completos → `POST /calc/cotizar` a Cloud Run
6. Respuesta: BOM, resumen, texto WhatsApp, advertencias
7. Usuario puede pedir "PDF" → `POST /calc/cotizar/pdf` → URL del PDF

---

## 4. Troubleshooting

### Error: "You exceeded your current quota"

**Causa:** Cuota de OpenAI agotada (plan o billing).

**Acción:** Verificar en https://platform.openai.com/account/billing y plan.

**Mientras tanto:** El flujo sigue funcionando con el fallback "respuesta rápida" — el usuario responde con valores directos (ej. "solo techo", "isodec eps", "150") y el sistema los parsea sin GPT.

### Error: "localhost:3847 rechazó la conexión"

**Causa:** Panelin Evolution no está corriendo.

**Acción:** `./run_invoque_panelin.sh` o `~/.panelin-evolution/launch.sh`

### Error: Chat no responde / preguntas vacías

**Causa:** Proxy OpenAI (3848) no está corriendo o OPENAI_API_KEY no definido.

**Acción:** `OPENAI_API_KEY=sk-xxx ./run_proxy_openai.sh`  
**Nota:** El fallback "respuesta rápida" permite completar la cotización sin proxy.

---

## 5. Referencias

- `docs/team/INVOQUE-PANELIN-ESTADO.md` — Estado y ubicación
- `~/.panelin-evolution/` — Código del viewer, proxy, collector
- `run_proxy_openai.sh`, `run_invoque_panelin.sh` — Scripts de arranque

---

**Última actualización:** 2026-03-19
