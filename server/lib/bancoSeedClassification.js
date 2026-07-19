function normalizeSeedText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

const COUNTERPARTY_RULES = [
  { key: "MATIAS PORTUGAU PONS", debit: "retiro_socio", credit: "aporte_socio" },
  { key: "MATIAS", debit: "retiro_socio", credit: "aporte_socio" },
  { key: "MATÍAS", debit: "retiro_socio", credit: "aporte_socio" },
  { key: "SANDRA ARIAS", any: "egreso_sueldo" },
  { key: "RAMIRO", any: "egreso_sueldo" },
  { key: "BROMYROS", any: "egreso_proveedor" },
  { key: "PLEGADOS", any: "egreso_proveedor" },
  { key: "ARCOBELL", credit: "ingreso_venta" },
  { key: "BUSITEL", credit: "ingreso_venta" },
  { key: "HECTOR PINTOS", credit: "ingreso_venta" },
  { key: "METALOG SAS", any: "transferencia_interna" },
  { key: "METALOG", any: "transferencia_interna" },
  { key: "BMC CANCEL", any: "transferencia_interna" },
  { key: "CANCEL BMC", any: "transferencia_interna" },
];

const DESCRIPTION_DIRECTION_RULES = [
  { description: "TRF E-BROU OTROS", credit: "ingreso_venta", debit: "egreso_operativo" },
  { description: "TRF. E-BROU OTROS", credit: "ingreso_venta", debit: "egreso_operativo" },
  { description: "TRF E-BROU PAGO A PROVEEDORES", credit: "ingreso_otro", debit: "egreso_proveedor" },
  { description: "TRF E-BROU ALQUILERES", debit: "egreso_operativo" },
  { description: "TRF SPI PAGO PROV.", credit: "ingreso_venta", debit: "egreso_proveedor" },
  { description: "TRF SPI HON.PROF", debit: "egreso_sueldo" },
  { description: "TENENCIA TARJETA DÉBITO", debit: "egreso_financiero" },
  { description: "TENENCIA TARJETA DEBITO", debit: "egreso_financiero" },
];

function movementDirection(movement) {
  const debit = Number(movement.debito || 0);
  const credit = Number(movement.credito || 0);
  if (credit > 0 && debit <= 0) return "credit";
  if (debit > 0 && credit <= 0) return "debit";
  return "any";
}

function matchCounterpartyRule(movement) {
  const asunto = normalizeSeedText(movement.asunto || "");
  const desc = normalizeSeedText(movement.descripcion || "");
  const direction = movementDirection(movement);
  for (const rule of COUNTERPARTY_RULES) {
    const key = normalizeSeedText(rule.key);
    if (!key) continue;
    if (!asunto.includes(key) && !desc.includes(key)) continue;
    if (rule.any) return { categoria: rule.any, entidad: null };
    if (direction === "credit" && rule.credit) return { categoria: rule.credit, entidad: null };
    if (direction === "debit" && rule.debit) return { categoria: rule.debit, entidad: null };
  }
  return null;
}

function matchDescriptionDirectionRule(movement) {
  const description = normalizeSeedText(movement.descripcion || "");
  const direction = movementDirection(movement);
  for (const rule of DESCRIPTION_DIRECTION_RULES) {
    if (description !== normalizeSeedText(rule.description)) continue;
    if (direction === "credit" && rule.credit) return { categoria: rule.credit, entidad: null };
    if (direction === "debit" && rule.debit) return { categoria: rule.debit, entidad: null };
  }
  return null;
}

function matchMetalogInternal(movement) {
  const combined = normalizeSeedText(`${movement.descripcion || ""} ${movement.asunto || ""}`);
  if (combined.includes("METALOG") && combined.includes("TRF")) {
    return { categoria: "transferencia_interna", entidad: null };
  }
  return null;
}

function matchSeedRule(movement, rules) {
  const haystack = normalizeSeedText(`${movement.descripcion || ""} ${movement.asunto || ""}`);
  for (const rule of rules) {
    const needle = normalizeSeedText(rule.pattern);
    if (needle && haystack.includes(needle)) return rule;
  }
  return null;
}

export function classifySeedMovement(movement, rules = []) {
  return (
    matchDescriptionDirectionRule(movement) ||
    matchCounterpartyRule(movement) ||
    matchMetalogInternal(movement) ||
    matchSeedRule(movement, rules)
  );
}
