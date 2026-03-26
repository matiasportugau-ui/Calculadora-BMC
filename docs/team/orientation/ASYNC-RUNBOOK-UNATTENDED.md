# Runbook asíncrono — proceso de punta a punta sin depender de Matias en cada paso

**Propósito:** Una sola lectura para **agentes, CI u operadores** que ejecuten el programa **en orden**, sepan **qué corre solo**, **qué requiere humano una sola vez** y **cuándo se considera “fin del proceso”** para el stream comercial (cm-0, cm-1, cm-2).

**Pasos humanos concretos (enlace + pantalla + criterio de listo):** [`../HUMAN-GATES-ONE-BY-ONE.md`](../HUMAN-GATES-ONE-BY-ONE.md).

**No reemplaza** el checklist detallado por canal: [`../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md). Este archivo **ordena y clasifica** el trabajo para ejecución **asíncrona / desatendida** donde el repo ya lo permite.

---

## 1. Leyenda de participación

| Etiqueta | Significado |
|----------|-------------|
| **[H0]** | Intervención humana **una sola vez** (bootstrap): secretos, Meta, OAuth en navegador, compartir planilla con service account. |
| **[H]** | Intervención humana **ocasional**: revisar una fila en Sheets, decidir si un fallo es aceptable, rotar keys. |
| **[A]** | **Totalmente automatizable** en máquina: CLI, cron, CI, sin preguntas al titular. |
| **[A\|H]** | Automático si **[H0]** ya se cumplió; si no, falla con error claro (no inventar credenciales). |

**“Fin del proceso” comercial (p2, tareas cm-0…cm-2)** — criterio operativo:

1. **[A]** `npm run smoke:prod` → **éxito** (API prod + `suggest-response` con IA).
2. **[H]** o **[A]**: al menos **una** fila **WA-Auto** verificada en CRM (cm-0), o **fallo documentado** con logs.
3. **[H0]+[A]**: ML OAuth/tokens válidos en prod; `GET /auth/ml/status` coherente (cm-1).
4. **[A|H]**: `email:ingest-snapshot` ejecutable contra snapshot + API, con al menos **una** ingesta real revisada (cm-2).

Hasta que **[H0]** no esté hecho, los pasos **[A]** pueden correr pero **no** completan el cierre de canales.

---

## 2. Orden global (pipeline)

Ejecutar **en este orden** la primera vez; después, solo los bloques marcados **[A]** en la rutina recurrente.

```
Bootstrap [H0] → Verificar prod [A] → WhatsApp E2E [H0]+[A]+[H] → ML [H0]+[A|H] → Correo [A|H]+[H] → Cierre JSON [H]
```

---

## 3. Paso a paso (consultas resueltas de antemano)

### Bloque A — Pre-requisitos (solo [H0], una vez)

| # | Acción | Quién |
|---|--------|--------|
| A1 | Repo clonado, `npm ci`, `.env` o Secret Manager con `BMC_SHEET_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (o equivalente en Cloud Run), claves IA. | Titular / admin |
| A2 | Planilla **2.0** compartida con la **service account** (Editor donde escribe el CRM). | Titular |
| A3 | Cloud Run (o host) con **mismas** vars que prod: `PUBLIC_BASE_URL`, WA, ML, etc. | Admin |

**No preguntar en runtime:** si falta un secreto, el comando falla; el operador consulta `.env.example` y documentación enlazada.

---

### Bloque B — Verificación continua (100% [A])

Ejecutar **siempre** al integrar código o en CI post-deploy:

```bash
npm run gate:local
# opcional antes de release que toque src/
npm run gate:local:full
```

Contra **producción** (sin API local):

```bash
npm run smoke:prod
# o
BMC_API_BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app npm run smoke:prod
```

Brújula del programa + follow-ups (sin humano):

```bash
npm run project:compass
npm run program:status
```

**Comando combinado ya en el repo:**

```bash
npm run channels:onboarding
```

Equivale a: smoke prod + `project:compass` (script `channels:onboarding` en [`package.json`](../../../package.json) en la raíz del repo).

**Pipeline paralelo (máxima automación, sin intervención hasta `humanGate`):**

```bash
npm run channels:automated
# opcional: guardar último resultado para cron / agentes (gitignored)
npm run channels:automated -- --write
```

Corre **en paralelo** `smoke:prod` (JSON) y follow-ups locales; luego arma snapshot del programa maestro y la **primera tarea de canal bloqueante** (`cm-0` → `cm-1` → `cm-2`) con texto guía en español. **Stdout** = JSON único; exit **1** si el smoke falla. Implementación: [`scripts/channels-automated-pipeline.mjs`](../../../scripts/channels-automated-pipeline.mjs). Artefacto: `.channels/last-pipeline.json` si usás `--write`.

---

### Bloque C — WhatsApp → CRM (cm-0)

| Paso | Tipo | Qué hacer |
|------|------|-----------|
| C1 | [H0] | Meta: webhook URL, verify token = `WHATSAPP_VERIFY_TOKEN`, campo `messages`. Ver [`../WHATSAPP-META-E2E.md`](../WHATSAPP-META-E2E.md). |
| C2 | [A] | `curl` GET de verificación (mismo doc); esperado: challenge devuelto. |
| C3 | [H] | Enviar mensaje de prueba desde teléfono; esperar inactividad **o** mensaje con 🚀. |
| C4 | [A] | Revisar logs Cloud Run: `[WA]` sin error. |
| H | [H] | Confirmar fila **WA-Auto** en **CRM_Operativo** / **Form responses 1**. |
| C5 | [H] | Marcar **cm-0** `done` en `programs/bmc-panelin-master.json` si E2E OK. |

**Asíncrono por diseño:** Meta recibe **200** al instante; el servidor procesa **después** (buffer + tiempo o 🚀). No hace falta que Matias esté “en línea” en cada mensaje.

---

### Bloque D — Mercado Libre (cm-1)

| Paso | Tipo | Qué hacer |
|------|------|-----------|
| D1 | [H0] | OAuth ML en navegador **una vez** según [`../../ML-OAUTH-SETUP.md`](../../ML-OAUTH-SETUP.md); tokens persistidos (GCS recomendado en prod). |
| D2 | [A\|H] | `npm run ml:verify` (script verifica `/health` y flujo OAuth según entorno). |
| D3 | [A\|H] | `GET /auth/ml/status` en la **misma** base URL que prod. |
| D4 | [H] | Marcar **cm-1** `done` en JSON cuando el criterio del equipo se cumpla. |

**Refresco de tokens:** en background; no requiere a Matias en cada hora, solo **[H0]** inicial + alertas si expira.

---

### Bloque E — Correo → CRM (cm-2)

| Paso | Tipo | Qué hacer |
|------|------|-----------|
| E1 | [A] | En repo IMAP: generar snapshot (`panelsim-update` / flujo documentado en PANELSIM). |
| E2 | [A] | `npm run email:ingest-snapshot -- --dry-run --limit 5` |
| E3 | [A\|H] | `npm run email:ingest-snapshot -- --limit 1` (API con `.env` o `BMC_API_BASE` apuntando a instancia con credenciales). |
| E4 | [H] | Revisar fila CRM; luego marcar **cm-2** y automatizar **E1–E3** con **cron** (Cloud Scheduler → job que ejecute ingest) para **sin supervisión diaria**. |

**Asíncrono recomendado:** programar **E1–E3** cada N minutos/horas; Matias no interviene salvo alertas o muestreo semanal.

---

### Bloque F — Cierre de ciclo (semanal, [A] + [H] mínimo)

| Paso | Tipo | Qué hacer |
|------|------|-----------|
| F1 | [A] | `npm run project:compass -- --json` (para agentes) o humana la salida legible. |
| F2 | [H] | Actualizar `bmc-panelin-master.json` si una tarea pasó a `done`. |
| F3 | [H] | Una línea en `SESSION-WORKSPACE-CRM.md` si el equipo lo usa. |

Tarea programa **or-2** (ritual): ~**15 min/semana**; puede ser **[A]** para comandos y **[H]** solo para editar JSON.

---

## 4. Tabla “quién pregunta qué” (consultas agotadas)

| Pregunta | Respuesta fija (no bloquear al operador) |
|----------|------------------------------------------|
| ¿URL del API en prod? | `https://panelin-calc-q74zutv7dq-uc.a.run.app` (validar con `GET /capabilities` → `public_base_url`). |
| ¿Orden de canales? | WhatsApp → ML → Correo: [`../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md). |
| ¿Cómo sé el % del programa? | `npm run program:status`. |
| ¿Qué corre sin Matias? | Bloques **B**, y **C2/C4**, **D2–D3** tras **[H0]**, **E1–E3** con credenciales; ver leyenda §1. |
| ¿Dónde está el webhook WA? | `server/index.js` — `GET/POST /webhooks/whatsapp`. |

---

## 5. Automatización futura (opcional)

- **CI:** en cada merge a `main`, `npm run gate:local` + (si hay secretos) `smoke:prod` contra URL fija.
- **Cron GCP:** Cloud Scheduler → HTTP **authenticated** a un endpoint interno **o** Cloud Run Job que ejecute `node scripts/email-snapshot-ingest.mjs` con env inyectado.
- **No** exponer ingest sin auth en URL pública sin token/HMAC acordado.

Detalle de seguridad: skill Security / pre-deploy del repo.

---

## 6. Lectura cruzada

| Documento | Rol |
|-----------|-----|
| [`../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) | Checklist canónico por fase |
| [`../WHATSAPP-META-E2E.md`](../WHATSAPP-META-E2E.md) | Meta + curl + teléfono |
| [`../../ML-OAUTH-SETUP.md`](../../ML-OAUTH-SETUP.md) | ML OAuth y GCS |
| [`../PROJECT-SCHEDULE.md`](../PROJECT-SCHEDULE.md) | Panel único + comandos |
| [`programs/bmc-panelin-master.json`](./programs/bmc-panelin-master.json) | Tareas y estados |

---

**Resumen:** Después del **[H0]** (secretos + Meta + OAuth ML + compartir Sheets), un operador o agente puede **correr en bucle** los bloques **[A]**, usar este runbook **sin consultar a Matias** en cada paso, y reservar **[H]** para verificación puntual de negocio y cierre de tareas en el JSON.
