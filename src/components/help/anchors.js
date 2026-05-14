/**
 * HELP_ANCHORS — single source of truth for help-anchor ids in /hub/cotizaciones.
 *
 * Why a const + lint rule:
 *   useHelp(id) returns null silently when id is unknown (typo or missing
 *   step). Frozen const + custom ESLint rule (`bmc-help/anchor-must-use-const`)
 *   force consumers to import HELP_ANCHORS.X instead of passing raw strings,
 *   catching typos at lint time. Dev-warn in useHelp covers the
 *   "anchor exists but no step in source.json" mismatch case explicitly.
 *
 * Schema designed in:
 *   /Users/matias/.claude/team/runs/2026-05-13-2343-autodisenio-pending-tasks-deep-audit/artifacts/drafts/02-skin-help-anchoring-proposal.md § D
 *
 * 15 anchors total — 6 already in FALLBACK_SOURCE (HelpProvider.jsx),
 * 9 added in PR #223 alongside Phase 3 wiring (draft 04).
 */

export const HELP_ANCHORS = Object.freeze({
  // Topbar
  TOPBAR_LIVE: "topbar-live",
  TOPBAR_CMDK: "topbar-cmdk",
  TOPBAR_SKIN_PICKER: "topbar-skin-picker",

  // KPIs (StatStrip)
  KPI_PENDIENTES: "kpi-pendientes",
  KPI_APROBADAS: "kpi-aprobadas",
  KPI_ERROR: "kpi-error",
  KPI_STALE: "kpi-stale",

  // Toolbar
  TOOLBAR_SCOPE: "toolbar-scope",
  TOOLBAR_BATCH_GENERATE: "batch-modal",
  TOOLBAR_SYNC_CRM: "toolbar-sync-crm",
  TOOLBAR_BULK_MARK_ENVIADAS: "bulk-mark-enviadas",

  // DetailDrawer
  DRAWER_REGENERATE_HINT: "drawer-regenerate-hint",
  DRAWER_SAVE_RESPONSE: "drawer-save-response",
  DRAWER_APROBAR: "drawer-aprobar",
  DRAWER_MARCAR_ENVIADA: "drawer-marcar-enviada",
});

const ANCHOR_SET = new Set(Object.values(HELP_ANCHORS));

/**
 * @param {string} id
 * @returns {boolean} true if id is a known anchor in HELP_ANCHORS.
 */
export function isKnownAnchor(id) {
  return ANCHOR_SET.has(id);
}
