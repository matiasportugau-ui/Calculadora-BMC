# Panelin Live Editor — Example Modifications

## Visual / Style Changes

**User says**: "Los bubbles son muy chicos, quiero que se vean más grandes"
**Interpretation**: Increase D3 density bubble radius scale
**File**: `app.js`
**Target**: `renderTimelineSVG` → the `r` scale range
**Change**: `d3.scaleSqrt().domain([0, maxCommits]).range([0, 18])` → increase max to 26+

---

**User says**: "Quiero más espacio entre las lanes de los repos"
**Interpretation**: Increase gap in panorama grid
**File**: `styles.css`
**Target**: `.panorama-grid { gap: 2px }` → increase to 12px or more

---

**User says**: "El fondo es muy oscuro, hacelo un poco más claro"
**Interpretation**: Lighten background custom properties
**File**: `styles.css`
**Target**: `:root { --bg-deep: ... }` values
**Change**: Adjust `--bg-deep` and `--bg-base` to lighter values

---

**User says**: "Los floating reports deberían aparecer a la derecha del objeto"
**Interpretation**: Change panel positioning logic
**File**: `app.js`
**Target**: `showFloatingReport` → panelX/panelY calculation
**Change**: Position panel to the right of rect instead of above

## Structural / Feature Changes

**User says**: "Agregá un botón para volver al panorama desde cualquier vista"
**Interpretation**: Add persistent back-to-home button
**File**: `index.html` + `styles.css`
**Target**: Add button in `#breadcrumb` or floating, wire onclick to `navigate(0)`

---

**User says**: "Quiero ver un gráfico de barras con commits por día"
**Interpretation**: Add D3 bar chart view
**File**: `app.js` + `styles.css` + possibly `index.html`
**Target**: New render function, new view section, bar chart with D3

---

**User says**: "Los commit cards deberían mostrar el autor"
**Interpretation**: Add author field to commit card rendering
**File**: `app.js`
**Target**: Commit card template strings in `renderStreamFocus` and `renderSession`
**Change**: Add `c.author` display inside the card HTML

## Data / Collector Changes

**User says**: "Agregá otro repositorio para trackear"
**Interpretation**: Add entry to REPOS array in collector
**File**: `~/.panelin-evolution/collect.js`
**Target**: `const REPOS = [...]` array
**Change**: Add new `{ name, path, github, color }` object, then re-run collector
