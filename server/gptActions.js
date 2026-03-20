/**
 * GPT Builder discovery — single source for /calc/gpt-entry-point and /capabilities.
 * Imported by server/routes/calc.js (no duplicate).
 */

export const GPT_ACTIONS = [
  {
    operationId: "obtener_informe_completo",
    method: "GET",
    path: "/calc/informe",
    summary: "Informe completo con precios, reglas de asesoría y fórmulas.",
    whenToUse:
      "Llamar al INICIO de sesión para cargar contexto completo. Devuelve catálogo, matriz de precios, fijaciones, selladores, reglas de asesoría y fórmulas de cálculo.",
    params: [{ name: "lista", in: "query", type: "string", enum: ["venta", "web"], default: "web" }],
  },
  {
    operationId: "obtener_catalogo",
    method: "GET",
    path: "/calc/catalogo",
    summary: "Catálogo de paneles, espesores, colores y opciones.",
    whenToUse:
      "Para conocer familias válidas, espesores, colores y precios antes de cotizar. Guía la conversación con el usuario.",
    params: [{ name: "lista", in: "query", type: "string", enum: ["venta", "web"], default: "web" }],
  },
  {
    operationId: "obtener_escenarios",
    method: "GET",
    path: "/calc/escenarios",
    summary: "Escenarios disponibles con campos requeridos y opcionales.",
    whenToUse:
      "Para saber qué datos pedir según el tipo de proyecto (solo techo, fachada, techo+fachada, cámara frigorífica).",
    params: [],
  },
  {
    operationId: "calcular_presupuesto_libre",
    method: "POST",
    path: "/calc/cotizar/presupuesto-libre",
    summary: "Calcula presupuesto libre (líneas manuales por catálogo).",
    whenToUse:
      "Cuando el cliente pide partidas sueltas (paneles por m², perfilería por barra, tornillería, selladores, flete manual, extraordinarios) sin cotización techo/pared automática.",
    params: [
      { name: "lista", in: "body", type: "string", enum: ["venta", "web"], default: "web" },
      { name: "librePanelLines", in: "body", type: "array" },
      { name: "librePerfilQty", in: "body", type: "object" },
      { name: "libreFijQty", in: "body", type: "object" },
      { name: "libreSellQty", in: "body", type: "object" },
      { name: "flete", in: "body", type: "number", default: 0 },
      { name: "libreExtra", in: "body", type: "object" },
    ],
  },
  {
    operationId: "calcular_cotizacion",
    method: "POST",
    path: "/calc/cotizar",
    summary: "Calcula cotización completa con BOM, precios y textos.",
    whenToUse:
      "Cuando el usuario tiene dimensiones y opciones definidas. Devuelve resumen, BOM, texto WhatsApp y texto resumen.",
    params: [
      {
        name: "escenario",
        in: "body",
        required: true,
        type: "string",
        enum: ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"],
      },
      { name: "lista", in: "body", type: "string", enum: ["venta", "web"], default: "venta" },
      { name: "techo", in: "body", type: "object", requiredFor: ["solo_techo", "techo_fachada"] },
      { name: "pared", in: "body", type: "object", requiredFor: ["solo_fachada", "techo_fachada", "camara_frig"] },
      { name: "camara", in: "body", type: "object", requiredFor: ["camara_frig"] },
      { name: "flete", in: "body", type: "number", default: 0 },
    ],
  },
  {
    operationId: "generar_cotizacion_pdf",
    method: "POST",
    path: "/calc/cotizar/pdf",
    summary: "Genera PDF profesional y devuelve link para compartir.",
    whenToUse:
      "Cuando el cliente quiere la cotización en PDF. Incluir objeto cliente (nombre, teléfono, dirección). Link expira en 24h.",
    params: [
      { name: "escenario", in: "body", required: true, type: "string" },
      {
        name: "cliente",
        in: "body",
        type: "object",
        description: "nombre, rut, telefono, direccion, obra, ref, fecha, quote_code",
      },
      { name: "techo", in: "body", type: "object" },
      { name: "pared", in: "body", type: "object" },
      { name: "camara", in: "body", type: "object" },
      { name: "flete", in: "body", type: "number" },
    ],
  },
  {
    operationId: "listar_cotizaciones_generadas",
    method: "GET",
    path: "/calc/cotizaciones",
    summary: "Lista cotizaciones PDF generadas en la sesión.",
    whenToUse: "Para consultar historial de cotizaciones generadas (código, cliente, total, link PDF).",
    params: [],
  },
  {
    operationId: "ver_pdf_cotizacion",
    method: "GET",
    path: "/calc/pdf/{id}",
    summary: "Abre la cotización HTML (imprimir como PDF).",
    whenToUse: "URL devuelta por generar_cotizacion_pdf. Compartir con el cliente. Expira en 24h.",
    params: [
      { name: "id", in: "path", required: true, type: "string", description: "pdf_id de la respuesta" },
    ],
  },
];
