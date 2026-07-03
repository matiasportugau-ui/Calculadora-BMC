// ═══════════════════════════════════════════════════════════════════════════
// ScenarioCards.jsx — Selector de escenario como "modos de juego".
// Capa game-like (rama claude/liquid-glass-quoter). Solo se monta dentro de
// DesignPreviewGate: producción no carga este módulo.
//
// Integración: recibe `scenario` (string actual) y `onSelect(scenarioId)` que
// el cotizador canónico conecta a su setScenario existente. No duplica estado.
// Los IDs son los del scenarioOrchestrator: solo_techo | solo_fachada |
// techo_fachada | camara_frig.
// ═══════════════════════════════════════════════════════════════════════════
import "../../styles/lg-quoter.css";

const SCENARIOS = [
  {
    id: "solo_techo",
    name: "Solo Techo",
    desc: "ISODEC · ISOROOF sobre estructura existente",
    tag: "MÁS USADO",
    hot: true,
  },
  {
    id: "solo_fachada",
    name: "Solo Fachada",
    desc: "Cerramiento vertical, junta oculta o vista",
    tag: "FACHADA",
  },
  {
    id: "techo_fachada",
    name: "Techo + Fachada",
    desc: "Obra completa: envolvente térmica total",
    tag: "COMPLETO",
  },
  {
    id: "camara_frig",
    name: "Cámara Frigorífica",
    desc: "Paneles frigoríficos + puertas + accesorios",
    tag: "−18°C",
  },
];

/** Mini-arte isométrico por escenario (SVG inline, cero assets externos). */
function ScenarioArt({ id }) {
  const common = { width: 110, height: 110, viewBox: "0 0 110 110", "aria-hidden": true };
  if (id === "solo_techo") {
    return (
      <svg {...common}>
        <polygon points="18,62 62,38 96,52 52,76" fill="url(#lgqRoof)" stroke="rgba(0,0,0,.25)" />
        <polygon points="18,66 52,80 96,56 96,62 52,86 18,72" fill="rgba(242,244,246,.14)" />
        <defs>
          <linearGradient id="lgqRoof" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF8A50" /><stop offset="1" stopColor="#E5510F" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (id === "solo_fachada") {
    return (
      <svg {...common}>
        <polygon points="28,30 52,38 52,92 28,84" fill="url(#lgqWallA)" stroke="rgba(0,0,0,.2)" />
        <polygon points="56,38 84,30 84,84 56,92" fill="url(#lgqWallB)" stroke="rgba(0,0,0,.2)" />
        <line x1="40" y1="33" x2="40" y2="87" stroke="rgba(0,0,0,.18)" />
        <line x1="70" y1="33" x2="70" y2="88" stroke="rgba(0,0,0,.15)" />
        <defs>
          <linearGradient id="lgqWallA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5EA3E6" /><stop offset="1" stopColor="#3B78BC" />
          </linearGradient>
          <linearGradient id="lgqWallB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8FC1F0" /><stop offset="1" stopColor="#5EA3E6" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (id === "techo_fachada") {
    return (
      <svg {...common}>
        <polygon points="30,44 55,32 84,42 58,55" fill="url(#lgqRoof2)" stroke="rgba(0,0,0,.25)" />
        <polygon points="30,46 56,57 56,90 30,80" fill="#4E86BF" stroke="rgba(0,0,0,.2)" />
        <polygon points="60,57 84,44 84,78 60,90" fill="#8FC1F0" stroke="rgba(0,0,0,.2)" />
        <defs>
          <linearGradient id="lgqRoof2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF8A50" /><stop offset="1" stopColor="#E5510F" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="28" y="30" width="54" height="54" rx="5" fill="url(#lgqFrig)" stroke="rgba(0,0,0,.15)" />
      <rect x="49" y="52" width="10" height="26" rx="2" fill="#141A22" />
      <text x="82" y="24" textAnchor="end" fontFamily="ui-monospace,monospace" fontSize="10" fill="#4A90D9">−18°C</text>
      <defs>
        <linearGradient id="lgqFrig" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8F0F5" /><stop offset="1" stopColor="#B7C9D6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function ScenarioCards({ scenario, onSelect }) {
  return (
    <div className="lgq-scenarios" data-lg-quoter data-testid="lgq-scenarios">
      <div className="lgq-scenarios__brand">
        <div className="lgq-scenarios__logo">B</div>
        <div className="lgq-scenarios__brandtxt">BMC CONSTRUCTOR</div>
      </div>
      <h1 className="lgq-scenarios__title">
        ¿Qué vamos a <em>construir</em> hoy?
      </h1>
      <p className="lgq-scenarios__sub">Elegí el tipo de obra. El precio se arma solo.</p>
      <div className="lgq-scenarios__grid" role="group" aria-label="Tipo de obra">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`lgq-card${s.hot ? " lgq-card--hot" : ""}`}
            aria-pressed={scenario === s.id}
            onClick={() => onSelect?.(s.id)}
            data-testid={`lgq-card-${s.id}`}
          >
            <span className="lgq-card__tag">{s.tag}</span>
            <span className="lgq-card__art"><ScenarioArt id={s.id} /></span>
            <span className="lgq-card__name">{s.name}</span>
            <span className="lgq-card__desc">{s.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
