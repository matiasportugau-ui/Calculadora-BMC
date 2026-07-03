import React from 'react';
import { usePresupuestoLibre } from '../contexts/PresupuestoLibreContext';
import { p, PANELS_TECHO, PANELS_PARED, PERFIL_TECHO, PERFIL_PARED, FIJACIONES, SELLADORES, SERVICIOS, HERRAMIENTAS, PRESUPUESTO_LIBRE_IDS } from '../data/constants';
import { PresupuestoLibreCard } from './PresupuestoLibreCard';
import './PresupuestoLibrePanelContent.css';

export function PresupuestoLibrePanelContent() {
  const { activeTab, setActiveTab, addPanelLine, addPerfil, addFijacion, addSellador } = usePresupuestoLibre();

  const tabs = [
    { id: 'paneles', label: 'Paneles' },
    { id: 'perfileria', label: 'Perfilería' },
    { id: 'fijaciones', label: 'Fijaciones' },
    { id: 'selladores', label: 'Selladores' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'extraordinarios', label: 'Extraordinarios' },
  ];

  const handleAddPanel = (productData) => {
    const { familia, espesor, color } = productData;
    addPanelLine(familia, espesor, color);
  };

  const handleAddPerfil = (perfilKey, productData) => {
    addPerfil(perfilKey, productData.cantidad || 1);
  };

  const handleAddFijacion = (fijacionKey, productData) => {
    addFijacion(fijacionKey, productData.cantidad || 1);
  };

  const handleAddSellador = (selladorKey, productData) => {
    addSellador(selladorKey, productData.cantidad || 1);
  };

  const renderPaneles = () => {
    const panelCards = [];

    // Techo panels
    Object.entries(PANELS_TECHO).forEach(([familiaKey, familiaData]) => {
      Object.entries(familiaData.esp || {}).forEach(([espesor, especData]) => {
        (familiaData.col || []).forEach((color) => {
          const precio = p(especData);
          if (precio > 0) {
            panelCards.push(
              <PresupuestoLibreCard
                key={`techo-${familiaKey}-${espesor}-${color}`}
                familia={familiaKey}
                label={`${familiaData.label} ${espesor}mm - ${color}`}
                espesor={espesor}
                color={color}
                precio={precio}
                unidad="m²"
                imagenFamilia={familiaData.fam || familiaKey}
                onAdd={handleAddPanel}
              />
            );
          }
        });
      });
    });

    // Pared panels
    Object.entries(PANELS_PARED).forEach(([familiaKey, familiaData]) => {
      Object.entries(familiaData.esp || {}).forEach(([espesor, especData]) => {
        (familiaData.col || []).forEach((color) => {
          const precio = p(especData);
          if (precio > 0) {
            panelCards.push(
              <PresupuestoLibreCard
                key={`pared-${familiaKey}-${espesor}-${color}`}
                familia={familiaKey}
                label={`${familiaData.label} ${espesor}mm - ${color}`}
                espesor={espesor}
                color={color}
                precio={precio}
                unidad="m²"
                imagenFamilia={familiaData.fam || familiaKey}
                onAdd={handleAddPanel}
              />
            );
          }
        });
      });
    });

    return panelCards;
  };

  const renderPerfileria = () => {
    const perfilCards = [];

    const processPerfil = (tipoKey, tipoData, familyName) => {
      Object.entries(tipoData).forEach(([familiaKey, familiaData]) => {
        if (familiaKey === 'label' || familiaKey === 'venta' || familiaKey === 'web' || familiaKey === 'costo' || familiaKey === 'largo') return;

        Object.entries(familiaData).forEach(([especKey, especData]) => {
          if (especKey === '_all' || especData._all) {
            const data = especData._all || especData;
            const precio = p(data);
            if (precio > 0) {
              const label = data.label || `${familyName} - ${especKey}`;
              perfilCards.push(
                <PresupuestoLibreCard
                  key={`perfil-${tipoKey}-${familiaKey}-${especKey}`}
                  familia={familiaKey}
                  label={label}
                  espesor={especKey !== '_all' ? especKey : null}
                  color={null}
                  precio={precio}
                  unidad="m"
                  imagenFamilia={familyName}
                  onAdd={handleAddPerfil}
                />
              );
            }
          } else if (typeof especData === 'object' && especData.venta) {
            const precio = p(especData);
            if (precio > 0) {
              perfilCards.push(
                <PresupuestoLibreCard
                  key={`perfil-${tipoKey}-${familiaKey}-${especKey}`}
                  familia={familiaKey}
                  label={`${familyName} - ${especKey}mm`}
                  espesor={especKey}
                  color={null}
                  precio={precio}
                  unidad="m"
                  imagenFamilia={familyName}
                  onAdd={handleAddPerfil}
                />
              );
            }
          }
        });
      });
    };

    Object.entries(PERFIL_TECHO).forEach(([tipoKey, tipoData]) => {
      processPerfil(tipoKey, tipoData, 'PERFIL_TECHO');
    });

    Object.entries(PERFIL_PARED).forEach(([tipoKey, tipoData]) => {
      processPerfil(tipoKey, tipoData, 'PERFIL_PARED');
    });

    return perfilCards;
  };

  const renderFijaciones = () => {
    return Object.entries(FIJACIONES).map(([key, data]) => {
      const precio = p(data);
      if (precio <= 0) return null;
      return (
        <PresupuestoLibreCard
          key={`fijacion-${key}`}
          familia={key}
          label={data.label}
          espesor={null}
          color={null}
          precio={precio}
          unidad={data.unidad || 'unid'}
          imagenFamilia="FIJACIONES"
          onAdd={handleAddFijacion}
        />
      );
    }).filter(Boolean);
  };

  const renderSelladores = () => {
    return Object.entries(SELLADORES).map(([key, data]) => {
      const precio = p(data);
      if (precio <= 0) return null;
      return (
        <PresupuestoLibreCard
          key={`sellador-${key}`}
          familia={key}
          label={data.label}
          espesor={null}
          color={null}
          precio={precio}
          unidad={data.unidad || 'unid'}
          imagenFamilia="SELLADORES"
          onAdd={handleAddSellador}
        />
      );
    }).filter(Boolean);
  };

  const renderServicios = () => {
    return Object.entries(SERVICIOS).map(([key, data]) => {
      const precio = p(data);
      if (precio <= 0) return null;
      return (
        <PresupuestoLibreCard
          key={`servicio-${key}`}
          familia={key}
          label={data.label}
          espesor={null}
          color={null}
          precio={precio}
          unidad={data.unidad || 'servicio'}
          imagenFamilia="SERVICIOS"
          onAdd={handleAddFijacion}
        />
      );
    }).filter(Boolean);
  };

  const renderExtraordinarios = () => {
    const extraordinarios = [];

    // Herramientas
    Object.entries(HERRAMIENTAS).forEach(([key, data]) => {
      const precio = p(data);
      if (precio > 0) {
        extraordinarios.push(
          <PresupuestoLibreCard
            key={`herramienta-${key}`}
            familia={key}
            label={data.label}
            espesor={null}
            color={null}
            precio={precio}
            unidad={data.unidad || 'unid'}
            imagenFamilia="HERRAMIENTAS"
            onAdd={handleAddFijacion}
          />
        );
      }
    });

    // Extra fijaciones from PRESUPUESTO_LIBRE_IDS
    PRESUPUESTO_LIBRE_IDS.forEach((key) => {
      if (FIJACIONES[key]) {
        const data = FIJACIONES[key];
        const precio = p(data);
        if (precio > 0) {
          extraordinarios.push(
            <PresupuestoLibreCard
              key={`extra-fijacion-${key}`}
              familia={key}
              label={data.label}
              espesor={null}
              color={null}
              precio={precio}
              unidad={data.unidad || 'unid'}
              imagenFamilia="FIJACIONES"
              onAdd={handleAddFijacion}
            />
          );
        }
      }
    });

    return extraordinarios;
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'paneles':
        return renderPaneles();
      case 'perfileria':
        return renderPerfileria();
      case 'fijaciones':
        return renderFijaciones();
      case 'selladores':
        return renderSelladores();
      case 'servicios':
        return renderServicios();
      case 'extraordinarios':
        return renderExtraordinarios();
      default:
        return [];
    }
  };

  return (
    <div className="pl-panel-content">
      {/* Tab Navigation */}
      <div className="pl-panel-content__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`pl-panel-content__tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid of Cards */}
      <div className="pl-panel-content__grid">
        {getTabContent()}
      </div>
    </div>
  );
}
