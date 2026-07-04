import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const PresupuestoLibreContext = createContext();

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
  const [librePanelLines, setLibrePanelLines] = useState(saved?.librePanelLines || []);
  const [librePerfilQty, setLibrePerfilQty] = useState(saved?.librePerfilQty || {});
  // libreFijQty holds fijaciones AND herramientas: the quote engine
  // (computePresupuestoLibreCatalogo) resolves its keys against both
  // FIJACIONES and HERRAMIENTAS.
  const [libreFijQty, setLibreFijQty] = useState(saved?.libreFijQty || {});
  const [libreSellQty, setLibreSellQty] = useState(saved?.libreSellQty || {});
  const [libreServiciosQty, setLibreServiciosQty] = useState(saved?.libreServiciosQty || {});
  const [libreExtra, setLibreExtra] = useState(saved?.libreExtra || EMPTY_EXTRA);
  const [flete, setFlete] = useState(saved?.flete || 0);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      const state = {
        librePanelLines,
        librePerfilQty,
        libreFijQty,
        libreSellQty,
        libreServiciosQty,
        libreExtra,
        flete,
      };
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save presupuesto libre state to localStorage', e);
    }
  }, [librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreServiciosQty, libreExtra, flete]);

  // Save UI state (activeTab only — see isOpen note above)
  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ activeTab }));
    } catch (e) {
      console.warn('Failed to save presupuesto libre UI state to localStorage', e);
    }
  }, [activeTab]);

  const actions = useMemo(() => {
    const perfil = makeQtyActions(setLibrePerfilQty);
    const fijacion = makeQtyActions(setLibreFijQty);
    const sellador = makeQtyActions(setLibreSellQty);
    const servicio = makeQtyActions(setLibreServiciosQty);

    return {
      // Panel actions
      addPanelLine: (familia, espesor, color, m2 = 0) => {
        setLibrePanelLines((prev) => [
          ...prev,
          { familia, espesor, color, m2, id: newLineId() },
        ]);
      },
      removePanelLine: (id) => {
        setLibrePanelLines((prev) => prev.filter((line) => line.id !== id));
      },
      updatePanelLine: (id, patch) => {
        setLibrePanelLines((prev) => prev.map((line) =>
          line.id === id ? { ...line, ...patch } : line
        ));
      },

      // Perfil actions
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

      // Servicios actions
      addServicio: servicio.add,
      removeServicio: servicio.remove,
      updateServicioQty: servicio.updateQty,

      // Herramientas share the fijaciones map (engine contract — see note
      // on libreFijQty above)
      addHerramienta: fijacion.add,
      removeHerramienta: fijacion.remove,
      updateHerramientaQty: fijacion.updateQty,

      // Utilities
      clearAll: () => {
        setLibrePanelLines([]);
        setLibrePerfilQty({});
        setLibreFijQty({});
        setLibreSellQty({});
        setLibreServiciosQty({});
        setLibreExtra(EMPTY_EXTRA);
        setFlete(0);
      },
    };
  }, []);

  const value = useMemo(() => ({
    // UI
    isOpen,
    setIsOpen,
    activeTab,
    setActiveTab,

    // State
    librePanelLines,
    librePerfilQty,
    libreFijQty,
    libreSellQty,
    libreServiciosQty,
    libreExtra,
    setLibreExtra,
    flete,
    setFlete,

    ...actions,
  }), [isOpen, activeTab, librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreServiciosQty, libreExtra, flete, actions]);

  return (
    <PresupuestoLibreContext.Provider value={value}>
      {children}
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
