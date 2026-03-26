# Procedimiento canales — WhatsApp → Mercado Libre → Correo

**Pasos humanos uno por uno (URL + menú + “listo cuando”):** [`HUMAN-GATES-ONE-BY-ONE.md`](./HUMAN-GATES-ONE-BY-ONE.md).

**Orden fijo:** primero **WhatsApp**, segundo **Mercado Libre**, tercero **Correo**. No mezclar validación de dos canales en el mismo bloque si se puede evitar.

**Ejecución asíncrona / desatendida (leyenda [A]/[H], orden global, cron):** [`orientation/ASYNC-RUNBOOK-UNATTENDED.md`](./orientation/ASYNC-RUNBOOK-UNATTENDED.md).

### Sin intervención hasta “human gate”

| Prioridad | Comando | Qué hace |
|-----------|---------|----------|
| **1 — Paralelo (recomendado CI / agente)** | `npm run channels:automated` | Smoke prod + follow-ups **en paralelo** + snapshot programa + **primera** tarea cm-0/1/2 pendiente y pista en español (`humanGate`). Exit 1 si smoke falla. |
| **1b — Artefacto** | `npm run channels:automated -- --write` | Igual; escribe `.channels/last-pipeline.json` (gitignored). |
| **2 — Secuencial legible** | `npm run channels:onboarding` | `smoke:prod` luego `project:compass` (brújula humana). |

Cuando `humanGate.firstBlockingTask` apunte a **cm-0**, **cm-1** o **cm-2**, seguí solo la **Fase 1 / 2 / 3** de abajo; no hace falta repetir el pipeline hasta el siguiente ciclo o hasta cambiar el JSON maestro.

| Recurso | Uso |
|---------|-----|
| Programa maestro (tareas cm-0, cm-1, cm-2) | [`orientation/programs/bmc-panelin-master.json`](./orientation/programs/bmc-panelin-master.json) |
| Estado del repo | [`PROJECT-STATE.md`](./PROJECT-STATE.md) |
| Sesión / foco del día | [`SESSION-WORKSPACE-CRM.md`](./SESSION-WORKSPACE-CRM.md) |
| Comandos npm | [`AGENTS.md`](../../AGENTS.md) en la raíz |

---

## Paso 0 — Antes de cualquier canal

- [ ] `npm run channels:automated` — revisar JSON: `ok`, `humanGate`, `followups`.
- [ ] (Opcional) `npm run project:compass` — misma brújula que en onboarding secuencial.
- [ ] (Opcional) `npm run smoke:prod` — solo si querés salida humana del smoke sin el pipeline JSON.
- [ ] Variables sensibles solo en `.env` / Cloud Run, nunca en el chat.

---

## Fase 1 — WhatsApp (cerrar E2E → planilla)

**Tarea programa:** **cm-0** (E2E WhatsApp → fila CRM en Cloud Run).

### Automático / CLI

- [ ] `npm run smoke:prod` (o `BMC_API_BASE=... npm run smoke:prod`).

### Meta (navegador)

- [ ] Webhook: URL `.../webhooks/whatsapp` (mismo servicio que el smoke).
- [ ] Token de verificación = `WHATSAPP_VERIFY_TOKEN` en el despliegue.
- [ ] Campo webhook **`messages`** suscrito (v25.x).

### Teléfono

- [ ] Enviar **texto** de prueba desde un número permitido por el modo de la app (dev vs live).

### Verificación

- [ ] Logs del servicio: POST webhook **200**, logs `[WA]` sin error.
- [ ] Tras ventana de **inactividad** (o disparador manual si aplica): fila en **CRM_Operativo** / **Form** coherente, origen **WA-Auto** (o equivalente).

### Cierre

- [ ] Marcar **cm-0** `done` en `bmc-panelin-master.json` si el E2E está probado.
- [ ] Una línea en `SESSION-WORKSPACE-CRM.md` §2.
- [ ] Si hubo cambio relevante para el equipo: `PROJECT-STATE.md` → Cambios recientes.

**No pasar a Fase 2** hasta tener al menos una fila CRM verificada o un fallo documentado con logs.

---

## Fase 2 — Mercado Libre (OAuth + API)

**Tarea programa:** **cm-1** (ML OAuth y tokens en prod verificados).

### Preparación

- [ ] API local: `npm run start:api` **o** validar contra Cloud Run con `BMC_API_BASE`.

### OAuth y verificación

- [ ] Guía: [`docs/ML-OAUTH-SETUP.md`](../ML-OAUTH-SETUP.md).
- [ ] `npm run ml:verify` (comprueba `/health` y flujo OAuth según script).
- [ ] `GET /auth/ml/status` → **200** con token en el entorno objetivo (o completar OAuth en navegador hasta que lo esté).

### Prueba mínima de negocio

- [ ] Endpoint acordado por el equipo (p. ej. `/ml/questions` o script de sync) con **401 resuelto** → datos o lista vacía coherente.

### Cierre

- [ ] Marcar **cm-1** según criterio del equipo.
- [ ] SESSION §2 + JSON maestro.

**No pasar a Fase 3** hasta que ML esté usable para la operación que definieron (preguntas, sync, etc.).

---

## Fase 3 — Correo (snapshot → CRM)

**Tarea programa:** **cm-2** (bridge snapshot ventas → `ingest-email` → CRM).

### Snapshot IMAP

- [ ] Repo correo: `npm run panelsim:email-ready` desde Calculadora-BMC **o** `panelsim-update` en el repo hermano.
- [ ] Existe `data/snapshot-latest.json` (o ruta en `BMC_EMAIL_SNAPSHOT_PATH`).

### API con IA + Sheets

- [ ] `npm run start:api` con `.env` (keys IA + `GOOGLE_APPLICATION_CREDENTIALS` + `BMC_SHEET_ID`).

### Ingest (siempre probar antes)

- [ ] `npm run email:ingest-snapshot -- --dry-run --limit 5`
- [ ] `npm run email:ingest-snapshot -- --limit 1` — una fila real y revisión en CRM.

### Cierre

- [ ] **cm-2** en JSON maestro.
- [ ] SESSION + PROJECT-STATE si el flujo queda operativo.

---

## Comando único: onboarding automatizado (CLI)

Desde la raíz del repo:

```bash
npm run channels:onboarding
```

Ejecuta en secuencia:

1. `npm run smoke:prod`
2. `npm run project:compass`

Opciones:

```bash
npm run channels:onboarding -- --skip-smoke
npm run channels:onboarding -- --skip-compass
```

No sustituye los pasos manuales (Meta, teléfono, OAuth en navegador); deja el **estado del servicio** y la **brújula del programa** listos y remite a **este documento** para el resto.

---

## Lectura relacionada

- Webhook WA: `server/index.js` — `GET/POST /webhooks/whatsapp`.
- Ingest correo: `POST /api/crm/ingest-email` — `server/routes/bmcDashboard.js`; CLI `npm run email:ingest-snapshot`.
- ML: rutas `/auth/ml/*`, `/ml/*` — `server/index.js`; skill `.cursor/skills/bmc-mercadolibre-api/SKILL.md`.
