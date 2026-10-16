# design-sync NOTES — calculadora-bmc glass + help primitives

## Why a hand-authored `entry.jsx` instead of synth-entry

calculadora-bmc has no build script producing a `dist/` (it's a Vite SPA, not
a library). The skill's documented "no build" fallback is synth-entry mode
(`export * from every src file`), but that would NOT work for this repo:

- All 7 scoped components (`Glass`, `GlassFilterSvg`, `AppearanceToggle`,
  `Tooltip`, `HelpButton`, `Callout`, `FirstTimeTip`) are `export default`
  only — confirmed by grep. ES `export *` never forwards a default export,
  so synth-entry would produce a bundle with zero of them reachable on
  `window.BmcPrimitives`.
- Synth-entry's directory walk is also unscoped — it would sweep all 211+
  files under `src/components/`, not just the 7 intended ones.

Fix: `.design-sync/entry.jsx` is a tiny hand-written barrel, pointed at via
`cfg.entry` (treated the same as a real `dist/index.js` would be). This
sidesteps both problems — nothing auto-scans once `--entry` resolves, and
the barrel re-exports every component (and both providers, and
`HELP_ANCHORS`) by name.

## Why `admin-cotizaciones/styles.css` is in the CSS closure

`src/components/help/styles.css` (the tooltip/walkthrough system's styles)
references `--ac-text`, `--ac-surface`, `--ac-warn`, etc. — but does not
define them itself. Those custom properties are actually declared under the
`.adminCot` base rule in `src/components/admin-cotizaciones/styles.css`, a
*different, unrelated feature module's* stylesheet. This is a real,
pre-existing architectural wart in the repo (the help system was built to be
used inside the admin-cotizaciones module and silently inherits its tokens),
not something introduced by this sync.

Verified safe to import whole: every one of `admin-cotizaciones/styles.css`'s
rules is prefixed `.adminCot ...` (confirmed: 0 bare/global selectors), so
pulling in the whole file can't leak unscoped styles into other designs.
User confirmed proceeding on this basis (not hand-extracting the token block
into a smaller owned file) on 2026-10-15.

**Consequence for every help-family preview**: compositions must be wrapped
in `<div className="adminCot">` or the CSS never matches at all.

## The 6 real FALLBACK_SOURCE anchor ids

`HelpProvider`'s embedded `FALLBACK_SOURCE` (used whenever no `source` prop
is passed — true for every preview here) only has real content for 6 ids,
out of 15 total defined in `HELP_ANCHORS`:

`topbar-live`, `kpi-pendientes`, `kpi-error`, `kpi-stale`, `batch-modal`,
`drawer-regenerate-hint`.

Any other id (including other real `HELP_ANCHORS` entries like
`TOPBAR_CMDK` or `DRAWER_SAVE_RESPONSE`) renders `null` by design — no
error, just nothing. Previews must use one of the 6 real ids above.

**The help component README's own usage example is stale**: it shows
`<HelpButton id="toolbar-status-pendientes" />`, which is not even a defined
`HELP_ANCHORS` entry, let alone one of the 6 fallback ids — it would render
nothing and fire the dev-only unknown-anchor console warning. Previews port
the README's *composition shape* (which component wraps what) but swap in
real ids.

## Known render warns (interaction states that can't be captured statically)

- `Tooltip`: opens on hover/focus via local `useState`; a static Playwright
  screenshot captures the closed state (children only, no visible tooltip
  bubble). This is expected, not a bug — the composition itself (a real
  element wrapped in a real `Tooltip`) is what's being verified.
- `HelpButton`: opens its popover on click; static capture shows the closed
  "?" button only.
- Both are legitimate per the skill's own guidance (interaction states that
  can't render statically are recorded here, not faked).

## `cfg.cssEntry` is copied VERBATIM — it does not resolve `@import`

Critical gotcha, discovered the hard way: `package-build.mjs` reads
`cfg.cssEntry`'s file with `readFileSync` and appends the raw text to
`_ds_bundle.css` — it never resolves `@import` statements inside that file.
`cssEntry` is designed for a single, already-self-contained compiled CSS
file (the way a real npm package's `dist/*.css` would be), not a hand-written
wrapper that `@import`s other source files.

An earlier revision of `.design-sync/styles-entry.css` used three
`@import "../src/..."` lines instead of real content. The build logged
`css: .design-sync/styles-entry.css (1 KB, copied)` with **no error** (the
literal `@import` text is valid-looking CSS, so nothing failed), and
`package-validate.mjs` reported a clean render check — because every
component still mounted successfully, just completely unstyled. The bug
only surfaced visually: Glass's frosted-glass effect was invisible (nothing
to blur against a flat background) in the render-check screenshots. Grepping
the compiled `ds-bundle/_ds_bundle.css` for `data-appearance` (0 matches)
confirmed the real CSS never made it in.

**Fix**: `.design-sync/styles-entry.css` now holds the actual, physically
concatenated content of the 3 source files (not `@import` statements). If
any of the 3 source files change, re-concatenate by hand:

```sh
cat > .design-sync/styles-entry.css << 'EOF'
/* <provenance header comment — keep it> */
EOF
cat src/styles/bmc-glass.css >> .design-sync/styles-entry.css
cat src/components/help/styles.css >> .design-sync/styles-entry.css
cat src/components/admin-cotizaciones/styles.css >> .design-sync/styles-entry.css
```

**Lesson for any future design-sync run in a non-library repo**: a clean
build + clean render check is NOT proof the real styling shipped — always
grep the compiled `_ds_bundle.css`/`styles.css` for a token/selector you
expect to be there, or eyeball a screenshot that would visibly differ if the
CSS were missing (a flat/unstyled render can look "clean" structurally while
being completely wrong visually).

## `[FONT_MISSING]` false positive: Inter / Space Grotesk / Cantarell / SF Pro Text

`package-validate.mjs` warns these 4 families are referenced but not
shipped. Verified via grep: they only appear inside
`.adminCot[data-skin="gnome"|"anthropic"|"linear"|"intel-dark"]` blocks in
`admin-cotizaciones/styles.css` — opt-in skin variants gated by a
`data-skin` attribute that none of the 7 synced components, or their
previews, ever set. The only font stack actually active in this scope is
the BASE `.adminCot { font-family: var(--ac-font); }` rule, which resolves
to `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", ...` —
a pure system-font fallback stack with no real missing-font risk (every name
in it is either a system keyword or a standard OS font). Not chased further;
accepted without sourcing font files, since the warning fires on CSS that is
structurally unreachable from anything in this sync's scope.

## `FirstTimeTip`/overlay previews: `position:relative` scope matters

`.acHelp-ftt[data-placement="bottom"]` uses `top: calc(100% + 8px)` — a
**percentage relative to the nearest `position:relative` ANCESTOR's own
height**, not to a sibling element's position. An early preview revision put
`position: relative` on the whole ~420px-tall card wrapper, so the tip
rendered ~420px below the trigger button regardless of how much extra
viewport height was given (confirmed via the actual per-cell grading
capture, `ds-bundle/_screenshots/review/` — the render-check's own
screenshot doesn't honor `cfg.overrides.*.viewport` and looked fine by
accident). Fix: wrap ONLY the anchor element (button/span) in its own
small `position: relative` box, exactly matching the real usage shown in
`src/components/help/README.md`. `cfg.overrides.FirstTimeTip: {"cardMode":
"single", "viewport": "480x420"}` in config.json gives the correctly-anchored
tip enough room for its real 3-line body + dismiss button.

**Lesson**: always judge overlay/absolute-positioned preview layout from
`ds-bundle/_screenshots/review/<group>__<Name>.png` (the real per-cell
grading capture), never from the render-check's own screenshot — the two
use different viewport/sizing logic and can disagree.

## Re-sync risks

- If `help/styles.css` or `admin-cotizaciones/styles.css`'s class names
  change, the CSS closure in `.design-sync/styles-entry.css` needs
  re-concatenating by hand (see the cssEntry section above — no automated
  detection of this cross-module dependency, and no `@import` shortcut).
- If `HelpProvider`'s `FALLBACK_SOURCE` seed is ever edited (ids added,
  removed, or renamed), the previews' hard-coded anchor ids need re-checking
  against the new seed.
- `componentSrcMap` is load-bearing (not just enrichment) here since there's
  no real `.d.ts` anywhere in this repo — if a future re-sync removes an
  entry, that component silently stops being discovered (`[ZERO_MATCH]` risk
  if all entries were ever removed).
