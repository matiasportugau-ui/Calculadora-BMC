import React, { useState } from 'react';
import { p } from '../data/constants';
import { getProductImageByColor } from '../utils/presupuestoLibreImageMapper';
import './PresupuestoLibreCard.css';

export function PresupuestoLibreCard({
  familia,
  label,
  espesores,
  colores,
  imagenFamilia,
  onAdd,
  unidad = 'm²',
  especData,
}) {
  const [selectedEspesor, setSelectedEspesor] = useState(espesores?.[0] || null);
  const [selectedColor, setSelectedColor] = useState(colores?.[0] || null);
  const [cantidad, setCantidad] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const currentPrice = selectedEspesor && especData?.[selectedEspesor]
    ? p(especData[selectedEspesor])
    : 0;

  const handleAdd = () => {
    if (cantidad > 0 && currentPrice > 0) {
      onAdd({
        familia,
        espesor: selectedEspesor,
        color: selectedColor,
        cantidad,
        precio: currentPrice,
        unidad,
      });
      setCantidad(0);
    }
  };

  const handleIncrement = () => setCantidad(c => c + 1);
  const handleDecrement = () => setCantidad(c => (c > 0 ? c - 1 : 0));

  const imageSrc = getProductImageByColor(imagenFamilia || familia, selectedColor);
  const subtotal = (cantidad * currentPrice).toFixed(2);

  return (
    <div
      className="pl-card"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Image Container */}
      <div className="pl-card__image-wrapper">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={label}
            className="pl-card__image"
            loading="lazy"
          />
        ) : (
          <div className="pl-card__image-placeholder">
            <div className="pl-card__image-placeholder-text">
              {familia}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pl-card__content">
        <h3 className="pl-card__title">{label}</h3>

        {/* Espesor Selector */}
        {espesores && espesores.length > 0 && (
          <div className="pl-card__selector-group">
            <label className="pl-card__selector-label">Espesor</label>
            <select
              className="pl-card__selector"
              value={selectedEspesor || ''}
              onChange={(e) => setSelectedEspesor(e.target.value)}
            >
              {espesores.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}mm
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Color Selector */}
        {colores && colores.length > 0 && (
          <div className="pl-card__selector-group">
            <label className="pl-card__selector-label">Color</label>
            <select
              className="pl-card__selector"
              value={selectedColor || ''}
              onChange={(e) => setSelectedColor(e.target.value)}
            >
              {colores.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Price */}
        {currentPrice > 0 && (
          <div className="pl-card__price-wrapper">
            <span className="pl-card__price">${currentPrice.toFixed(2)}</span>
            <span className="pl-card__unit">/{unidad}</span>
          </div>
        )}

        {/* Quantity Control */}
        <div className="pl-card__qty-control">
          <button
            className="pl-card__btn-qty"
            onClick={handleDecrement}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <input
            type="number"
            className="pl-card__qty-input"
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(0, Number(e.target.value)))}
            placeholder="0"
          />
          <button
            className="pl-card__btn-qty"
            onClick={handleIncrement}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        {/* Subtotal */}
        {cantidad > 0 && (
          <div className="pl-card__subtotal">
            ${subtotal}
          </div>
        )}

        {/* Add Button */}
        <button
          className={`pl-card__btn-add ${cantidad > 0 ? 'is-active' : ''}`}
          onClick={handleAdd}
          disabled={cantidad === 0}
        >
          {cantidad > 0 ? `Agregar (${cantidad})` : 'Agregar'}
        </button>
      </div>

      {/* Hover Shine Effect */}
      <div className={`pl-card__shine ${isHovering ? 'is-visible' : ''}`} />
    </div>
  );
}
