/**
 * In-app index for static HTML mockups (served from public/design-preview/ when copied).
 * Fallback links to repo paths for local dev with python http.server on docs folder.
 */

const BASE = "/design-preview";
const REPO_FALLBACK = "http://localhost:8765";

const PREMIUM = [
  { studio: "Studio Tahoe", folder: "studio-1-tahoe" },
  { studio: "Operativo Dense", folder: "studio-2-operativo" },
  { studio: "Warm Commerce", folder: "studio-3-warm" },
  { studio: "Field Industrial", folder: "studio-4-industrial" },
  { studio: "Responsive Lab", folder: "studio-5-responsive" },
  { studio: "BMC Glass Premium", folder: "studio-6-bmc-glass" },
];

const LAYERS = ["L0-shell", "L1-wizard", "L2-visor", "L3-hub"];
const BPS = ["mobile", "tablet", "desktop"];

function link(path) {
  return `${BASE}${path}`;
}

export default function DesignMockupsPage() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ color: "#1a3a5c" }}>Mockups HTML — Design Competition</h1>
      <p style={{ color: "#6e6e73", maxWidth: 640 }}>
        Galería estática complementaria al selector de temas en la app. Si los enlaces fallan en preview,
        corré <code>python3 -m http.server 8765</code> en{" "}
        <code>docs/team/design-competition</code> y usá{" "}
        <a href={`${REPO_FALLBACK}/premium-previews/index.html`}>{REPO_FALLBACK}</a>.
      </p>

      <h2 style={{ marginTop: 32 }}>Premium Glass (18)</h2>
      {PREMIUM.map(({ studio, folder }) => (
        <section key={folder} style={{ marginBottom: 24, padding: 16, border: "1px solid #e5e5ea", borderRadius: 12 }}>
          <h3 style={{ margin: "0 0 12px" }}>{studio}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["mobile", "tablet", "desktop"].map((bp) => (
              <a
                key={bp}
                href={link(`/premium-previews/${folder}/premium-${bp}.html`)}
                style={chip}
                target="_blank"
                rel="noreferrer"
              >
                Premium · {bp}
              </a>
            ))}
          </div>
        </section>
      ))}

      <h2 style={{ marginTop: 32 }}>Competition layers (60)</h2>
      <p style={{ fontSize: 13, color: "#6e6e73" }}>
        <a href={link("/index.html")} style={{ color: "#0071e3" }}>
          Índice completo competition
        </a>
      </p>
      {PREMIUM.slice(0, 5).map(({ studio, folder }) => (
        <section key={folder} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15 }}>{studio}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {LAYERS.flatMap((layer) =>
              BPS.map((bp) => {
                const file = `${layer}-${bp}.html`;
                return (
                  <a
                    key={file}
                    href={link(`/${folder}/${file}`)}
                    style={{ ...chip, fontSize: 11, padding: "4px 8px" }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {layer} · {bp}
                  </a>
                );
              })
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

const chip = {
  display: "inline-block",
  padding: "8px 12px",
  background: "#f5f5f7",
  borderRadius: 8,
  textDecoration: "none",
  color: "#1d1d1f",
  fontSize: 13,
  border: "1px solid #e5e5ea",
};
