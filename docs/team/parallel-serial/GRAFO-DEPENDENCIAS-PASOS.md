# Grafo de dependencias entre pasos — Full Team Run

**Propósito:** Qué pasos dependen de cuáles. Parallel/Serial genera planes más precisos.

**Fuente:** INVOQUE-FULL-TEAM, bmc-dashboard-team-orchestrator.

---

## Dependencias

```
0 (Orchestrator) ──────────────────────────────────────────────────────────┐
0b (Parallel/Serial) ── depende de 0                                         │
1 (Orchestrator) ── depende de 0, 0b                                         │
2 (Mapping) ── depende de 1                                                   │
2b (Sheets Structure) ── depende de 2, condicional                             │
3 (Dependencies) ── depende de 2                                              │
3b (Contract) ── depende de 2, 3                                              │
3c (Networks) ── depende de 2                                                 │
4 (Design) ── depende de 2, 3                                                 │
4b (Integrations) ── depende de 3c                                            │
5 (Reporter) ── depende de 2, 3, 4, 4b                                        │
5b (Security) ── independiente                                                │
5c (GPT/Cloud) ── depende de 4b                                               │
5d (Fiscal) ── depende de 0–5                                                │
5e (Billing) ── depende de 2                                                 │
5f (Audit/Debug) ── depende de 3c                                            │
5g (Calc) ── depende de 2                                                     │
6 (Judge) ── depende de 2–5g                                                 │
7 (Repo Sync) ── depende de 6                                                 │
8 (Orchestrator) ── depende de 2–7                                            │
9 (Ciclo mejoras) ── depende de 8                                            │
```

---

## Paralelizables (después de 2)

- 3, 3b, 3c pueden correr en paralelo (todos dependen de 2)
- 4, 4b pueden correr en paralelo (dependen de 2/3)
- 5b, 5c, 5d, 5e, 5f, 5g pueden correr en paralelo (dependen de 2–4b)

---

## Referencias

- INVOQUE-FULL-TEAM.md
- bmc-parallel-serial-agent
