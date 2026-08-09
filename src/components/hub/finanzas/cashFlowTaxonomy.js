/** Fixed managerial cash-flow taxonomy (shared Banco + Cash Flow). */

export const CASH_FLOW_TAXONOMY = [
  { key: "ingreso_venta", label: "Ingreso venta", kind: "inflow" },
  { key: "ingreso_otro", label: "Otro ingreso", kind: "inflow" },
  { key: "aporte_socio", label: "Aporte socio", kind: "inflow" },
  { key: "egreso_proveedor", label: "Proveedores", kind: "outflow" },
  { key: "egreso_sueldo", label: "Sueldos", kind: "outflow" },
  { key: "egreso_operativo", label: "Operativo", kind: "outflow" },
  { key: "egreso_financiero", label: "Financiero", kind: "outflow" },
  { key: "egreso_impuesto", label: "Impuestos", kind: "outflow" },
  { key: "transferencia_interna", label: "Transferencia interna", kind: "neutral" },
  { key: "retiro_socio", label: "Retiro socio", kind: "outflow" },
];

const BY_KEY = Object.fromEntries(CASH_FLOW_TAXONOMY.map((t) => [t.key, t]));

export function categoryLabel(key) {
  if (!key) return "Sin clasificar";
  return BY_KEY[key]?.label || key;
}

export function categoryKind(key) {
  if (!key) return "unknown";
  return BY_KEY[key]?.kind || "unknown";
}

/** Select options: empty value = sin clasificar (null). */
export function taxonomySelectOptions() {
  return [
    { value: "", label: "Sin clasificar" },
    ...CASH_FLOW_TAXONOMY.map((t) => ({ value: t.key, label: t.label })),
  ];
}
