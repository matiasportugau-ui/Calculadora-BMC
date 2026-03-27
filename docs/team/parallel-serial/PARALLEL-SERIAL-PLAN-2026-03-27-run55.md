# Parallel/Serial Plan — RUN 2026-03-27 / run55

**Agente:** Parallel/Serial (`bmc-parallel-serial-agent`)
**Run:** 55 — **Invoque full team** 0→9 — foco **Integraciones + Networks + Contract/Mapping** (run operativo WA/correo)
**Fecha:** 2026-03-27
**Contexto:** Artefactos **documentales** en serie; gates **cm-0 / cm-1 / cm-2** estrictamente **serie** y con evidencia humana.

---

## Evaluación de paralelismo

| Fase | Acción | Modo |
|------|--------|------|
| 0–5g | Pasos orquestador estándar (sin 2b; 5h SIM-REV documental corto) | Serie (documental) |
| 6–8 | Judge → Repo Sync → PROJECT-STATE | Serie |
| 9 | PROMPT + BACKLOG + prompts automatizables | Serie |
| **Post-run humano** | E2E WA, ingest correo, redeploy, fix cotizaciones 503 | **Serie** (operador; no paralelar gates) |

**Paralelo lógico:** Mientras no haya edición concurrente del mismo archivo, roles **Mapping / Dependencies / Contract / Networks** pueden producir **notas** en paralelo conceptual; la **salida** se unifica en **REPORT run 55**.

---

## Plan de ejecución recomendado

```
0 → 0a (MATPROMT bundle run55) → 0b (este plan) → 1 → 2 → 3 → 3b → 3c → 4 → 4b
→ 5 → 5b → 5c → 5d → 5e → 5f → 5g → 5h (SIM-REV delta corto, sin panelsim:session obligatorio)
→ 6 → 7 → 8 → 9
```

---

## Notas

- **`npm run smoke:prod`:** Ejecutar en **verify-ci** del run cuando se valide Cloud Run; no sustituye `test:contracts` local con API.
- **Run 54:** La evidencia PANELSIM + ML local sigue siendo referencia; run 55 **no** la invalida.
