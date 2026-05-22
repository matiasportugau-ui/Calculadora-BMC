/**
 * rowToFixture.js — Convierte una fila de `Enviados` en un fixture del eval
 * harness (mismo formato que evals/fixtures/<id>.json).
 *
 * Stage 1 (NLU) y Stage 2 (Asunciones) en esta versión son HEURÍSTICOS —
 * extracción regex + defaults razonables. La versión LLM-based llegará
 * en `nluProbe.js` (siguiente iter); este módulo es la baseline contra
 * la que se mide el agente.
 */

import { TAB_NAME } from "./enviadosSchema.js";

const ISODEC_RE = /\b(iso ?dec)\b/i;
const ISOROOF_RE = /\b(iso ?roof|isoroof)\b/i;
const ISOPANEL_RE = /\b(iso ?panel|isopanel)\b/i;
const ISOWALL_RE = /\b(iso ?wall|isowall)\b/i;
const ISOFRIG_RE = /\b(iso ?frig|isofrig)\b/i;

const PIR_RE = /\b(pir)\b/i;
const EPS_RE = /\b(eps|telgopor)\b/i;

const ESPESOR_RE = /(\d{2,3})\s*(?:mm|milimetros|milímetros)?/gi;
const ANCHO_LARGO_RE = /(\d+(?:[.,]\d+)?)\s*(?:m|mts|metros)\b/gi;
const CANT_PANELES_RE = /(\d+)\s*(?:p|paneles?|panel)\b/i;
const ALCANCE_COMPLETO_RE = /\b(completo|todo|kit completo|con accesorios)\b/i;
const ALCANCE_SOLO_RE = /\b(solo paneles?|sin accesorios)\b/i;

function detectFamilia(text) {
  if (!text) return null;
  if (ISODEC_RE.test(text)) {
    if (PIR_RE.test(text)) return "ISODEC_PIR";
    return "ISODEC_EPS";
  }
  if (ISOROOF_RE.test(text)) return "ISOROOF_3G";
  if (ISOPANEL_RE.test(text)) return EPS_RE.test(text) ? "ISOPANEL_EPS" : "ISOPANEL_PIR";
  if (ISOWALL_RE.test(text)) return "ISOWALL_EPS";
  if (ISOFRIG_RE.test(text)) return "ISOFRIG";
  return null;
}

function detectEspesores(text) {
  if (!text) return [];
  const m = [...text.matchAll(ESPESOR_RE)].map((x) => Number(x[1]));
  return m.filter((n) => n >= 30 && n <= 250);
}

function detectLargos(text) {
  if (!text) return [];
  return [...text.matchAll(ANCHO_LARGO_RE)].map((x) => Number(x[1].replace(",", ".")));
}

function detectCantPaneles(text) {
  if (!text) return null;
  const m = text.match(CANT_PANELES_RE);
  return m ? Number(m[1]) : null;
}

function detectAlcance(text) {
  if (!text) return null;
  if (ALCANCE_COMPLETO_RE.test(text)) return "completo";
  if (ALCANCE_SOLO_RE.test(text)) return "solo_paneles";
  return null;
}

/**
 * Heurísticas BMC para asunciones por defecto cuando el cliente no aclara.
 * Cada asunción tiene un nivel de confianza para ser revisable.
 */
function defaultAssumptions({ familia, direccion_zona }) {
  const assumptions = [];
  const techo = {
    tipoEst: "metal",
    color: "Blanco",
    borders: { frente: "gotero", fondo: "gotero_sup", latIzq: "gotero_lat", latDer: "gotero_lat" },
    opciones: { inclCanalon: false, inclGotSup: true, inclSell: true },
  };
  assumptions.push({ field: "color", value: "Blanco", source: "default-casa", confidence: 0.9 });
  if (direccion_zona && /(mvdeo|montevideo|maldonado|punta|colonia)/i.test(direccion_zona)) {
    assumptions.push({ field: "tipoEst", value: "metal", source: "zona-residencial-default", confidence: 0.7 });
  } else {
    assumptions.push({ field: "tipoEst", value: "metal", source: "default-conservador", confidence: 0.5 });
  }
  assumptions.push({ field: "borders", value: techo.borders, source: "default-techo-simple", confidence: 0.4 });
  if (familia && /^ISODEC/.test(familia)) {
    assumptions.push({ field: "familia-default-EPS", value: "ISODEC_EPS", source: "convencion-bmc", confidence: 0.8 });
  }
  return { techo, assumptions };
}

/**
 * Construye un fixture del harness a partir de una fila parseada.
 * No infiere ancho del techo (campo crítico que el agente debería preguntar).
 */
export function rowToFixture(row, { sheetId } = {}) {
  const consulta = row.consulta || "";
  const familia = detectFamilia(consulta);
  const espesores = detectEspesores(consulta);
  const largos = detectLargos(consulta);
  const cantPaneles = detectCantPaneles(consulta);
  const alcance = detectAlcance(consulta);

  const { techo: defaultsTecho, assumptions } = defaultAssumptions({
    familia,
    direccion_zona: row.direccion_zona,
  });

  const opciones = [];
  if (familia && espesores.length && cantPaneles && largos.length) {
    for (const espesor of espesores) {
      opciones.push({
        label: `${familia} ${espesor}mm`,
        escenario: "solo_techo",
        techo: {
          familia,
          espesor,
          largo: largos[0],
          ancho: null,
          ...defaultsTecho,
        },
        gaps_de_input: ["ancho del techo (no especificado en consulta)"],
      });
    }
  }

  const caseId = buildCaseId(row);
  return {
    case_id: caseId,
    fila_planilla: row._rowNumber,
    fuente: {
      planilla_id: sheetId,
      tab: TAB_NAME,
      url: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
      ingested_at: new Date().toISOString(),
    },
    inputs_raw: {
      asignado: row.asignado,
      estado: row.estado,
      fecha: row.fecha,
      cliente: row.cliente,
      origen: row.origen,
      telefono: row.telefono,
      direccion_zona: row.direccion_zona,
      consulta: row.consulta,
      comentarios: row.comentarios,
      monto: row.monto_total,
      moneda: row.moneda,
      link_pdf: row.link_pdf,
    },
    nlu_baseline: {
      method: "regex-heuristic",
      familia,
      espesores,
      largos,
      cantPaneles,
      alcance,
      missing: [
        familia ? null : "familia",
        espesores.length ? null : "espesor",
        cantPaneles ? null : "cantPaneles",
        largos.length ? null : "largo",
        alcance ? null : "alcance",
      ].filter(Boolean),
    },
    parsed_inputs: {
      lista: "venta",
      alcance: alcance || "no_especificado",
      flete: "intervencion_humana",
      destino: row.direccion_zona,
      opciones_solicitadas: opciones,
    },
    assumptions,
    expected_output: row.link_pdf
      ? {
          status: row.monto_total ? "monto_disponible_sin_bom" : "pdf_disponible_sin_monto",
          pdf_url: row.link_pdf,
          monto_total_sin_iva_usd: null,
          monto_total_con_iva_usd: null,
          monto_total_raw: row.monto_total,
          moneda: row.moneda,
          bom: [],
        }
      : {
          status: "pendiente_de_envio_por_usuario",
          pdf_url: null,
          monto_total_sin_iva_usd: null,
          monto_total_con_iva_usd: null,
          bom: [],
        },
    extra_planilla: row.extra,
  };
}

function buildCaseId(row) {
  const fila = row._rowNumber || "x";
  const clienteSlug = (row.cliente || "sincliente")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
  return `${clienteSlug || "sincliente"}-fila-${fila}`;
}
