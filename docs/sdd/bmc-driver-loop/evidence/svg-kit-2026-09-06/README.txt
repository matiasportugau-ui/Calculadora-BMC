BMC Driver — Conductor rebuild

Five mobile screens, 390 × 844, based on Calculadora-BMC / src/components/driver.

HOW TO IMPORT INTO FIGMA
Drag login.svg, home.svg, load.svg, done.svg and profile.svg onto the canvas.
Alternatively import bmc-driver-board.svg to review all five together.
SVG import preserves vector layers. It does not create native Figma components,
variables, Auto Layout or prototype interactions; those still need to be linked.

PREVIEW
Open index.html in a browser. The navigation and selected links move between
screens. Forms, uploads and event actions are visual examples only.

DESIGN DECISIONS
Dark canvas #07111f, cards #122033, orange #f15a24, blue #2563eb,
green #22c55e. Dark text on orange improves primary-action contrast.
Secondary text is #9aabc0 for readability. Type uses Inter with Arial fallback.
Figma advertised SF Pro but its renderer produced blank text; Inter was verified.
Profile is unified in the approved dark theme. Current code's login copy is used.
Source CSS has gradient atmosphere rather than a warehouse image; no photo asset
has been fabricated. All trip details, names, times and totals are demo data.

STATUS
Direct Figma construction was blocked by the account's Starter MCP call limit.
The original Figma file contains incomplete foundations, not the finished screens.
These SVGs and the browser preview are the completed review deliverables.

Figma file: https://www.figma.com/design/V68EvDm9G1x6TMECH8Z0CG
Source: https://github.com/matiasportugau-ui/Calculadora-BMC/tree/main/src/components/driver
