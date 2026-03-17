# Panelin Live Editor — Reference

## File Map

```
~/.panelin-evolution/
├── collect.js                        # Data collector (Node.js)
├── data/
│   ├── latest.json                   # Current snapshot (auto-generated)
│   └── snapshots/
│       └── YYYY-MM-DD.json           # Daily snapshots
└── viewer/
    ├── index.html                    # SPA shell — 7 view sections
    ├── styles.css                    # ~400 lines, dark theme, CSS vars
    └── app.js                        # ~500 lines, D3 + vanilla JS
```

## HTML Section IDs

| ID | View Level | Contains |
|----|-----------|----------|
| `view-panorama` | L0 | `#panorama-timeline`, `#panorama-cross-refs` |
| `view-repo` | L1 | `#repo-swimlanes`, `#repo-title`, `#repo-subtitle` |
| `view-stream` | L2 | `#stream-commits`, `#stream-title` |
| `view-session` | L3 | `#session-commits`, `#session-title` |
| `view-file` | L4 | `#file-content`, `#file-title` |
| `view-transcript` | L5 | `#transcript-list` |
| `view-search` | Search | `#search-results`, `#search-title` |

## CSS Class Inventory

### Layout classes
- `.panorama-grid` — flex column container for repo lanes
- `.repo-lane` — grid: 200px / 1fr / 80px (header / timeline / score)
- `.swimlanes` — flex column for stream lanes
- `.stream-lane` — grid: 180px / 1fr (label / cells)
- `.stream-cells` — flex row of day cells

### Component classes
- `.commit-card` — grid: 60px / 1fr / auto
- `.commit-detail-card` — full commit with file list
- `.float-panel` — absolutely positioned floating report
- `.connector-line` — SVG white dashed line
- `.transcript-card` — grid card for AI sessions
- `.skill-card` — grid card for skills inventory

### State classes
- `.view.active` — visible view section
- `.crumb.active` — current breadcrumb level
- `.has-activity` — day cell with commits
- `.score-high` / `.score-mid` / `.score-low` — score color states

## D3.js Patterns Used

### Scale patterns
```javascript
d3.scaleBand().domain(allDays).range([10, width - 10]).padding(0.2)  // x-axis
d3.scaleSqrt().domain([0, maxCommits]).range([0, 18])                 // bubble radius
```

### Selection pattern
```javascript
svg.selectAll('.day-bubble')
  .data(allDays)
  .join('g')
  .each(function(day) { ... })
```

### Transition pattern
```javascript
.transition().duration(600).delay(index * 40)
```

## Stream IDs and Render Order

```javascript
const STREAM_ORDER = [
  'calculator-core', 'ui-ux', 'backend-api', 'gpt-integration',
  'testing', 'ci-devops', 'integrations', 'documentation', 'skills', 'fiscal'
];
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search input |
| `Escape` | Close panels / go back one level |
| `Backspace` | Go back one level |
| `1`-`4` | Jump to repo (L0 only) |

## Fonts (Google Fonts)

- **IBM Plex Mono** — headings, labels, monospace elements (`--font-display`)
- **Source Sans 3** — body text, descriptions (`--font-body`)
