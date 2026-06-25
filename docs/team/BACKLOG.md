# Backlog de desarrollo — espejo versionado del tablero

Índice **diff-able** del backlog de software del proyecto. El **source of truth vivo** es el
tablero GitHub (Issues + Project "BMC Dev"); este archivo es un espejo legible en git para
revisar el backlog sin abrir la UI. Reglas del tablero: [`AGILE.md`](./AGILE.md).

- **Tablero:** repo → Projects → **BMC Dev** (columnas `Backlog → Ready → In Progress → In Review → Done`).
- **Issues:** <https://github.com/matiasportugau-ui/Calculadora-BMC/issues>
- Prioridad y labels: ver [`AGILE.md`](./AGILE.md) §4–§5. Mapeo con `/nxt`: 🔴 P0 · 🟠 P1 · 🟡 P2 · 🔵 P3.

> **Mantener en sync:** al crear/cerrar un issue de desarrollo, agregar/actualizar su fila acá.
> No hace falta reflejar cada cambio de columna del board — basta un estado grueso:
> **`Backlog`** = Backlog · **`En curso`** = Ready / In Progress / In Review · **`Done`** = Done.

## Backlog activo

| # | Título | type | area | prio | Estado |
|---|--------|------|------|------|--------|
| [#416](https://github.com/matiasportugau-ui/Calculadora-BMC/issues/416) | Resolver vulnerabilidades de dependencias (npm audit) | chore | infra | 🟠 P1 | Backlog |
| [#417](https://github.com/matiasportugau-ui/Calculadora-BMC/issues/417) | Go-live: completar GO-LIVE-DASHBOARD-CHECKLIST | chore | sheets | 🟠 P1 | Backlog |
| [#418](https://github.com/matiasportugau-ui/Calculadora-BMC/issues/418) | E2E validation — filas D1.x (UI manual) | chore | calc | 🟡 P2 | Backlog |
| [#419](https://github.com/matiasportugau-ui/Calculadora-BMC/issues/419) | ML: fallback de re-autorización si el token dormido falla | fix | api | 🟡 P2 | Backlog |
| [#420](https://github.com/matiasportugau-ui/Calculadora-BMC/issues/420) | Omni: confirmar modelo/pricing + cuota OpenAI fallback | chore | chat | 🟡 P2 | Backlog |

## Done (histórico reciente)

_(Vacío — al cerrar un issue, moverlo acá con su PR. El relato detallado vive en
[`PROJECT-STATE.md`](./PROJECT-STATE.md) → Cambios recientes.)_
