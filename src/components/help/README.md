# Help / Tutorial Components

Componentes UI que consumen el output del walkthrough (`docs/walkthrough/admin-cot/source.json`) y muestran ayuda contextual dentro del Administrador de Cotizaciones.

## Componentes

| Componente | Cuándo usar | Texto | Decoración |
|---|---|---|---|
| `<Tooltip id="..." />` | Wrap de un elemento — ayuda corta on hover/focus | `helpText.short` | Ninguno |
| `<HelpButton id="..." />` | Anchor "?" junto a un control | `helpText.long` en popover | Botón circular "?" |
| `<Callout id="..." dismissible />` | Banner persistente (warning, info) | `helpText.long` | Barra lateral coloreada |
| `<FirstTimeTip id="..." />` | Aparece una vez, se descarta para siempre | short + long | Bubble con CTA "Entendido" |

## API

```jsx
import { HelpProvider } from "./help/HelpProvider.jsx";
import Tooltip from "./help/Tooltip.jsx";
import HelpButton from "./help/HelpButton.jsx";
import Callout from "./help/Callout.jsx";
import FirstTimeTip from "./help/FirstTimeTip.jsx";
import "./help/styles.css";

// (opcional) si ya corriste el walkthrough, importá el source real
// import helpSource from "../../docs/walkthrough/admin-cot/source.json";

export default function MyModule() {
  return (
    <HelpProvider /* source={helpSource} */>
      <div className="adminCot">
        <Tooltip id="kpi-stale">
          <Stat label="≥14 días" value={5} />
        </Tooltip>

        <h2>
          Filtros
          <HelpButton id="toolbar-status-pendientes" />
        </h2>

        <Callout id="drawer-regenerate-hint" variant="info" dismissible />

        <div style={{ position: "relative" }}>
          <button>Generar IA</button>
          <FirstTimeTip id="batch-modal" placement="bottom" />
        </div>
      </div>
    </HelpProvider>
  );
}
```

## Source resolution

`HelpProvider` acepta un prop `source`. Si no se pasa:

1. Usa el **`FALLBACK_SOURCE`** embebido (~6 steps seed) — útil mientras el walkthrough no haya corrido todavía
2. Cuando el walkthrough corre y commitea `source.json`, el caller puede importarlo y pasarlo via prop

```jsx
import helpSource from "../../docs/walkthrough/admin-cot/source.json";
<HelpProvider source={helpSource}>…</HelpProvider>
```

Si un `id` no existe en el source, los componentes renderizan **null** (sin overhead, sin warnings). Eso permite anclar `<HelpButton id="future-feature" />` antes de tener helpText escrito.

## Dismissal (FirstTimeTip + Callout dismissible)

Persiste un Set de ids descartados en `localStorage["bmc_admin_cot_help_dismissed"]`.

Reset programático:

```jsx
import { useResetHelp } from "./help/useHelp.js";
const reset = useResetHelp();
// reset() borra todos los dismissed → los tips reaparecen
```

Idea: agregar en el CommandPalette un item "Mostrar tutoriales de nuevo" que llama `reset()`.

## Accesibilidad

- Tooltip: `role="tooltip"`, aparece on hover Y on focus
- HelpButton: `aria-haspopup="dialog"`, `aria-expanded`, popover con `role="dialog"` + cierre con Escape
- Callout: `role="note"` con `aria-label={intent}`
- FirstTimeTip: `role="status"` con `aria-live="polite"`
- Focus rings 2px via `:focus-visible` (hereda los tokens del módulo)
- `prefers-reduced-motion` desactiva las animaciones

## Phase 3 (futuro)

- i18n: source.json soporta `helpText.{es, en, pt}`. Ahora solo `es`.
- Admin panel para editar helpText sin tocar source.json (Google Sheets-backed).
- Analytics: emitir evento cuando alguien abre un HelpButton (qué es lo más consultado).
- Walkthrough mode: tour guiado paso a paso (FirstTimeTip encadenados).
