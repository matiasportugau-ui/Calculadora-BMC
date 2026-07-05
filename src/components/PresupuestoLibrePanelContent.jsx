import React from 'react';
import { usePresupuestoLibre, usePresupuestoLibreUi } from '../contexts/PresupuestoLibreContext';
import { p, PANELS_TECHO, PANELS_PARED, PERFIL_TECHO, PERFIL_PARED, FIJACIONES, SELLADORES, SERVICIOS, HERRAMIENTAS, PRESUPUESTO_LIBRE_IDS } from '../data/constants';
import { PresupuestoLibreCard } from './PresupuestoLibreCard';
import { PresupuestoLibreCart } from './PresupuestoLibreCart';
import { fmtPrice } from '../utils/helpers';
import './PresupuestoLibrePanelContent.css';

const TABS = [
  { id: 'paneles', label: 'Paneles' },
  { id: 'perfileria', label: 'Perfilería' },
  { id: 'fijaciones', label: 'Fijaciones' },
  { id: 'selladores', label: 'Selladores' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'extraordinarios', label: 'Extraordinarios' },
  { id: 'carrito', label: 'Carrito' },
];

// Display names per perfil tipo — constants.js price rows for most tipos
// carry no label of their own.
const PERFIL_TIPO_LABELS = {
  gotero_frontal: 'Gotero Frontal',
  gotero_frontal_greca: 'Gotero Frontal con Greca',
  gotero_lateral: 'Gotero Lateral',
  gotero_lateral_camara: 'Gotero Lateral de Cámara',
  gotero_superior: 'Gotero Superior',
  babeta_adosar: 'Babeta de Adosar',
  babeta_empotrar: 'Babeta de Empotrar',
  cumbrera: 'Cumbrera',
  canalon: 'Canalón',
  soporte_canalon: 'Soporte de Canalón',
  embudo: 'Embudo / Bajada PVC',
  vaina: 'Vaina',
  perfil_u: 'Perfil U',
  perfil_g2: 'Perfil G2 (ángulo exterior)',
  perfil_k2: 'Perfil K2 (ángulo interior)',
  esquinero_ext: 'Esquinero exterior',
  esquinero_int: 'Esquinero interior',
  perfil_5852: 'Ángulo aluminio 5852',
};

const PERFIL_RESERVED_KEYS = ['label', 'venta', 'web', 'costo', 'largo'];

const isPriceRow = (v) => v && typeof v === 'object' && (v.venta !== undefined || v.web !== undefined);

export function PresupuestoLibrePanelContent() {
  const { activeTab, setActiveTab } = usePresupuestoLibreUi();
  const {
    addPanelLine, addPerfil, addFijacion, addSellador, addHerramienta,
    librePanelLines, librePerfilQty, libreFijQty, libreSellQty, flete, setFlete,
  } = usePresupuestoLibre();

  const cartCount = librePanelLines.length
    + Object.keys(librePerfilQty).length
    + Object.keys(libreFijQty).length
    + Object.keys(libreSellQty).length
    + (flete > 0 ? 1 : 0);

  const handleAddPanel = (productData) => {
    const { familia, espesor, color, cantidad } = productData;
    addPanelLine(familia, espesor, color, cantidad);
  };

  // familia arrives as `pt:<tipo>:<familia>` / `pp:<tipo>:<familia>`; append
  // the espesor to form the stable catalog id used by
  // computePresupuestoLibreCatalogo (pt:<tipo>:<fam>:<esp>).
  const handleAddPerfil = (productData) => {
    const { familia, espesor, cantidad } = productData;
    addPerfil(`${familia}:${espesor ?? '_all'}`, cantidad || 1);
  };

  const handleAddFijacion = (pd) => addFijacion(pd.familia, pd.cantidad || 1);
  const handleAddSellador = (pd) => addSellador(pd.familia, pd.cantidad || 1);
  const handleAddHerramienta = (pd) => addHerramienta(pd.familia, pd.cantidad || 1);

  const renderPanelCards = (panels, prefix) =>
    Object.entries(panels).map(([familiaKey, familiaData]) => {
      const espesores = Object.keys(familiaData.esp || {});
      if (espesores.length === 0) return null;
      return (
        <PresupuestoLibreCard
          key={`${prefix}-${familiaKey}`}
          familia={familiaKey}
          label={familiaData.label}
          espesores={espesores}
          colores={familiaData.col || []}
          especData={familiaData.esp}
          unidad="m²"
          imagenFamilia={familiaKey}
          onAdd={handleAddPanel}
        />
      );
    }).filter(Boolean);

  const renderPaneles = () => [
    ...renderPanelCards(PANELS_TECHO, 'techo'),
    ...renderPanelCards(PANELS_PARED, 'pared'),
  ];

  const renderPerfileria = () => {
    const perfilCards = [];

    const processPerfil = (tipoKey, tipoData, prefix) => {
      Object.entries(tipoData).forEach(([familiaKey, familiaData]) => {
        if (PERFIL_RESERVED_KEYS.includes(familiaKey)) return;

        // Normalize the three shapes in constants.js into espesor -> price row:
        //   flat row at familia level        (perfil_k2: { _all: {venta,...} })
        //   nested one level                 (gotero_frontal: { ISOROOF: { 30: {venta,...} } })
        //   nested with '_all' espesor       (embudo: { _all: { _all: {venta,...} } })
        const especData = {};
        if (isPriceRow(familiaData)) {
          especData._all = familiaData;
        } else if (familiaData && typeof familiaData === 'object') {
          Object.entries(familiaData).forEach(([espKey, espVal]) => {
            if (isPriceRow(espVal)) especData[espKey] = espVal;
          });
        }

        const espesores = Object.keys(especData);
        if (espesores.length === 0) return;

        const tipoLabel = PERFIL_TIPO_LABELS[tipoKey] || tipoKey.replace(/_/g, ' ');
        const rowLabel = especData[espesores[0]]?.label;
        const label = rowLabel
          || (familiaKey === '_all' ? tipoLabel : `${tipoLabel} — ${familiaKey.replace(/_/g, ' ')}`);

        perfilCards.push(
          <PresupuestoLibreCard
            key={`perfil-${prefix}-${tipoKey}-${familiaKey}`}
            familia={`${prefix}:${tipoKey}:${familiaKey}`}
            label={label}
            espesores={espesores}
            colores={[]}
            especData={especData}
            unidad="m"
            imagenFamilia={`${tipoKey}:${familiaKey}`}
            onAdd={handleAddPerfil}
          />
        );
      });
    };

    Object.entries(PERFIL_TECHO).forEach(([tipoKey, tipoData]) => {
      processPerfil(tipoKey, tipoData, 'pt');
    });

    Object.entries(PERFIL_PARED).forEach(([tipoKey, tipoData]) => {
      processPerfil(tipoKey, tipoData, 'pp');
    });

    return perfilCards;
  };

  const renderItemCards = (entries, { keyPrefix, unidadDefault, onAdd }) =>
    entries.map(([key, data]) => {
      const precio = p(data);
      if (precio <= 0) return null;
      return (
        <PresupuestoLibreCard
          key={`${keyPrefix}-${key}`}
          familia={key}
          label={data.label}
          espesores={[]}
          colores={[]}
          unidad={data.unidad || unidadDefault}
          imagenFamilia={key}
          onAdd={onAdd}
          especData={{ std: data }}
        />
      );
    }).filter(Boolean);

  // Flete es un monto único compartido con el calculador (todos los
  // escenarios), no una colección de ítems — editor directo, no carta.
  const renderServicios = () => (
    <div className="pl-flete">
      <h4 className="pl-flete__title">{SERVICIOS.flete?.label || 'Flete con entrega en obra'}</h4>
      <p className="pl-flete__hint">
        Precio de referencia: ${fmtPrice(p(SERVICIOS.flete))}. Este flete es el mismo
        que usa el calculador en todos los escenarios.
      </p>
      <div className="pl-flete__control">
        <label className="pl-flete__label">Flete (USD s/IVA)</label>
        <input
          type="number"
          className="pl-flete__input"
          min="0"
          value={flete}
          onChange={(e) => {
            const v = Number(e.target.value);
            setFlete(Number.isFinite(v) ? Math.max(0, v) : 0);
          }}
        />
      </div>
    </div>
  );

  const renderExtraordinarios = () => [
    ...renderItemCards(Object.entries(HERRAMIENTAS), {
      keyPrefix: 'herramienta', unidadDefault: 'unid', onAdd: handleAddHerramienta,
    }),
    ...renderItemCards(
      PRESUPUESTO_LIBRE_IDS.filter((key) => FIJACIONES[key]).map((key) => [key, FIJACIONES[key]]),
      { keyPrefix: 'extra-fijacion', unidadDefault: 'unid', onAdd: handleAddFijacion },
    ),
  ];

  const getTabContent = () => {
    switch (activeTab) {
      case 'paneles':
        return renderPaneles();
      case 'perfileria':
        return renderPerfileria();
      case 'fijaciones':
        return renderItemCards(Object.entries(FIJACIONES), {
          keyPrefix: 'fijacion', unidadDefault: 'unid', onAdd: handleAddFijacion,
        });
      case 'selladores':
        return renderItemCards(Object.entries(SELLADORES), {
          keyPrefix: 'sellador', unidadDefault: 'unid', onAdd: handleAddSellador,
        });
      case 'servicios':
        return renderServicios();
      case 'extraordinarios':
        return renderExtraordinarios();
      case 'carrito':
        return <PresupuestoLibreCart />;
      default:
        return [];
    }
  };

  return (
    <div className="pl-panel-content">
      {/* Tab Navigation */}
      <div className="pl-panel-content__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`pl-panel-content__tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'carrito' && cartCount > 0 && (
              <span className="pl-panel-content__tab-badge">{cartCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Grid of Cards (card tabs) / single column (servicios, carrito) */}
      <div className={['carrito', 'servicios'].includes(activeTab) ? 'pl-panel-content__single' : 'pl-panel-content__grid'}>
        {getTabContent()}
      </div>
    </div>
  );
}
