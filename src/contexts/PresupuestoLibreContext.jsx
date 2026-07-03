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
  const [libreServiciosQty, setLibreServiciosQty] = useState({});
  const [libreHerramientasQty, setLibreHerramientasQty] = useState({});
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
        setLibreServiciosQty(state.libreServiciosQty || {});
        setLibreHerramientasQty(state.libreHerramientasQty || {});
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
    try {
      const state = {
        librePanelLines,
        librePerfilQty,
        libreFijQty,
        libreSellQty,
        libreServiciosQty,
        libreHerramientasQty,
        libreExtra,
        flete,
      };
      localStorage.setItem('bmc_presupuesto_libre_state', JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save presupuesto libre state to localStorage', e);
    }
  }, [librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreServiciosQty, libreHerramientasQty, libreExtra, flete]);

  // Save UI state
  useEffect(() => {
    try {
      const ui = { isOpen, activeTab };
      localStorage.setItem('bmc_presupuesto_libre_ui', JSON.stringify(ui));
    } catch (e) {
      console.warn('Failed to save presupuesto libre UI state to localStorage', e);
    }
  }, [isOpen, activeTab]);

  // Panel management
  const addPanelLine = (familia, espesor, color, m2 = 0) => {
    setLibrePanelLines([
      ...librePanelLines,
      { familia, espesor, color, m2, id: Date.now() },
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

  // Servicios management
  const addServicio = (servicioKey, qty) => {
    setLibreServiciosQty({
      ...libreServiciosQty,
      [servicioKey]: (libreServiciosQty[servicioKey] || 0) + (qty || 1),
    });
  };

  const removeServicio = (servicioKey) => {
    const newQty = { ...libreServiciosQty };
    delete newQty[servicioKey];
    setLibreServiciosQty(newQty);
  };

  const updateServicioQty = (servicioKey, qty) => {
    if (qty <= 0) {
      removeServicio(servicioKey);
    } else {
      setLibreServiciosQty({
        ...libreServiciosQty,
        [servicioKey]: qty,
      });
    }
  };

  // Herramientas management
  const addHerramienta = (herramientaKey, qty) => {
    setLibreHerramientasQty({
      ...libreHerramientasQty,
      [herramientaKey]: (libreHerramientasQty[herramientaKey] || 0) + (qty || 1),
    });
  };

  const removeHerramienta = (herramientaKey) => {
    const newQty = { ...libreHerramientasQty };
    delete newQty[herramientaKey];
    setLibreHerramientasQty(newQty);
  };

  const updateHerramientaQty = (herramientaKey, qty) => {
    if (qty <= 0) {
      removeHerramienta(herramientaKey);
    } else {
      setLibreHerramientasQty({
        ...libreHerramientasQty,
        [herramientaKey]: qty,
      });
    }
  };

  // Clear all
  const clearAll = () => {
    setLibrePanelLines([]);
    setLibrePerfilQty({});
    setLibreFijQty({});
    setLibreSellQty({});
    setLibreServiciosQty({});
    setLibreHerramientasQty({});
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
    libreServiciosQty,
    libreHerramientasQty,
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

    // Servicios actions
    addServicio,
    removeServicio,
    updateServicioQty,

    // Herramientas actions
    addHerramienta,
    removeHerramienta,
    updateHerramientaQty,

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
