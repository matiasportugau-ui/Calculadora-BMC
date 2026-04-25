# Commit 3ba47ab

- Fecha: 2026-04-25
- Hora: 03:35:02
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: workspace
- Commit: feat(workspace): /bmc-claude-workspace skill + setup script

## Resumen
/bmc-claude-workspace skill + setup script

## Descripción
Este cambio registra el commit `feat(workspace): /bmc-claude-workspace skill + setup script` dentro del sistema de trazabilidad del proyecto. Se modificaron 10 archivos: .accessible-base/kb.json, .claude/commands/bmc-claude-workspace.md, docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md, docs/dev-trace/AUTOTRACE-UNRELEASED.md y 5 más.

Contexto del commit:
scripts/bmc-claude-workspace.sh:
  Creates 5-window tmux workspace with Claude Code running in each:
  0 conductor (shell + helpers) | 1 calc | 2 server | 3 tests | 4 ops
  Each agent gets a role primer as first message.
  Helpers: bmc-send, bmc-read, bmc-ask, bmc-broadcast, bmc-status, bmc-list
  Socket: /tmp/bmc-tmux.sock (shared with bmc-workspace.sh)

.claude/commands/bmc-claude-workspace.md:
  /bmc-claude-workspace skill — Claude detects session state and runs
  the setup script or reconnects. Documents usage patterns and
  tmux navigation shortcuts.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): .accessible-base, .claude, docs, scripts

## Archivos modificados
- .accessible-base/kb.json
- .claude/commands/bmc-claude-workspace.md
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/04/323c104.md
- docs/dev-trace/commits/2026/04/e2ac5e0.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/04/2026-04-25.md
- scripts/bmc-claude-workspace.sh

## Diff summary
```text
.accessible-base/kb.json                     |   4 +-
 .claude/commands/bmc-claude-workspace.md     |  91 +++++++++
 docs/dev-trace/AUTOTRACE-CHANGELOG.md        |   2 +
 docs/dev-trace/AUTOTRACE-STATUS.md           |  10 +-
 docs/dev-trace/AUTOTRACE-UNRELEASED.md       |   2 +
 docs/dev-trace/commits/2026/04/323c104.md    |  45 +++++
 docs/dev-trace/commits/2026/04/e2ac5e0.md    |  68 +++++++
 docs/dev-trace/commits/index.json            |  66 +++++++
 docs/dev-trace/worklog/2026/04/2026-04-25.md |  50 +++++
 scripts/bmc-claude-workspace.sh              | 263 +++++++++++++++++++++++++++
 10 files changed, 594 insertions(+), 7 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
