import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getFleteDefault } from '../utils/calculatorConfig';

// Data context: single source of truth for the Presupuesto Libre cart, shared
// by the floating panel AND PanelinCalculadoraV3 (which destructures the same
// identifiers — see usePresupuestoLibre() call there). UI state (isOpen /
// activeTab) lives in a separate context so panel open/close and tab changes
// don't re-render the calculator.
const PresupuestoLibreContext = createContext();
const PresupuestoLibreUiContext = createContext();

const STATE_KEY = 'bmc_presupuesto_libre_state';
const UI_KEY = 'bmc_presupuesto_libre_ui';

const EMPTY_EXTRA = { texto: '', precio: '', unidades: '', cantidad: '' };

function loadSaved(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage`, e);
    return null;
  }
}

function newLineId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Ensure every panel line carries an id — the calculator's restore/reset/add
// paths write id-less lines, and updatePanelLine/removePanelLine match by id.
// Returns the same reference when nothing is missing.
function normalizeLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.some((line) => !line?.id)
    ? lines.map((line) => (line?.id ? line : { ...line, id: newLineId() }))
    : lines;
}

// add/remove/updateQty triplet over a {key: qty} map, using functional
// updates so rapid consecutive adds never work from a stale snapshot.
function makeQtyActions(setQty) {
  const remove = (key) => {
    setQty((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  return {
    add: (key, qty) => {
      setQty((prev) => ({ ...prev, [key]: (prev[key] || 0) + (qty || 1) }));
    },
    remove,
    updateQty: (key, qty) => {
      if (qty <= 0) {
        remove(key);
      } else {
        setQty((prev) => ({ ...prev, [key]: qty }));
      }
    },
  };
}

export function PresupuestoLibreProvider({ children }) {
  // Hydrate lazily from localStorage so the save effect never sees (and
  // persists) the empty initial state before hydration lands.
  const [saved] = useState(() => loadSaved(STATE_KEY));
  const [savedUI] = useState(() => loadSaved(UI_KEY));

  // UI State — isOpen is intentionally NOT restored: the panel mounts on all
  // routes, and restoring it would auto-open a full-screen overlay on reload.
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(savedUI?.activeTab || 'paneles');

  // Presupuesto State (persisted to localStorage)
  const [librePanelLines, _setLibrePanelLines] = useState(() => normalizeLines(saved?.librePanelLines));
  const [librePerfilQty, setLibrePerfilQty] = useState(saved?.librePerfilQty || {});
  // libreFijQty holds fijaciones AND herramientas: the quote engine
  // (computePresupuestoLibreCatalogo) resolves its keys against both
  // FIJACIONES and HERRAMIENTAS.
  const [libreFijQty, setLibreFijQty] = useState(saved?.libreFijQty || {});
  const [libreSellQty, setLibreSellQty] = useState(saved?.libreSellQty || {});
  const [libreExtra, setLibreExtra] = useState(saved?.libreExtra || EMPTY_EXTRA);
  // `||` (not `??`): earlier panel builds persisted flete: 0; the calculator's
  // canon default is getFleteDefault() and it re-applied it every session.
  const [flete, setFlete] = useState(saved?.flete || getFleteDefault());

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      const state = {
        librePanelLines,
        librePerfilQty,
        libreFijQty,
        libreSellQty,
        libreExtra,
        flete,
      };
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save presupuesto libre state to localStorage', e);
    }
  }, [librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, flete]);

  // Save UI state (activeTab only — see isOpen note above)
  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ activeTab }));
    } catch (e) {
      console.warn('Failed to save presupuesto libre UI state to localStorage', e);
    }
  }, [activeTab]);

  const actions = useMemo(() => {
    // Normalizing raw setter: accepts value or updater form, ensures line ids.
    const setLibrePanelLines = (valueOrFn) => {
      _setLibrePanelLines((prev) =>
        normalizeLines(typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn)
      );
    };

    const perfil = makeQtyActions(setLibrePerfilQty);
    const fijacion = makeQtyActions(setLibreFijQty);
    const sellador = makeQtyActions(setLibreSellQty);

    return {
      // Raw setters (used by the calculator's accordion/restore/reset paths)
      setLibrePanelLines,
      setLibrePerfilQty,
      setLibreFijQty,
      setLibreSellQty,

      // Panel actions
      addPanelLine: (familia, espesor, color, m2 = 0) => {
        _setLibrePanelLines((prev) => [
          ...prev,
          { familia, espesor, color, m2, id: newLineId() },
        ]);
      },
      removePanelLine: (id) => {
        _setLibrePanelLines((prev) => prev.filter((line) => line.id !== id));
      },
      updatePanelLine: (id, patch) => {
        _setLibrePanelLines((prev) => prev.map((line) =>
          line.id === id ? { ...line, ...patch } : line
        ));
      },

      // Perfil actions (keys are the engine's stable pt:/pp: catalog ids)
      addPerfil: perfil.add,
      removePerfil: perfil.remove,
      updatePerfilQty: perfil.updateQty,

      // Fijación actions
      addFijacion: fijacion.add,
      removeFijacion: fijacion.remove,
      updateFijacionQty: fijacion.updateQty,

      // Sellador actions
      addSellador: sellador.add,
      removeSellador: sellador.remove,
      updateSelladorQty: sellador.updateQty,

      // Herramientas share the fijaciones map (engine contract — see note
      // on libreFijQty above)
      addHerramienta: fijacion.add,
      removeHerramienta: fijacion.remove,
      updateHerramientaQty: fijacion.updateQty,

      // Utilities — flete resets to the calculator's default, not 0: flete is
      // the global freight shared with every calculator scenario.
      clearAll: () => {
        _setLibrePanelLines([]);
        setLibrePerfilQty({});
        setLibreFijQty({});
        setLibreSellQty({});
        setLibreExtra(EMPTY_EXTRA);
        setFlete(getFleteDefault());
      },
    };
  }, []);

  const value = useMemo(() => ({
    // State
    librePanelLines,
    librePerfilQty,
    libreFijQty,
    libreSellQty,
    libreExtra,
    setLibreExtra,
    flete,
    setFlete,

    ...actions,
  }), [librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, flete, actions]);

  const uiValue = useMemo(() => ({
    isOpen,
    setIsOpen,
    activeTab,
    setActiveTab,
  }), [isOpen, activeTab]);

  return (
    <PresupuestoLibreContext.Provider value={value}>
      <PresupuestoLibreUiContext.Provider value={uiValue}>
        {children}
      </PresupuestoLibreUiContext.Provider>
    </PresupuestoLibreContext.Provider>
  );
}

export function usePresupuestoLibre() {
  const context = useContext(PresupuestoLibreContext);
  if (!context) {
    throw new Error('usePresupuestoLibre must be used within PresupuestoLibreProvider');
  }
  return context;
}

export function usePresupuestoLibreUi() {
  const context = useContext(PresupuestoLibreUiContext);
  if (!context) {
    throw new Error('usePresupuestoLibreUi must be used within PresupuestoLibreProvider');
  }
  return context;
}
