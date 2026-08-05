# DESIGN-UI — BMC Envíos · Liquid Glass (Apple crystal)

**Module:** `bmc-envios` (Quote surface + Ops `/logistica`)  
**Framework:** BMC Liquid Glass hybrid (Apple Regular material, web approximation)  
**Canonical tokens:** `src/styles/bmc-glass.css` (`--g-*`, `--lg-*`)  
**Module layer:** `src/styles/bmc-envios-glass.css`  
**JS helper:** `src/utils/enviosTheme.js`  
**Parent guide:** `docs/bmc-dashboard-modernization/LIQUID-GLASS-WEB-GUIDE.md`

---

## 1. Principle (non-negotiable)

| Layer | Material | Where |
|-------|----------|--------|
| **Chrome** | Liquid Glass **Regular** (frost + blur + luminous edge) | App header, sticky tab bar, quote summary shell, primary glass CTAs, floating chips |
| **Content** | **Solid / opaque** | Inputs, selects, stop cards body, packing SVG diagrams, tables, dense form grids |
| **Clear glass** | **Forbidden** on Envíos | No high-transparency glass over data without dimming |

Web approximation (not native `glassEffect()`):

```css
background: rgba(var(--g-tint), var(--g-frost));
backdrop-filter: saturate(var(--g-sat)) blur(var(--g-blur));
border: 1px solid rgba(255, 255, 255, var(--g-edge));
/* inset specular + soft drop shadow */
```

---

## 2. Surfaces map

| Surface | Route / component | Chrome glass | Solid content |
|---------|-------------------|--------------|---------------|
| Quote | Wizard Flete 10/11 · `FleteCotizarPanel` | Summary card, Cotizar button shell | Destino input, checkbox row, FLETE steppers (parent) |
| Ops | `/logistica` · `BmcLogisticaApp` | Page header ENV card, view tab bar | Form fields, stop list, diagram panels, remito print |
| Module nav | `BmcModuleNav` | Optional preview glass (platform) | — |

---

## 3. Token contract (day defaults)

| Token | Value | Use |
|-------|-------|-----|
| `--g-bg-page` | `#f5f5f7` | Page canvas |
| `--g-text` | `#1d1d1f` | Primary text |
| `--g-text-2` | `#6e6e73` | Muted / labels |
| `--g-accent` | `0, 113, 227` (#0071E3) | Primary actions, active tabs |
| `--g-brand` | `26, 58, 92` | Titles |
| `--g-solid-bg` | `#ffffff` | Content cards / inputs |
| `--g-blur` | `14px` | Module cards chrome |
| `--g-blur-nav` | `20px` | Sticky bars |
| `--g-blur-chip` | `12px` | Small pills |
| `--g-frost` | `0.42` | Glass fill alpha |
| `--g-sat` | `165%` | Backdrop saturate |
| `--g-radius` | `20px` | Large chrome |
| `--g-radius-sm` | `12px` | Cards / tabs |

Night: `[data-appearance="night"]` from platform appearance provider.

SVG/canvas (must use hex, not RGB channels): `ENV_HEX` in `enviosTheme.js`.

---

## 4. Component specs

### 4.1 `.envios-app`

Full-page shell for ops.

- `min-height: 100vh`
- `background: var(--g-bg-page)`
- `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", …`
- `color: var(--g-text)`
- Padding `16px` (mobile `12px`)

### 4.2 `.envios-chrome` / header

Extends `.glass` + brand accent bar.

- Left border `4px solid rgb(var(--g-brand))` **or** gradient accent strip
- Padding `16px 20px`
- Title `20px / 700 / brand`
- Meta `13px / muted`
- **No** backdrop-filter on nested text blocks

### 4.3 `.envios-tabbar` + `.envios-tab`

Sticky chrome strip under header.

| State | Spec |
|-------|------|
| Bar | `.glass` + sticky `top` under module nav; gap 8px; blur nav |
| Tab idle | Solid white/border; radius 10; weight 600; 13px |
| Tab active | Fill `rgb(var(--g-accent))`; text white; no blur on fill |
| Hover idle | Slight lift via `.glass-interactive` only on bar chips if glass |

### 4.4 `.envios-card-solid`

Opaque content panel (diagrams, forms).

- `background: var(--g-solid-bg)`
- Soft shadow (not glass blur)
- Radius `--g-radius-sm`
- Border `1px solid` subtle edge

### 4.5 Quote — `.envios-quote` block

| Element | Class | Rules |
|---------|-------|-------|
| Root | `.envios-quote` | Column gap 12px |
| Label | `.envios-label` | 11px uppercase, letter-spacing 0.05em, muted |
| Field | `.envios-field` | **Solid** input; border 1.5px; radius 10; padding 9×12; no blur |
| CTA | `.envios-btn-primary` | Accent fill or glass outline + accent text; min height 36px |
| Summary | `.envios-summary` | **Chrome glass** card; title 12px bold; meta 11px muted |
| Error | `.envios-alert-danger` | Solid tinted red panel (opaque) |
| Hint | `.envios-hint` | 11px muted |

### 4.6 Buttons

| Variant | Class | Use |
|---------|-------|-----|
| Primary filled | `.envios-btn-primary` | Cotizar flete, primary ops |
| Glass outline | `.envios-btn-glass` | Secondary chrome actions |
| Danger solid | `.envios-btn-danger` | Destructive (opaque) |

---

## 5. Blur matrix (Envíos)

| Element | Blur token | Glass? |
|---------|------------|--------|
| Ops page header | `--g-blur` | Yes |
| View tab bar | `--g-blur-nav` | Yes bar / solid active tab |
| Quote summary | `--g-blur` | Yes |
| Cotizar CTA | 0 if filled; chip blur if glass outline | Prefer filled primary |
| Form inputs | **0** | **No** |
| Stop list / packing SVG | **0** | **No** |
| Print remito | solid only | `@media print` hide chrome |

---

## 6. Accessibility

- `prefers-reduced-transparency: reduce` → all `.envios-*` glass → `var(--g-solid-bg)` (inherits `bmc-glass.css`)
- `prefers-reduced-motion: reduce` → no tab hover translate
- Contrast: text on glass must remain ≥ 4.5:1 (Regular frost 0.42 + solid fallback)
- Focus rings: 2px accent outline above glass

---

## 7. Anti-patterns

- Do **not** put `backdrop-filter` on packing diagrams or stop table rows  
- Do **not** use Clear glass over white forms  
- Do **not** hardcode hex in new components — use tokens / classes  
- Do **not** glass the entire wizard step body  
- Do **not** invent a second design system for Envíos  

---

## 8. Implementation checklist

- [x] `DESIGN-UI.md` (this file)
- [x] `src/styles/bmc-envios-glass.css`
- [x] `src/utils/enviosTheme.js`
- [x] Import glass CSS in `src/main.jsx`
- [x] `FleteCotizarPanel` → envios quote classes
- [x] `BmcLogisticaApp` → envios-app + chrome header/tabs + solid cards
- [ ] Optional: shared `EnviosStatusBadge` component
- [ ] Visual QA day/night + reduced transparency

---

## 9. Agent quick rules

1. Chrome → class `glass` / `envios-chrome` / `envios-summary`  
2. Data entry → `envios-field` / `envios-card-solid`  
3. Colors → `ENV_HEX` for SVG, CSS vars for layout  
4. Before new UI: read this file + `LIQUID-GLASS-WEB-GUIDE.md`
