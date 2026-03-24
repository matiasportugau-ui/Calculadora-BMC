# Full team run — Objetivo SIM + KB (documental)

**Fecha:** 2026-03-23  
**Tipo:** Ejecución documental del protocolo “Invoque full team” con **objetivo SIM**: dejar al **Agente Simulador (PANELSIM)** una **base de conocimiento ampliada** además del documento operativo canónico.

---

## 1. Objetivo declarado (paso 0)

1. Completar el complemento de [`AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md) con un **índice de proyecto** único: dominios, roles §2, superficie HTTP, comandos y hubs de documentación.
2. Mantener **una fuente** para “qué existe en el repo” sin duplicar el detalle de cada archivo enlazado.
3. Actualizar referencias cruzadas (`SIM.md`, sección 6 de `AGENT-SIMULATOR-SIM.md`, `knowledge/README.md`) y estado del proyecto.

---

## 2. Entregables

| Artefacto | Descripción |
|-----------|-------------|
| [`docs/team/knowledge/PANELSIM-FULL-PROJECT-KB.md`](../knowledge/PANELSIM-FULL-PROJECT-KB.md) | KB completa navegable para PANELSIM. |
| Este informe | Registro del run con objetivo SIM + KB. |
| `docs/team/PROJECT-STATE.md` | Entrada en Cambios recientes. |

**Handoff a SIM (resumen):**

- **Documento operativo:** `AGENT-SIMULATOR-SIM.md` (identidad, límites, ML modo aprobación).
- **Mapa de posibilidades:** `PANELSIM-FULL-PROJECT-KB.md` (áreas, equipo, rutas, npm).
- **Estado vivo:** `PROJECT-STATE.md`, `SESSION-WORKSPACE-CRM.md` §5.

---

## 3. Pasos del orquestador (mapeo a este run)

| Paso | Estado |
|------|--------|
| 0 Lectura estado + backlog | Hecho (contexto 2026-03-23). |
| 0a MATPROMT | Tema alineado con [`matprompt/MATPROMT-RUN-THEME-SIM-2026-03-23.md`](../matprompt/MATPROMT-RUN-THEME-SIM-2026-03-23.md); entrega = KB + informe. |
| 0b Parallel/Serial | N/A documental (un hilo KB). |
| 1–8 Roles §2 | No se requirió paso por cada rol en código; la KB **indexa** responsabilidades y rutas para que SIM sepa cuándo escalar. |
| 5h SIM-REV | Opcional; ejecutar si hay bloque de trabajo SIM que contrastar con backlog. |
| 6–9 Judge / Repo Sync / prompts | Según agenda del usuario; **paso 9** puede incluir “mantener KB cuando cambie §2 o `server/index.js`”. |

---

## 4. Próximo paso sugerido

- Tras cambios grandes en API o tabla §2: actualizar `PANELSIM-FULL-PROJECT-KB.md` §6–§7 y una línea en `PROJECT-STATE.md`.
- Ejecutar **SIM-REV** cuando haya un bloque de sesiones SIM sustantivo: `docs/team/reports/SIM-REV-REVIEW-YYYY-MM-DD.md`.
