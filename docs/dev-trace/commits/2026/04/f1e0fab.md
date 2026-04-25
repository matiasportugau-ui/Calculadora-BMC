# Commit f1e0fab

- Fecha: 2026-04-25
- Hora: 01:18:48
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: dev
- Commit: feat(dev): tmux 4-pane workspace scripts (bmc-dev-session, bmc-watch, bmc-gate-chain)

## Resumen
tmux 4-pane workspace scripts (bmc-dev-session, bmc-watch, bmc-gate-chain)

## Descripción
Este cambio registra el commit `feat(dev): tmux 4-pane workspace scripts (bmc-dev-session, bmc-watch, bmc-gate-chain)` dentro del sistema de trazabilidad del proyecto. Se modificaron 3 archivos: scripts/bmc-dev-session.sh, scripts/bmc-gate-chain.sh, scripts/bmc-watch.sh.

Contexto del commit:
- bmc-dev-session.sh: creates tmux session with 4 panes (dev:full / log-watch / gate / ad-hoc)
- bmc-watch.sh: unified tail of all pane logs with color-coded prefixes [DEV][GATE][SMOKE][SYS]
- bmc-gate-chain.sh: gate:local runner with watch mode (5s polling) and optional auto-chain (CHAIN=1 → commit → smoke:prod)

All logs written to /tmp/bmc-live/*.log — readable by Bash tool for live cross-terminal monitoring.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): scripts

## Archivos modificados
- scripts/bmc-dev-session.sh
- scripts/bmc-gate-chain.sh
- scripts/bmc-watch.sh

## Diff summary
```text
scripts/bmc-dev-session.sh | 52 +++++++++++++++++++++++++++++++++++++++++
 scripts/bmc-gate-chain.sh  | 58 ++++++++++++++++++++++++++++++++++++++++++++++
 scripts/bmc-watch.sh       | 23 ++++++++++++++++++
 3 files changed, 133 insertions(+)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
