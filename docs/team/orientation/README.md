# Orientación de programa — BMC / Panelin (y plantilla reutilizable)

**Propósito:** Una sola arquitectura para saber **en qué fase estás**, **cuánto falta** (orden de magnitud), **qué sigue** y cómo **varias áreas** convergen sin perder el hilo.

| Documento | Uso |
|-----------|-----|
| [PROGRAM-ARCHITECTURE.md](./PROGRAM-ARCHITECTURE.md) | Arquitectura, buenas prácticas, divergencia/convergencia de streams, vínculos con `PROJECT-STATE`, `SESSION-WORKSPACE-CRM`, follow-ups |
| [CHRONOGRAM-TEMPLATE.md](./CHRONOGRAM-TEMPLATE.md) | Plantilla de cronograma (fases, semanas estimadas, criterios de salida) para **cualquier** proyecto grande |
| [programs/bmc-panelin-master.json](./programs/bmc-panelin-master.json) | Programa maestro **versionado** (fases + streams + tareas); fuente para `npm run program:status` |
| [../PROJECT-SCHEDULE.md](../PROJECT-SCHEDULE.md) | **Panel único:** cronograma, rutina, comandos `project:compass` / `program:status` / follow-ups |
| [ASYNC-RUNBOOK-UNATTENDED.md](./ASYNC-RUNBOOK-UNATTENDED.md) | **Runbook asíncrono:** pipeline ordenado (H0 / A / H), fin de proceso cm-0…cm-2, sin consultar al titular en cada paso |
| [../HUMAN-GATES-ONE-BY-ONE.md](../HUMAN-GATES-ONE-BY-ONE.md) | **Humano paso a paso:** enlaces Meta / ML / correo, opciones de menú, criterio de listo |
| [EXECUTION-PLAN-MASTER.md](./EXECUTION-PLAN-MASTER.md) | **Plan maestro paso a paso:** Fase 0→5, tabla “dónde encontrar” cada doc y script, orden cm-0 → cm-1 → cm-2 → resto |
| [VERSION-HISTORY-BMC-CALC.md](./VERSION-HISTORY-BMC-CALC.md) | **Versiones:** semver `package.json` desde 3.0.0 (tabla + commits), `CALCULATOR_DATA_VERSION`, deploys, tags, enlaces a PROJECT-STATE |
| [EXPERT-DEV-TRACEABILITY.md](./EXPERT-DEV-TRACEABILITY.md) | Checkpoints locales `expert:checkpoint` / flujo local → prod |
| [AI-MAGAZINE-UPDATE-LOGS-PROMPT.md](./AI-MAGAZINE-UPDATE-LOGS-PROMPT.md) | Prompt para agente IA: revista/spread **logs completos (izq.)** + **explicación visual usuario (der.)**, estilo cyber-industrial |
| [MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.md](./MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.md) | **Ejemplo ejecutado v1.1:** spread + resumen ejecutivo + spec Figma/PDF (márgenes mm, tipografía pt, hex, anexos), fuente PROJECT-STATE 2026-04-09 + Git |
| [MAGAZINE-DAILY-EMAIL.md](./MAGAZINE-DAILY-EMAIL.md) | **Digest diario por correo:** `npm run magazine:daily` / `:send`, SMTP Gmail, LaunchAgent macOS (`magazine:schedule:install`) |

**Comando rápido (repo root):**

```bash
npm run program:status
npm run project:compass
```

**Pipeline máquina (paralelo, JSON + humanGate):** `npm run channels:automated` — ver [ASYNC-RUNBOOK-UNATTENDED.md](./ASYNC-RUNBOOK-UNATTENDED.md) y [../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md](../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md). En CI: job `channels_pipeline` en [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

**Cuando toque humano (Meta / OAuth / correo):** [../HUMAN-GATES-ONE-BY-ONE.md](../HUMAN-GATES-ONE-BY-ONE.md) — un paso por vez.

**Seguimiento diario recomendado:** `npm run project:compass` (incluye follow-ups vencidos). Detalle en [../PROJECT-SCHEDULE.md](../PROJECT-SCHEDULE.md).

Actualizá `programs/bmc-panelin-master.json` cuando cierres tareas o cambies de fase (`currentPhaseId`, `status` de fases/tareas). `PROJECT-STATE.md` sigue siendo el diario de cambios; este JSON es el **mapa de elevación** del programa.
