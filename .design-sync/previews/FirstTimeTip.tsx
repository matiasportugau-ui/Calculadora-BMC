import { FirstTimeTip, HELP_ANCHORS } from "calculadora-bmc-primitives";

// Visible by default (undismissed in a fresh browser context — no
// localStorage entry yet). Must be wrapped in .adminCot; real anchor ids
// only (see NOTES.md).
//
// .acHelp-ftt is position:absolute with top/bottom: calc(100% + 8px) — a
// PERCENTAGE relative to its nearest position:relative ANCESTOR's own
// height, not to a sibling's position. The real usage (src/components/
// help/README.md) wraps ONLY the anchor element in a small position:relative
// box, not the whole card — getting this wrong (an earlier revision put
// position:relative on the full-height outer wrapper) makes "100%" resolve
// against the WHOLE card's height instead of the button's, so the tip
// renders far below/above the visible anchor regardless of how much total
// space the card has. cfg.overrides.FirstTimeTip (config.json) gives the
// single-card capture a generous 480x420 viewport so the tip's 3-line body
// + dismiss button has room once it's correctly anchored.

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="adminCot" style={{ padding: 16, width: 480, height: 420 }}>
      {children}
    </div>
  );
}

export function Bottom() {
  return (
    <Card>
      <div style={{ position: "relative", display: "inline-block" }}>
        <button type="button" style={{ padding: "8px 14px" }}>
          Generar IA
        </button>
        <FirstTimeTip id={HELP_ANCHORS.TOOLBAR_BATCH_GENERATE} placement="bottom" />
      </div>
    </Card>
  );
}

export function Top() {
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>● En vivo</span>
          <FirstTimeTip id={HELP_ANCHORS.TOPBAR_LIVE} placement="top" />
        </div>
      </div>
    </Card>
  );
}
