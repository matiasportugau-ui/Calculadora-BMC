## Conventions

This package ships two small, independent primitive families lifted directly from calculadora-bmc (a production quotation-calculator SPA, not a component library) — there is no shared design-token system, no Tailwind, and no unified theme across the whole app. Build with exactly what's here; do not invent a broader system.

### 1. Glass family — wrapping and setup

`Glass`, `GlassFilterSvg`, `AppearanceToggle` need **no provider**, but two things matter:

- **Day/night is a real, opt-in attribute, not automatic.** Set `data-appearance="day"` or `data-appearance="night"` on an ancestor element to activate that mode's token values — it's a plain CSS attribute selector (not `:root`-locked), so any wrapping `<div>` works. Day mode (`--g-frost: 0.42` white-on-`#f5f5f7`) is intentionally subtle; night mode (white-on-`#0a0f1e`) is where the frosted/blurred effect reads clearly. Pick whichever matches the surrounding design — don't assume day is "default."
- **`refract` needs its filter mounted once.** Any `<Glass refract>` relies on an SVG filter (`#bmcGlass`) that only `<GlassFilterSvg />` provides. Mount exactly one `<GlassFilterSvg />` per page/section that uses `refract` — it has zero visual output on its own (0×0, `position: absolute`).

```jsx
<div data-appearance="night" style={{ background: "var(--g-bg-page)", padding: 24 }}>
  <Glass as="nav" refract style={{ display: "flex", padding: "10px 14px" }}>
    <strong style={{ color: "rgb(var(--g-brand))" }}>BMC Uruguay</strong>
  </Glass>
  <GlassFilterSvg />
</div>
```

### 2. Help family — wrapping and setup

`Tooltip`, `HelpButton`, `Callout`, `FirstTimeTip` all read from a `HelpProvider` context (wire it once at the root — no required props; it falls back to a real embedded seed of 6 real tips when no `source` is passed) and need a `.adminCot` ancestor class or their CSS never matches:

```jsx
<HelpProvider>
  <div className="adminCot">
    <Callout id={HELP_ANCHORS.KPI_STALE} variant="warn" />
  </div>
</HelpProvider>
```

Only 6 anchor ids render real content without a custom `source`: `topbar-live`, `kpi-pendientes`, `kpi-error`, `kpi-stale`, `batch-modal`, `drawer-regenerate-hint` (import via `HELP_ANCHORS.*`, not bare strings). Any other id renders nothing — silent, by design, not an error.

**Absolute-positioned overlays** (`FirstTimeTip`): wrap ONLY the trigger element in its own `position: relative` box, not a whole section — `top`/`bottom: calc(100% + 8px)` is relative to that box's own height.

### 3. The styling idiom: real CSS classes + CSS custom properties, not utility classes or style props

Neither family uses Tailwind or a props-based style API. Style by applying real class names and reading real custom properties — never invent new ones.

| Concern | Glass family | Help family |
|---|---|---|
| Base class | `.glass` | `.adminCot .acHelp-*` (tooltip/button/popover/callout/ftt) |
| Variant classes | `.glass-refract`, `.glass-interactive`, `.glass-minimal`, `.glass-content-solid` | `data-variant="info"\|"warn"\|"success"` on `Callout` |
| Color/surface tokens | `--g-bg-page`, `--g-text`, `--g-text-2`, `--g-brand`, `--g-accent`, `--g-solid-bg` | `--ac-text`, `--ac-surface`, `--ac-border`, `--ac-warn`, `--ac-success`, `--ac-accent` |
| Blur/frost tokens | `--g-blur`, `--g-frost`, `--g-sat`, `--g-edge`, `--g-spec` | — |

Font stack is plain system fonts (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Helvetica, Arial, sans-serif`) via `--ac-font` — no custom webfont ships with this bundle, and none is needed for anything in scope.

### 4. Where the truth lives

- `tokens/` and the bundled `_ds_bundle.css` in this package carry the real compiled CSS — read it before inventing a class or token name.
- The `--ac-*` tokens are defined in an *unrelated* feature module's stylesheet (`admin-cotizaciones`) that the help system silently depends on — an existing architectural wart in the source repo, not something to "fix" when building with these components.
- `data-skin` variants (`gnome`, `anthropic`, `linear`, `intel-dark`) exist in the source CSS but are **not wired into this bundle's scope** — don't reference them.

### 5. One idiomatic build snippet

```jsx
<HelpProvider>
  <div data-appearance="night" style={{ background: "var(--g-bg-page)", padding: 24 }}>
    <Glass as="nav" refract style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
      <strong style={{ color: "rgb(var(--g-brand))" }}>BMC Uruguay</strong>
      <AppearanceToggle compact />
    </Glass>
    <GlassFilterSvg />
    <div className="adminCot" style={{ marginTop: 16 }}>
      <Callout id={HELP_ANCHORS.KPI_STALE} variant="warn" dismissible />
    </div>
  </div>
</HelpProvider>
```

Note: this is a distinct, separate visual language from the repo's `applied-ai-design` skill (calm warm palette, serif display) — the two are unrelated, and nothing in this bundle uses it.
