// Official BC quote terms + bank details, transcribed from Jenerik's
// "BASES Y CONDICIONES" / "DATOS BANCARIOS BC" sheets. Used only by the
// BC PDF — BMC QUOTE_TERMS and the other tenants stay untouched.

/** Siempre: pago de materiales, IVA y dólar. */
export const BC_TERMS_COMMON = [
  {
    text: "Los materiales se deben abonar 50% para la producción, el restante 50% para el retiro y entrega del material.",
    bold: true,
    highlight: true,
  },
  { text: "Impuestos 22%." },
  { text: "Tasación de dólar sujeta al día de pago.", bold: true, highlight: true },
];

/** Solo si el presupuesto cotiza instalación / mano de obra. */
export const BC_TERMS_INSTALACION = [
  { text: "Garantía 3 años.", bold: true, highlight: true },
  { text: "El presupuesto incluye mano de obra y aportes por industria y comercio." },
  { text: "Mano de obra se liquida una vez terminado el trabajo." },
  {
    text: "No incluye trabajos húmedos, electricidad ni calefacción, no mencionados.",
    bold: true,
    highlight: true,
  },
];

/** Venta de material únicamente (calculadora BC por defecto). */
export const BC_TERMS_MATERIAL = [
  {
    text: "Los plazos de entrega se coordinarán al confirmar el pedido, sujetos a stock y capacidad de producción.",
    bold: true,
  },
  {
    text: "Los productos son de uso técnico. El cliente debe asegurarse de que el sistema constructivo, pendientes, sobrecargas y normativa local sean compatibles con lo cotizado.",
  },
  {
    text: "BC no asume responsabilidad por la instalación, anclajes, estructura de soporte, ni por el uso inadecuado de los materiales.",
  },
  {
    text: "Cualquier modificación de medidas, cantidades o especificaciones luego de confirmado el pedido puede implicar recotización y nuevo plazo.",
  },
  {
    text: "Los colores y texturas mostrados en muestras, fotos o catálogos son referenciales. Puede existir variación de tono entre partidas.",
  },
  {
    text: "Al aceptar esta cotización confirma haber revisado el contenido de la misma en cuanto a medidas, cantidades, colores, valores y tipo de producto.",
  },
  {
    text: "Al momento de recibir el material corroborar el estado del mismo. Una vez recibido, no aceptamos devolución.",
    bold: true,
  },
  { text: "Sujeto a cambios según fábrica." },
];

const INSTALL_RE = /instalaci[oó]n|\bmontaje\b|mano de obra/i;

export function quoteIncludesInstalacion(q) {
  if (q?.incluyeInstalacion === true || q?.bmcExtra?.incluyeInstalacion === true) return true;
  if (q?.incluyeInstalacion === false || q?.bmcExtra?.incluyeInstalacion === false) return false;
  const bits = [];
  for (const g of q?.bomDetailGroups || []) {
    bits.push(g.groupName);
    for (const i of g.items || []) bits.push(i.desc, i.label);
  }
  return INSTALL_RE.test(bits.filter(Boolean).join(" "));
}

/** Instalación: nota EcoPlast (7). Material: comunes + cláusulas de venta. */
export function resolveBcQuoteTerms(q) {
  if (quoteIncludesInstalacion(q)) {
    return [
      BC_TERMS_INSTALACION[0],
      BC_TERMS_INSTALACION[1],
      BC_TERMS_COMMON[0],
      BC_TERMS_INSTALACION[2],
      BC_TERMS_INSTALACION[3],
      BC_TERMS_COMMON[1],
      BC_TERMS_COMMON[2],
    ];
  }
  return [...BC_TERMS_COMMON, ...BC_TERMS_MATERIAL];
}

/** Default pack = venta de material (la calculadora cotiza paneles). */
export const BC_QUOTE_TERMS = resolveBcQuoteTerms({});

export const BC_TERMS_CLOSING =
  "Ante alguna duda estamos a disposición por cualquiera de las vías de comunicación mencionadas.";

export const BC_BANKS = [
  {
    banco: "BROU",
    titular: "Jenerik Bentancor",
    uyu: "001559594-00001",
    usd: "001559594-00002",
  },
  {
    banco: "ITAÚ",
    titular: "Jenerik Bentancor",
    uyu: "2166136",
    usd: "2166144",
  },
];
