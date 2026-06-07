/**
 * normalizeLead.js — Módulo de normalización de cotizaciones históricas (.ods)
 *
 * Recibe un objeto `rawQuote` con los campos extraídos del archivo .ods (combinando
 * datos del filename y del contenido de la hoja) y devuelve un Lead JSON normalizado
 * conforme al schema del §5 de SHEETS-MAP-AND-PIPELINE.md, extendido con el campo
 * `fuente: "dropbox_ods_historic"` para distinguir estas entradas históricas de los
 * leads live del canal CRM.
 *
 * Devuelve `null` si el input no tiene suficiente información para identificar al menos
 * cliente o fecha.
 *
 * ES module — `import { normalizeLead } from './normalizeLead.js'`
 */

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parsea fecha en formato DDMMYYYY (naming convention de los archivos .ods).
 * Devuelve un string ISO "YYYY-MM-DD" o null si el formato no es válido.
 */
export function parseFechaDDMMYYYY(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = parseInt(dd, 10);
  const mo = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parsea un número en formato uruguayo: "1.234,56" → 1234.56
 * También acepta formato anglosajón standard: "1234.56"
 * Devuelve null si no se puede parsear.
 */
export function parseNumeroUY(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '' || s === '-' || s === 'N/A') return null;

  // Formato uruguayo: punto como separador de miles, coma como decimal
  // Ej: "1.234,56" → "1234.56"
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }

  // Formato con solo coma decimal sin puntos: "1234,56"
  if (/^\d+(,\d+)$/.test(s)) {
    return parseFloat(s.replace(',', '.'));
  }

  // Formato estándar: puede tener $ o USD prefix
  const clean = s.replace(/[$USD\s]/g, '').replace(',', '');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

/**
 * Extrae familia de panel, espesor y otras señales del nombre de archivo.
 * Naming convention: "Cotización DDMMYYYY <Cliente> - <Producto> <Espesor>mm [...]"
 */
export function parseFilename(filename) {
  if (!filename || typeof filename !== 'string') return {};

  const base = filename.replace(/\.ods$/i, '').trim();

  // Extraer fecha (primer bloque de 8 dígitos)
  const fechaMatch = base.match(/\b(\d{8})\b/);
  const fecha = fechaMatch ? parseFechaDDMMYYYY(fechaMatch[1]) : null;

  // Extraer cliente: entre la fecha y el primer " - "
  let cliente_nombre = null;
  if (fechaMatch) {
    const afterFecha = base.slice(fechaMatch.index + 8).trim();
    const dashIdx = afterFecha.indexOf(' - ');
    if (dashIdx > 0) {
      cliente_nombre = afterFecha.slice(0, dashIdx).trim() || null;
    } else {
      // Sin " - ": todo lo que sigue es cliente
      cliente_nombre = afterFecha.replace(/^[-\s]+/, '').trim() || null;
    }
    // Limpiar prefijos como "Cotización " del comienzo si quedó
    if (cliente_nombre) {
      cliente_nombre = cliente_nombre.replace(/^Cotizaci[oó]n\s*/i, '').trim();
    }
  }

  // Extraer familia de panel
  const FAMILIAS = [
    { pattern: /ISODEC[_\s-]*EPS/i, familia: 'ISODEC_EPS' },
    { pattern: /ISODEC[_\s-]*PIR/i, familia: 'ISODEC_PIR' },
    { pattern: /ISODEC/i, familia: 'ISODEC_EPS' },
    { pattern: /ISOROOF[_\s-]*3G/i, familia: 'ISOROOF_3G' },
    { pattern: /ISOROOF[_\s-]*FOIL/i, familia: 'ISOROOF_FOIL' },
    { pattern: /ISOROOF[_\s-]*COLONIAL/i, familia: 'ISOROOF_COLONIAL' },
    { pattern: /ISOROOF[_\s-]*PLUS/i, familia: 'ISOROOF_PLUS' },
    { pattern: /ISOROOF/i, familia: 'ISOROOF_3G' },
    { pattern: /ISOPANEL[_\s-]*EPS/i, familia: 'ISOPANEL_EPS' },
    { pattern: /ISOPANEL/i, familia: 'ISOPANEL_EPS' },
    { pattern: /ISOWALL[_\s-]*PIR/i, familia: 'ISOWALL_PIR' },
    { pattern: /ISOWALL/i, familia: 'ISOWALL_PIR' },
  ];

  let panel_familia = null;
  for (const { pattern, familia } of FAMILIAS) {
    if (pattern.test(base)) {
      panel_familia = familia;
      break;
    }
  }

  // Extraer espesor (número seguido de "mm")
  const espMatch = base.match(/(\d+)\s*mm/i);
  const panel_espesor = espMatch ? parseInt(espMatch[1], 10) : null;

  // Detectar sufijos conocidos
  const es_desc = /[-\s]desc[-\s]/i.test(base);
  const canal_wa = /\bWA\b/i.test(base);
  const canal_lo = /\bLO\b/i.test(base);
  const es_camara_frig = /C[AÁ]MARA\s*FRIG/i.test(base);
  const es_base = /\bBASE\b/i.test(base);

  // Inferir scenario desde familia y señales
  let scenario = null;
  if (es_camara_frig) {
    scenario = 'camara_frig';
  } else if (panel_familia && /^ISOROOF/.test(panel_familia)) {
    scenario = 'solo_techo';
  } else if (panel_familia && /^ISODEC/.test(panel_familia)) {
    scenario = 'solo_techo';
  } else if (panel_familia && /^ISOPANEL/.test(panel_familia)) {
    scenario = 'solo_fachada';
  } else if (panel_familia && /^ISOWALL/.test(panel_familia)) {
    scenario = 'solo_fachada';
  }

  // Inferir año desde la fecha para reporting
  const anio = fecha ? parseInt(fecha.slice(0, 4), 10) : null;

  return {
    fecha,
    anio,
    cliente_nombre,
    panel_familia,
    panel_espesor,
    scenario,
    es_desc,
    canal_wa,
    canal_lo,
    es_base,
    es_camara_frig,
  };
}

// ---------------------------------------------------------------------------
// Función principal de normalización
// ---------------------------------------------------------------------------

/**
 * rawQuote: {
 *   filename: string,             // nombre del archivo .ods (solo el basename)
 *   filepath: string,             // ruta absoluta al archivo
 *   sheetData?: {                 // opcional: datos extraídos del contenido del .ods
 *     cliente_nombre?: string,
 *     telefono?: string,
 *     ubicacion?: string,
 *     email?: string,
 *     total_materiales_str?: string,   // p.ej. "12.345,67"
 *     traslado_str?: string,
 *     total_final_str?: string,
 *     area_m2_str?: string,
 *     largo_str?: string,
 *     ancho_str?: string,
 *     lista_precios?: string,          // "web" | "venta" | null
 *     vendedor?: string,
 *     notas?: string,
 *   }
 * }
 *
 * Devuelve un Lead JSON normalizado o null si no se puede identificar el registro.
 */
export function normalizeLead(rawQuote) {
  if (!rawQuote || typeof rawQuote !== 'object') return null;
  if (!rawQuote.filename && !rawQuote.filepath) return null;

  const filename = rawQuote.filename || rawQuote.filepath.split('/').pop();
  const filepath = rawQuote.filepath || rawQuote.filename;

  // Extraer señales del filename
  const fn = parseFilename(filename);

  // Datos del contenido de la hoja (opcionales, pueden estar incompletos)
  const sd = rawQuote.sheetData || {};

  // Cliente: preferir sheetData si tiene valor; si no, filename-derived
  const cliente_nombre = (sd.cliente_nombre && String(sd.cliente_nombre).trim()) || fn.cliente_nombre || null;

  // Fecha: preferir sheetData si tiene; si no, filename
  const fecha = sd.fecha || fn.fecha || null;

  // Si no tenemos ni cliente ni fecha, no podemos identificar el lead
  if (!cliente_nombre && !fecha) return null;

  // Generar lead_id estable desde la ruta del archivo
  const lead_id = createHash('sha1').update(filepath).digest('hex').slice(0, 16);

  // Parsear números
  const total_sin_iva_usd = parseNumeroUY(sd.total_materiales_str) || parseNumeroUY(sd.total_final_str) || null;

  let total_con_iva_usd = null;
  if (sd.total_final_str) {
    const t = parseNumeroUY(sd.total_final_str);
    // Heurística: si el total supera el de materiales en ~22%, es con IVA incluido
    total_con_iva_usd = t;
  }

  const area_m2 = parseNumeroUY(sd.area_m2_str) || null;
  const largo_m = parseNumeroUY(sd.largo_str) || null;
  const ancho_m = parseNumeroUY(sd.ancho_str) || null;

  // Lista de precios: normalizar
  let lista_precios = sd.lista_precios || null;
  if (lista_precios) {
    const lp = String(lista_precios).toLowerCase().trim();
    if (lp.includes('venta')) lista_precios = 'venta';
    else if (lp.includes('web')) lista_precios = 'web';
    else lista_precios = null;
  }

  // Extraer año para reporting
  const anio = fn.anio || (fecha ? parseInt(fecha.slice(0, 4), 10) : null);

  const lead = {
    lead_id,
    fecha,
    timestamp: fecha ? `${fecha}T00:00:00.000Z` : null,
    anio,
    canal_origen: 'dropbox_ods_historic',
    fuente: 'dropbox_ods',
    filepath,
    filename,
    cliente_nombre,
    telefono: sd.telefono || null,
    ubicacion: sd.ubicacion || null,
    email: sd.email || null,
    scenario: fn.es_camara_frig ? 'camara_frig' : (fn.scenario || null),
    panel_familia: fn.panel_familia || null,
    panel_espesor: fn.panel_espesor || null,
    area_m2,
    largo_m,
    ancho_m,
    lista_precios,
    total_sin_iva_usd,
    total_con_iva_usd,
    pdf_url: null,
    drive_url: null,
    vendedor: sd.vendedor || null,
    notas: sd.notas || null,
    tipo_cliente: null,
    urgencia: null,
    probabilidad_cierre: null,
    wizard_payload: {},
  };

  return lead;
}
