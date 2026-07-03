import React, { createContext, useContext, useState, useEffect } from 'react';

const PresupuestoLibreContext = createContext();

export function PresupuestoLibreProvider({ children }) {
  // UI State
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('paneles');

  // Presupuesto State (persisted to localStorage)
  const [librePanelLines, setLibrePanelLines] = useState([]);
  const [librePerfilQty, setLibrePerfilQty] = useState({});
  const [libreFijQty, setLibreFijQty] = useState({});
  const [libreSellQty, setLibreSellQty] = useState({});
  const [libreExtra, setLibreExtra] = useState({ texto: '', precio: '', unidades: '', cantidad: '' });
  const [flete, setFlete] = useState(0);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bmc_presupuesto_libre_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setLibrePanelLines(state.librePanelLines || []);
        setLibrePerfilQty(state.librePerfilQty || {});
        setLibreFijQty(state.libreFijQty || {});
        setLibreSellQty(state.libreSellQty || {});
        setLibreExtra(state.libreExtra || { texto: '', precio: '', unidades: '', cantidad: '' });
        setFlete(state.flete || 0);
      } catch (e) {
        console.warn('Failed to load presupuesto libre state from localStorage', e);
      }
    }

    const savedUI = localStorage.getItem('bmc_presupuesto_libre_ui');
    if (savedUI) {
      try {
        const ui = JSON.parse(savedUI);
        setIsOpen(ui.isOpen ?? false);
        setActiveTab(ui.activeTab || 'paneles');
      } catch (e) {
        console.warn('Failed to load presupuesto libre UI state', e);
      }
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    const state = {
      librePanelLines,
      librePerfilQty,
      libreFijQty,
      libreSellQty,
      libreExtra,
      flete,
    };
    localStorage.setItem('bmc_presupuesto_libre_state', JSON.stringify(state));
  }, [librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, flete]);

  // Save UI state
  useEffect(() => {
    const ui = { isOpen, activeTab };
    localStorage.setItem('bmc_presupuesto_libre_ui', JSON.stringify(ui));
  }, [isOpen, activeTab]);

  // Panel management
  const addPanelLine = (familia, espesor, color) => {
    setLibrePanelLines([
      ...librePanelLines,
      { familia, espesor, color, m2: 0, id: Date.now() },
    ]);
  };

  const removePanelLine = (id) => {
    setLibrePanelLines(librePanelLines.filter(line => line.id !== id));
  };

  const updatePanelLine = (id, patch) => {
    setLibrePanelLines(librePanelLines.map(line =>
      line.id === id ? { ...line, ...patch } : line
    ));
  };

  // Perfil management
  const addPerfil = (perfilId, qty) => {
    setLibrePerfilQty({
      ...librePerfilQty,
      [perfilId]: (librePerfilQty[perfilId] || 0) + (qty || 1),
    });
  };

  const removePerfil = (perfilId) => {
    const newQty = { ...librePerfilQty };
    delete newQty[perfilId];
    setLibrePerfilQty(newQty);
  };

  const updatePerfilQty = (perfilId, qty) => {
    if (qty <= 0) {
      removePerfil(perfilId);
    } else {
      setLibrePerfilQty({
        ...librePerfilQty,
        [perfilId]: qty,
      });
    }
  };

  // Fijación management
  const addFijacion = (fijacionKey, qty) => {
    setLibreFijQty({
      ...libreFijQty,
      [fijacionKey]: (libreFijQty[fijacionKey] || 0) + (qty || 1),
    });
  };

  const removeFijacion = (fijacionKey) => {
    const newQty = { ...libreFijQty };
    delete newQty[fijacionKey];
    setLibreFijQty(newQty);
  };

  const updateFijacionQty = (fijacionKey, qty) => {
    if (qty <= 0) {
      removeFijacion(fijacionKey);
    } else {
      setLibreFijQty({
        ...libreFijQty,
        [fijacionKey]: qty,
      });
    }
  };

  // Sellador management
  const addSellador = (selladorKey, qty) => {
    setLibreSellQty({
      ...libreSellQty,
      [selladorKey]: (libreSellQty[selladorKey] || 0) + (qty || 1),
    });
  };

  const removeSellador = (selladorKey) => {
    const newQty = { ...libreSellQty };
    delete newQty[selladorKey];
    setLibreSellQty(newQty);
  };

  const updateSelladorQty = (selladorKey, qty) => {
    if (qty <= 0) {
      removeSellador(selladorKey);
    } else {
      setLibreSellQty({
        ...libreSellQty,
        [selladorKey]: qty,
      });
    }
  };

  // Clear all
  const clearAll = () => {
    setLibrePanelLines([]);
    setLibrePerfilQty({});
    setLibreFijQty({});
    setLibreSellQty({});
    setLibreExtra({ texto: '', precio: '', unidades: '', cantidad: '' });
    setFlete(0);
  };

  const value = {
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
    libreExtra,
    setLibreExtra,
    flete,
    setFlete,

    // Panel actions
    addPanelLine,
    removePanelLine,
    updatePanelLine,

    // Perfil actions
    addPerfil,
    removePerfil,
    updatePerfilQty,

    // Fijación actions
    addFijacion,
    removeFijacion,
    updateFijacionQty,

    // Sellador actions
    addSellador,
    removeSellador,
    updateSelladorQty,

    // Utilities
    clearAll,
  };

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
