// Hand-authored barrel entry for design-sync. calculadora-bmc has no build
// script producing a dist/ (SPA, not a library), so this plays the role a
// one-line `tsup` package entry would: named re-exports of each primitive's
// default export, so they surface on window.BmcPrimitives at all. The
// converter's "no build" synth-entry fallback would NOT work here: all 7
// components below are `export default`-only, and synth-entry generates
// `export * from <file>`, which ES modules never forward default exports
// through. Both providers are re-exported too so previews share the exact
// same context instance their consumers use (same resolved module path in
// one esbuild graph = one instance). HELP_ANCHORS is re-exported so preview
// code can reference real anchor ids instead of bare strings.
export { default as Glass } from "../src/components/glass/Glass.jsx";
export { default as GlassFilterSvg } from "../src/components/glass/GlassFilterSvg.jsx";
export { default as AppearanceToggle } from "../src/components/glass/AppearanceToggle.jsx";
export { default as Tooltip } from "../src/components/help/Tooltip.jsx";
export { default as HelpButton } from "../src/components/help/HelpButton.jsx";
export { default as Callout } from "../src/components/help/Callout.jsx";
export { default as FirstTimeTip } from "../src/components/help/FirstTimeTip.jsx";
export { BmcAppearanceProvider } from "../src/contexts/BmcAppearanceProvider.jsx";
export { HelpProvider } from "../src/components/help/HelpProvider.jsx";
export { HELP_ANCHORS } from "../src/components/help/useHelp.js";
