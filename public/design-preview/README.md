# BMC Design Competition — 5 Studios

Static HTML/CSS mockups comparing five fictional UI studios integrating a unified design system across **Calculadora BMC** (full SPA: calculator + `/hub/*`).

## How to view

1. Open [`index.html`](index.html) in a browser (double-click or `open docs/team/design-competition/index.html`).
2. No Vite or npm required — files link to `_shared/` CSS only.
3. Each mockup shows one **layer** at one **breakpoint** for one **studio**.

## Layers

| Layer | Content |
|-------|---------|
| **L0** | Shell, auth gate, hub navigation |
| **L1** | Calculator wizard (`solo_techo`, dimensiones step) |
| **L2** | Roof 2D visor + BOM + Panelin chat |
| **L3** | Hub modules (cotizaciones KPI + table) |

## Breakpoints

- **Mobile** — 390px
- **Tablet** — 834px
- **Desktop** — 1280px

## Studios

| # | Folder | Philosophy |
|---|--------|------------|
| 1 | `studio-1-tahoe` | Apple Liquid Glass Regular — glass on chrome only |
| 2 | `studio-2-operativo` | Time-saving ops density |
| 3 | `studio-3-warm` | Applied AI warm commerce |
| 4 | `studio-4-industrial` | Field / construction tablet-first |
| 5 | `studio-5-responsive` | Mobile-first progressive (glass nav desktop only) |

## Jury criteria

| Criterion | Weight |
|-----------|--------|
| Operator speed (fewer clicks, scan) | 40% |
| Mobile / tablet / desktop fit | 30% |
| BMC brand (`#1A3A5C`) | 20% |
| Trend novelty | 10% |

See [`JURY-RECOMMENDATION.md`](JURY-RECOMMENDATION.md) for the outcome.

## Regenerate mockups

```bash
node docs/team/design-competition/scripts/generate-mockups.mjs
```

## Token mapping to production code

| Mockup token | Production source |
|--------------|-------------------|
| `--bmc-brand`, `--bmc-primary` | `src/data/constants.js` → `C.brand`, `C.primary` |
| `--bmc-glass`, `--bmc-blur` | `src/components/admin-cotizaciones/styles.css` → `--ac-glass`, `--ac-blur` |
| Warm palette | `.claude/skills/applied-ai-design/SKILL.md` → `--aa-*` |

## Related docs

- [`TREND-RESEARCH-2026.md`](TREND-RESEARCH-2026.md)
- [`PROGRESS.md`](PROGRESS.md)
- [`goal-prompt-design-competition-five-studios.md`](../../../goal-prompt-design-competition-five-studios.md) (repo root)
