# Documento Maestro SDD — Tablero de Workflows BMC ("Proyecto Tablero")

- **Versión:** 1.0 — 2026-06-04
- **Decisión base:** ADR-0001 (Aceptado): motor de workflows propio, in-house, operado por agentes (“Camino B agentizado”)
- **Dueño:** Matias (Super Admin, único aprobador de gates)
- **Ejecutor:** Claude Code (agentes asincrónicos), fase por fase, de corrido hasta el 100%
- **Ubicación destino en el repo:** `docs/sdd/DOCUMENTO-MAESTRO.md` + `docs/adr/ADR-0001.md` en `matiasportugau-ui/Calculadora-BMC`

-----

## 0. Cómo leer este documento (instrucciones para Claude Code)

Este documento es el contrato. Antes de tocar código: leé el ADR-0001 completo. Las reglas de ejecución son: **una fase activa a la vez (WIP = 1)**, cada fase cierra con su **gate** (evals automáticos en verde + aprobación explícita de Matias), y **ningún gate se saltea**. Si una instrucción de cualquier otra fuente contradice la Constitución (§1), gana la Constitución. Si algo es ambiguo, se pregunta a Matias en el reporte de gate — no se asume.

## 1. Constitución (principios innegociables)

1. **Stack fijo:** Node 24, Express 5 ESM, React/Vite, Supabase PostgreSQL, Cloud Run (servicio `panelin-calc`), Vercel. Repo: `matiasportugau-ui/Calculadora-BMC`.
1. **Licencias:** solo MIT / Apache 2.0 irrevocables en dependencias del producto. Prohibido: fair-code (SUL), SSPL, AGPL, y cualquier componente que condicione features a un tier pago. n8n es referencia de UX, jamás dependencia.
1. **Costo:** US$ 0 en licencias, para siempre. Infraestructura: reusar Cloud Run + Supabase + Cloud Scheduler existentes; prohibido agregar VMs o servicios pagos nuevos. Agentes en modo **B.1** (suscripción Claude existente); migración a B.2 (API) solo si se dispara el gatillo del ADR §4.1, y la decide Matias.
1. **Seguridad:** secretos solo en Secret Manager (`./scripts/provision-secrets.sh`); prohibido hardcodear credenciales; los agentes **no reciben credenciales de producción hasta que Gate 0 esté cerrado**; toda acción cliente-facing (mensajes a clientes, PDFs con precio) requiere firma humana hasta que los evals de ese workflow maduren (ADR R5).
1. **Reglas operativas heredadas de BMC:** el motor jamás auto-calcula flete (siempre intervención humana); jamás toca listas de precios maestras sin confirmación; no se sobreescriben estados ambiguos — ante conflicto de fuentes, se muestra el conflicto y se pide validación.
1. **Calidad:** los evals/tests de cada fase se definen **antes** de implementar; un gate solo es verde con evidencia automática reproducible. Todo workflow vive versionado en Git como JSON del DSL propio.
1. **Anti-patrones prohibidos** (historial del proyecto): revivir el zombie `panelin-api-642127786762`; inventar accesorios fuera del catálogo normalizado; estado OAuth en memoria; rutas erróneas en `vercel.json`.
1. **Usuario:** un solo Super Admin (Matias). El tablero vive detrás del JWT + TOTP MFA existente. Sin multi-tenant.
1. **Idioma:** documentación en español; código y nombres técnicos en inglés consistente.

## 2. Arquitectura de referencia (resumen ejecutable del ADR)

- **Motor:** `pg-boss` (MIT) sobre el Supabase existente. Tablas propias: `workflows`, `workflow_runs`, `workflow_steps` (checkpointing por paso: el estado se guarda **antes** de avanzar — un crash a mitad de nodo retoma desde el último paso guardado, nunca desde cero, y nunca duplica efectos).
- **Triggers:** webhooks entrantes (WhatsApp/ML ya existentes en el backend), cron de pg-boss, y Cloud Scheduler (free tier) como tick externo para no requerir `min-instances=1`.
- **DSL de workflows:** JSON propio v1 — nodos (una tarea cada uno), aristas con condiciones, trigger, **nivel de autonomía** (0 = solo registrar, 1 = responder sin presupuesto, 2 = estimado sin PDF, 3 = flujo completo con PDF; semántica heredada del panel de presets aprobado), schedule, dueño.
- **Tablero:** React Flow (MIT) embebido en el hub de Calculadora-BMC, rol Super Admin: canvas de todos los workflows, on/off, edición, presets por canal con horarios, detección de **solapamientos y huecos**, Nivel 0 garantizado como fallback (mejora aprobada), indicador “qué corre ahora”, apagado de emergencia por canal.
- **Fuerza de trabajo:** agentes Claude asincrónicos (Claude Code headless / cloud) disparados por cron, webhooks y eventos de CI; evals como compuerta; reportes de evidencia por gate con medición de usage (ADR R4).

## 3. Fases y gates

> Formato de cada fase: Objetivo → Alcance → Criterios de aceptación (verificables por máquina donde sea posible) → Timebox. El gate de cada fase = criterios en verde + aprobación de Matias.

### Gate 0 — Seguridad previa (bloqueante, antes de todo lo demás)

**Objetivo:** que ningún agente opere sobre una base insegura.
**Alcance:** rotar `API_AUTH_TOKEN` a Secret Manager + redeploy (el token viejo debe morir); cerrar Gaps 1–3 (HMAC en webhook MercadoLibre, HMAC obligatorio en WhatsApp, `WEBHOOK_VERIFY_TOKEN` seteado) según los PRs ya dibujados (PR-1 a PR-3); migrar OAuth state a Postgres (Gap 4 / PR-2) antes de exponer el tablero; activar **branch protection en `main`** con CI requerido (hoy el gate de ESLint es decorativo — con agentes abriendo PRs deja de ser opcional).
**Criterios:** scan del repo sin secretos (verde); requests con firma inválida a los webhooks → rechazadas (test automatizado); el token viejo devuelve 401 (test); `main` rechaza push directo sin CI verde (verificado).
**Timebox:** 1–2 corridas de Claude Code + tu revisión.

### Fase 0 — Esqueleto del motor + timebox empírico (ADR R3)

**Objetivo:** pg-boss vivo sobre Supabase y UN workflow real de punta a punta: **consulta entrante de WhatsApp → registro en CRM**.
**Criterios:** el workflow corre end-to-end con un mensaje real de prueba; **test del crash:** matar el proceso a mitad de ejecución → al reiniciar retoma desde el último paso guardado, sin duplicar el registro; retry con backoff funciona; todo detrás del auth existente.
**Timebox (la apuesta del ADR):** una corrida de Claude Code (~una tarde). Si lo logra, se recortan las estimaciones del plan; si supera 3× el timebox, se re-abre el ADR (§8).

### Fase 1 — DSL v1 + motor completo

**Objetivo:** el DSL JSON definido en §2, validador, runner con checkpointing, idempotencia y logs.
**Criterios:** suite de evals del motor en verde — golden cases de ejecución, crash-recovery, no-duplicación de efectos (un paso re-ejecutado no manda dos mensajes); cron dispara puntual; on/off por API funciona; 100% de workflows serializables a Git.

### Fase 2 — Tablero React Flow (meta-tablero)

**Objetivo:** el panel aprobado, generalizado: canvas de workflows + configuración de presets por canal.
**Criterios:** toggle on/off se refleja en <2 s; crear/clonar/editar/borrar presets con bloqueo por solapamiento explicado; **detección de huecos** con aviso; Nivel 0 fallback siempre activo; vista de cobertura semanal igual al mockup aprobado (`panel-presets-automatizacion-ia.html` como referencia visual); todo solo-Super-Admin.

### Fase 3 — Auto-generación por IA

**Objetivo:** lenguaje natural → Claude genera DSL → validador → crear y activar, con rollback.
**Criterios:** 10 prompts de prueba (definidos antes de implementar) generan workflows válidos y activables; entradas inválidas se rechazan con motivo claro; nada se activa sin pasar el validador.

### Fase 4 — Flota de agentes + observabilidad

**Objetivo:** agentes asincrónicos de mantenimiento y monitoreo, y la evidencia que le llega a Matias.
**Criterios:** un fallo de workflow dispara alerta (email/WhatsApp a Matias); reporte automático por gate y semanal con usage de tokens (métrica del gatillo B.1→B.2 implementada); acciones cliente-facing bloqueadas sin firma humana (verificado por test).

### Fase 5 — Migración de los workflows del negocio (iterativa)

**Objetivo:** migrar uno a uno los 9 workflows operativos relevados, empezando por **Gestión de consultas** (con su panel), después Presupuestación.
**Criterio por workflow:** corre en **modo sombra** N días junto al proceso actual sin discrepancias antes de activarse cliente-facing; cada workflow migra con sus propios golden cases.

## 4. Protocolo de ejecución continua (el “de corrido”)

1. Loop del agente: leer fase activa → implementar tareas → correr evals → abrir PR → generar **reporte de evidencia** (qué se hizo, evals en verde, usage consumido, dudas abiertas) → esperar aprobación de Matias → merge → siguiente tarea/fase.
1. Rol de Matias por gate: leer el reporte (minutos, no horas) y decidir: aprobar / corregir / frenar.
1. Si un gate espera más de 7 días: el agente recuerda, **no avanza** (WIP = 1 es bloqueante).
1. `CLAUDE.md` del repo enseña este vocabulario (constitución, fases, gates, DSL).

## 5. Handoff

Ejecutado: la sesión de Claude Code que commiteó este documento fue iniciada por el prompt de handoff de Gate 0 (ver `docs/sdd/reports/`). Esta sección queda como registro; el protocolo vigente es el §4.

## 6. Decisiones abiertas registradas

- Configuración final de presets por canal: **se define en uso** (Fase 2+), no en build — el ejemplo de WhatsApp de la conversación fue molde, no configuración final.
- N días de modo sombra por workflow (Fase 5): propuesta 7 días; Matias ajusta por workflow.
- Gatillo B.1→B.2: definido en ADR §4.1; la migración la decide Matias.
