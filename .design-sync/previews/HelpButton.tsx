import { HelpButton, HELP_ANCHORS } from "calculadora-bmc-primitives";

// Opens its popover on click — static capture shows the closed "?" button
// only (real, styled via .acHelp-button). See NOTES.md "Known render warns".
// Must be wrapped in .adminCot; real anchor ids only.

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="adminCot" style={{ padding: 16, display: "flex", alignItems: "center", gap: 8 }}>
      {children}
    </div>
  );
}

export function NextToHeading() {
  return (
    <Wrap>
      <h2 style={{ margin: 0, fontSize: 16 }}>Filtros</h2>
      <HelpButton id={HELP_ANCHORS.KPI_PENDIENTES} />
    </Wrap>
  );
}

export function NextToAction() {
  return (
    <Wrap>
      <button type="button" style={{ padding: "8px 14px" }}>
        Generar IA en lote
      </button>
      <HelpButton id={HELP_ANCHORS.TOOLBAR_BATCH_GENERATE} label="Más info" />
    </Wrap>
  );
}
