# PANELSIM — Estado de sesión (full run)

**Generado (UTC):** 2026-03-25T09-41-21Z
**Repo Calculadora-BMC:** `/Users/matias/Panelin calc loca/Calculadora-BMC`

## Resumen ejecutivo

| Área | Estado |
|------|--------|
| `.env` (env:ensure si falta) | ok |
| Planillas / Google (ensure-panelsim-sheets-env) | omitido |
| Correo IMAP + reporte (panelsim-email-ready) | omitido |
| API local (http://127.0.0.1:3001) | HTTP health: **000** — curl no disponible o --no-start-api / API offline |
| MATRIZ vía API | GET /api/actualizar-precios-calculadora → **n/d** |
| ML → CRM sync (preguntas pendientes) | omitido (API no disponible) |
| ML OAuth verify (`ml:verify` / verify-ml-oauth) | omitido (API no disponible) |
| Programa + compass (`project:compass`) | ok |
| Canales + smoke prod + humanGate (`channels:automated`) | ok |
| UI Vite (:5173) | No se arranca en este script; usá `npm run dev` o `npm run dev:full` si necesitás la calculadora en navegador. |

## 0. Crear `.env` si falta (`npm run env:ensure`)

```text
.env ya existe — no se modifica.
```

## 1. Planillas y credenciales

_Omitido (--skip-sheets)._

## 2. Correo

_Omitido (--skip-email)._

## 3. API y Mercado Libre

- **Health:** `000`
- **GET /auth/ml/status** (extracto):

```json
(vacío o API no disponible)
```

- **GET /capabilities** (primeros caracteres):

```
(vacío o API no disponible)
```

## 4. ML → CRM sync

```text
(sin salida)
```

## 5. Bootstrap automático (Mercado Libre + programa + canales)

Modo **completo** (default): `ml:verify` (`scripts/verify-ml-oauth.sh` con `BMC_API_BASE=http://127.0.0.1:3001`), `project:compass`, `channels:automated` (incluye smoke a prod). Modo **--quick**: omitido.

### 5.1 ML OAuth verify

```text
```

### 5.2 project:compass (últimas ~120 líneas)

```text

════════════════════════════════════════════════════════════════
  BMC / Panelin — programa maestro (multi-área)
  Actualizado: 2026-03-26 · Horizonte ~24 sem
════════════════════════════════════════════════════════════════

ALTURA (fases)
    p1  [DONE]  Fundaciones (repo, API, Sheets, CI)  (~2-6 sem)
>>> p2  [ACTIVE]  Operación comercial integrada (CRM, ML, canales)  (~6-16 sem)
    p3  [PLANNED]  Escala, riesgos y cumplimiento  (~8-24 sem)

Fase actual: Operación comercial integrada (CRM, ML, canales)
  PANELSIM, ML OAuth, CRM_Operativo, sugerencias IA, WhatsApp/email hacia CRM.
  Criterios de salida:
    - Flujo ML→CRM estable o gobernado
    - Webhook WA + parse conversación/email con camino claro a Sheets
    - E2E smoke en prod para rutas críticas /api y /ml

PROGRESO (tareas en todos los streams)
  5 / 11 hechas  →  ~45% por cantidad de tareas
  17h / 55h estimadas  →  ~31% por esfuerzo (estHours)

Stream · Producto / Calculadora / MATRIZ  (1/2)
  [done   ] Gate local + build limpio antes de releases frecuentes ~2h
  [todo   ] SKUs MATRIZ col.D vs placeholders calculadora — cierre o reglas ~8h

Stream · CRM / ML / WhatsApp / correo  (1/4)
  [doing  ] E2E WhatsApp → fila CRM visible en planilla (Cloud Run) ~2h
  [doing  ] ML OAuth y tokens en prod (GCS) verificados ~4h
  [doing  ] Bridge email ingest (snapshot ventas → ingest-email → CRM) ~12h
  [done   ] E2E smoke prod: /health, /capabilities, /api/crm/suggest-response (sample) ~8h

Stream · Infra / Cloud Run / seguridad  (1/2)
  [done   ] PUBLIC_BASE_URL + APP_ENV en producción alineados a URL pública ~2h
  [todo   ] Rotación/revisión de API keys si hubo exposición (checklist Security) ~4h

Stream · Fiscal / DGI / proceso mensual  (0/1)
  [todo   ] Carpeta expediente + próximos hitos con contador/abogado ~8h

Stream · Orientación y seguimiento de programa (meta)  (2/2)
  [done   ] Hub orientation + programa JSON + npm run program:status ~4h
  [done   ] Ritual semanal: npm run channels:automated o project:compass + JSON + SESSION ~1h

PRÓXIMOS PASOS SUGERIDOS (prioridad simple: doing → menor estHours)
  1. [CRM / ML / WhatsApp / correo] E2E WhatsApp → fila CRM visible en planilla (Cloud Run)
  2. [CRM / ML / WhatsApp / correo] ML OAuth y tokens en prod (GCS) verificados
  3. [CRM / ML / WhatsApp / correo] Bridge email ingest (snapshot ventas → ingest-email → CRM)
  4. [Infra / Cloud Run / seguridad] Rotación/revisión de API keys si hubo exposición (checklist Security)
  5. [Producto / Calculadora / MATRIZ] SKUs MATRIZ col.D vs placeholders calculadora — cierre o reglas
  6. [Fiscal / DGI / proceso mensual] Carpeta expediente + próximos hitos con contador/abogado

PUNTOS DE CONVERGENCIA
  · Cada revisión Cloud Run / release
      npm run pre-deploy | npm run test:contracts
  · Full team run (Invoque full team)
      docs/team/INVOQUE-FULL-TEAM.md | docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md
  · Revisión semanal CEO (15 min)
      npm run channels:automated | npm run project:compass | npm run smoke:prod | docs/team/SESSION-WORKSPACE-CRM.md

════════════════════════════════════════════════════════════════
Editá el JSON para actualizar: docs/team/orientation/programs/bmc-panelin-master.json


────────────────────────────────────────────────────────────────
FOLLOW-UPS (vencidos / hoy)
────────────────────────────────────────────────────────────────
No follow-ups due (open items may be snoozed to the future).

────────────────────────────────────────────────────────────────
RUTINA MÍNIMA (≈5 min)
────────────────────────────────────────────────────────────────
  1. Elegir 1 tarea de «PRÓXIMOS PASOS» arriba y cerrar o avanzar.
  2. Si hay follow-ups: procesar o posponer (`npm run followup -- snooze <id> --days N`).
  3. Actualizar JSON maestro al cerrar tareas: docs/team/orientation/programs/bmc-panelin-master.json
  4. Resumen breve en docs/team/SESSION-WORKSPACE-CRM.md §2 si hubo avance.

Documento único de cronograma + enlaces: docs/team/PROJECT-SCHEDULE.md

```

### 5.3 channels:automated (JSON completo)

```json
{
  "ok": true,
  "generatedAt": "2026-03-25T09:41:31.535Z",
  "parallel": {
    "smokeMs": 9696,
    "followupsMs": 0,
    "programMs": 0,
    "note": "smoke y follow-ups corrieron en paralelo; programa leído después (disco)."
  },
  "smoke": {
    "ok": true,
    "base": "https://panelin-calc-q74zutv7dq-uc.a.run.app",
    "at": "2026-03-25T09:41:31.522Z",
    "checks": [
      {
        "path": "/health",
        "status": 200,
        "ok": true,
        "note": "servicio vivo"
      },
      {
        "path": "/capabilities",
        "status": 200,
        "ok": true,
        "note": "manifest agentes"
      },
      {
        "path": "public_base_url",
        "status": 200,
        "ok": true,
        "note": "coincide con la base del smoke"
      },
      {
        "path": "/auth/ml/status",
        "status": 404,
        "ok": true,
        "note": "sin token ML (normal hasta OAuth)"
      },
      {
        "path": "POST /api/crm/suggest-response",
        "status": 200,
        "ok": true,
        "note": "IA ok (grok)"
      }
    ]
  },
  "followups": {
    "ok": true,
    "count": 0,
    "items": []
  },
  "program": {
    "ok": true,
    "programId": "bmc-panelin-master",
    "title": "BMC / Panelin — programa maestro (multi-área)",
    "updatedAt": "2026-03-26",
    "currentPhaseId": "p2",
    "currentPhase": {
      "id": "p2",
      "name": "Operación comercial integrada (CRM, ML, canales)",
      "status": "active",
      "summary": "PANELSIM, ML OAuth, CRM_Operativo, sugerencias IA, WhatsApp/email hacia CRM.",
      "exitCriteria": [
        "Flujo ML→CRM estable o gobernado",
        "Webhook WA + parse conversación/email con camino claro a Sheets",
        "E2E smoke en prod para rutas críticas /api y /ml"
      ]
    },
    "phases": [
      {
        "id": "p1",
        "name": "Fundaciones (repo, API, Sheets, CI)",
        "status": "done",
        "order": 1
      },
      {
        "id": "p2",
        "name": "Operación comercial integrada (CRM, ML, canales)",
        "status": "active",
        "order": 2
      },
      {
        "id": "p3",
        "name": "Escala, riesgos y cumplimiento",
        "status": "planned",
        "order": 3
      }
    ],
    "progress": {
      "done": 5,
      "total": 11,
      "pct": 45,
      "doneHours": 17,
      "totalHours": 55,
      "pctWeighted": 31
    },
    "nextTasks": [
      {
        "id": "cm-0",
        "title": "E2E WhatsApp → fila CRM visible en planilla (Cloud Run)",
        "status": "doing",
        "streamId": "crm_ml",
        "streamName": "CRM / ML / WhatsApp / correo",
        "estHours": 2,
        "dependsOn": []
      },
      {
        "id": "cm-1",
        "title": "ML OAuth y tokens en prod (GCS) verificados",
        "status": "doing",
        "streamId": "crm_ml",
        "streamName": "CRM / ML / WhatsApp / correo",
        "estHours": 4,
        "dependsOn": []
      },
      {
        "id": "cm-2",
        "title": "Bridge email ingest (snapshot ventas → ingest-email → CRM)",
        "status": "doing",
        "streamId": "crm_ml",
        "streamName": "CRM / ML / WhatsApp / correo",
        "estHours": 12,
        "dependsOn": []
      },
      {
        "id": "in-2",
        "title": "Rotación/revisión de API keys si hubo exposición (checklist Security)",
        "status": "todo",
        "streamId": "infra",
        "streamName": "Infra / Cloud Run / seguridad",
        "estHours": 4,
        "dependsOn": []
      },
      {
        "id": "pc-2",
        "title": "SKUs MATRIZ col.D vs placeholders calculadora — cierre o reglas",
        "status": "todo",
        "streamId": "product_calc",
        "streamName": "Producto / Calculadora / MATRIZ",
        "estHours": 8,
        "dependsOn": []
      },
      {
        "id": "fi-1",
        "title": "Carpeta expediente + próximos hitos con contador/abogado",
        "status": "todo",
        "streamId": "fiscal",
        "streamName": "Fiscal / DGI / proceso mensual",
        "estHours": 8,
        "dependsOn": []
      }
    ],
    "convergencePoints": [
      {
        "id": "cp-deploy",
        "name": "Cada revisión Cloud Run / release",
        "refs": [
          "npm run pre-deploy",
          "npm run test:contracts"
        ]
      },
      {
        "id": "cp-full-team",
        "name": "Full team run (Invoque full team)",
        "refs": [
          "docs/team/INVOQUE-FULL-TEAM.md",
          "docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md"
        ]
      },
      {
        "id": "cp-weekly-ceo",
        "name": "Revisión semanal CEO (15 min)",
        "refs": [
          "npm run channels:automated",
          "npm run project:compass",
          "npm run smoke:prod",
          "docs/team/SESSION-WORKSPACE-CRM.md"
        ]
      }
    ]
  },
  "channelTasks": [
    {
      "id": "cm-0",
      "title": "E2E WhatsApp → fila CRM visible en planilla (Cloud Run)",
      "status": "doing",
      "streamName": "CRM / ML / WhatsApp / correo"
    },
    {
      "id": "cm-1",
      "title": "ML OAuth y tokens en prod (GCS) verificados",
      "status": "doing",
      "streamName": "CRM / ML / WhatsApp / correo"
    },
    {
      "id": "cm-2",
      "title": "Bridge email ingest (snapshot ventas → ingest-email → CRM)",
      "status": "doing",
      "streamName": "CRM / ML / WhatsApp / correo"
    }
  ],
  "humanGate": {
    "firstBlockingTask": {
      "id": "cm-0",
      "title": "E2E WhatsApp → fila CRM visible en planilla (Cloud Run)",
      "status": "doing",
      "streamName": "CRM / ML / WhatsApp / correo"
    },
    "hint": {
      "phase": "whatsapp",
      "messageEs": "Intervención humana: Meta (webhook/token), teléfono de prueba, fila en planilla. Ver docs/team/PROCEDIMIENTO-CANALES-WA-ML-CORREO.md Fase 1 y WHATSAPP-META-E2E.md si está en el repo."
    }
  },
  "docs": {
    "procedure": "docs/team/PROCEDIMIENTO-CANALES-WA-ML-CORREO.md"
  }
}
```

## 6. Próximos pasos sugeridos

- **Calculadora en el navegador:** `npm run dev` (puerto 5173 típico) o `npm run dev:full` (API+Vite si preferís un solo comando y no usás el API ya levantado).
- **OAuth ML:** si `/auth/ml/status` indica sin token, abrí `/auth/ml/start` según `docs/ML-OAUTH-SETUP.md`.
- **Canales humanos (cm-0/1/2):** ver `humanGate` en el JSON de §5.3 y `docs/team/HUMAN-GATES-ONE-BY-ONE.md`.
- **Sesión más rápida:** `npm run panelsim:session -- --quick` (sin compass, sin smoke prod, sin env:ensure al inicio).
- **Detener API** iniciada por este script: `kill $(cat /tmp/panelsim-session-api.pid)` (solo si se creó PID en esta corrida).

