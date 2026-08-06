/**
 * Inline editor for Ventas sale state (Por coordinar / Coordinado+camión / etc.).
 * Stops propagation so parent row click does not fire when interacting controls.
 */
import React from "react";
import {
  SALE_STATUS_LABELS,
  MAX_CAMIONES,
  transportistaForCamion,
} from "../../utils/logistica/saleState.js";

const EDITABLE = ["por_coordinar", "coordinado", "con_pendientes", "entregado", "enviado"];

export default function SaleStateEditor({
  status = "por_coordinar",
  fechaIso = "",
  camion = null,
  transportistas = [],
  camionMap = {},
  busy = false,
  disabled = false,
  onChange,
  onRequestEntregado,
  onRequestEnviado,
  small = true,
}) {
  const stop = (e) => e.stopPropagation();
  const tte = transportistaForCamion(transportistas, camion, camionMap);

  function emit(patch) {
    if (disabled || busy) return;
    onChange?.({
      status,
      fechaIso,
      camion,
      ...patch,
    });
  }

  function onStatusSelect(next) {
    if (next === "entregado") {
      onRequestEntregado?.();
      return;
    }
    if (next === "enviado") {
      onRequestEnviado?.();
      return;
    }
    emit({
      status: next,
      fechaIso: next === "coordinado" || next === "con_pendientes" ? fechaIso || todayIso() : fechaIso,
    });
  }

  return (
    <div
      onClick={stop}
      onMouseDown={stop}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        marginTop: small ? 4 : 8,
      }}
    >
      <select
        aria-label="Estado de la venta"
        disabled={disabled || busy}
        value={status}
        onChange={(e) => onStatusSelect(e.target.value)}
        style={selStyle(small)}
      >
        {EDITABLE.map((k) => (
          <option key={k} value={k}>
            {SALE_STATUS_LABELS[k]}
          </option>
        ))}
      </select>
      {(status === "coordinado" || status === "con_pendientes") && (
        <>
          <input
            type="date"
            aria-label="Fecha coordinación"
            disabled={disabled || busy}
            value={/^\d{4}-\d{2}-\d{2}$/.test(fechaIso) ? fechaIso : ""}
            onChange={(e) => emit({ fechaIso: e.target.value })}
            style={inpStyle(small)}
          />
          <select
            aria-label="Nº camión"
            disabled={disabled || busy}
            value={camion || ""}
            onChange={(e) => emit({ camion: e.target.value ? Number(e.target.value) : null })}
            style={selStyle(small)}
          >
            <option value="">Camión…</option>
            {Array.from({ length: MAX_CAMIONES }, (_, i) => i + 1).map((n) => {
              const name = transportistaForCamion(transportistas, n, camionMap);
              return (
                <option key={n} value={n}>
                  Camión {n}
                  {name ? ` — ${name}` : ""}
                </option>
              );
            })}
          </select>
          {tte ? (
            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }} title="Transportista del camión">
              🚛 {tte}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function selStyle(small) {
  return {
    fontSize: small ? 11 : 12,
    borderRadius: 6,
    border: "1px solid #93c5fd",
    padding: small ? "2px 6px" : "4px 8px",
    background: "#fff",
    maxWidth: 160,
  };
}

function inpStyle(small) {
  return {
    fontSize: small ? 11 : 12,
    borderRadius: 6,
    border: "1px solid #93c5fd",
    padding: small ? "2px 4px" : "4px 6px",
    background: "#fff",
  };
}
