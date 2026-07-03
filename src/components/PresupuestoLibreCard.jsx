import React, { useState } from 'react';
import { getProductImage } from '../utils/presupuestoLibreImageMapper';
import './PresupuestoLibreCard.css';

export function PresupuestoLibreCard({
  familia,
  label,
  espesor,
  color,
  precio,
  unidad = 'm²',
  imagenFamilia,
  onAdd,
}) {
  const [cantidad, setCantidad] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const handleAdd = () => {
    if (cantidad > 0) {
      onAdd({ familia, espesor, color, cantidad, precio, unidad });
      setCantidad(0);
    }
  };

  const handleIncrement = () => setCantidad(c => c + 1);
  const handleDecrement = () => setCantidad(c => (c > 0 ? c - 1 : 0));

  const imageSrc = getProductImage(imagenFamilia || familia);
  const subtotal = (cantidad * precio).toFixed(2);

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
        <div className="pl-card__header">
          <h3 className="pl-card__title">{label}</h3>
          {espesor && (
            <span className="pl-card__espesor">{espesor}mm</span>
          )}
        </div>

        {color && (
          <p className="pl-card__color">{color}</p>
        )}

        {/* Price */}
        <div className="pl-card__price-wrapper">
          <span className="pl-card__price">${precio.toFixed(2)}</span>
          <span className="pl-card__unit">/{unidad}</span>
        </div>

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
