#!/usr/bin/env node
/**
 * panelsim-ml-crm-sync.js
 * Sincroniza preguntas ML sin responder → CRM_Operativo (Google Sheets)
 *
 * - Evita duplicados: busca Q:<id> en col Observaciones
 * - Inserta en primeras filas vacías, ordenadas más vieja → más nueva
 * - Genera respuesta sugerida en col AF (Respuesta Sugerida)
 * - Compara precio ML vs Matriz: si difieren → Estado = "Pendiente revisión precio",
 *   alerta en Observaciones, sin respuesta sugerida (requiere revisión manual)
 * - Modo automático: preguntas con discrepancia de precio no se responden solas
 */

import { createRequire } from "module";
import http from "http";

const require = createRequire(import.meta.url);
require("dotenv").config();
const { google } = await import("googleapis");

const API_BASE = process.env.BMC_API_BASE || "http://127.0.0.1:3001";
const SHEET_ID = process.env.BMC_SHEET_ID;
const SHEET_TAB = "CRM_Operativo";
const HEADER_ROW = 3;
const CLOSE = "Saludos BMC URUGUAY!";

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function apiGet(path) {
  return new Promise((resolve, reject) => {
    http.get(API_BASE + path, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error(`JSON parse error ${path}: ${d.slice(0, 80)}`)); }
      });
    }).on("error", reject);
  });
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDate(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function formatDateTime(iso) {
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function today() { return formatDate(new Date().toISOString()); }

// ─── Categoría automática ────────────────────────────────────────────────────

function autoCategoria(itemTitle = "", questionText = "") {
  const txt = (itemTitle + " " + questionText).toLowerCase();
  if (txt.includes("techo") || txt.includes("cubierta") || txt.includes("isodec")) return "Paneles Techo";
  if (txt.includes("fachada") || txt.includes("pared") || txt.includes("isopanel")) return "Paneles Fachada";
  if (txt.includes("galpón") || txt.includes("galpon")) return "Galpones";
  if (txt.includes("gotero") || txt.includes("canalón") || txt.includes("babeta")) return "Accesorios";
  if (txt.includes("caucho") || txt.includes("rubber") || txt.includes("impertech") || txt.includes("sellador")) return "Impermeabilizantes";
  return "Consultas";
}

// ─── Buscar precio en Matriz ─────────────────────────────────────────────────

function findMatrizPrice(itemTitle = "", informe) {
  const title = itemTitle.toLowerCase();

  // Extraer espesor del título
  const espMatch = title.match(/(\d+)\s*mm/);
  const espesor = espMatch ? parseInt(espMatch[1]) : null;

  // Isodec (techo)
  if (title.includes("isodec") || (title.includes("techo") && title.includes("panel"))) {
    if (espesor) {
      const eps = informe?.paneles_techo?.ISODEC_EPS?.espesores?.[espesor]?.precio_m2_usd;
      if (eps) return { precio: eps, fuente: `Matriz Isodec EPS ${espesor}mm` };
    }
  }

  // Isopanel / Isowall (pared/fachada)
  if (title.includes("isopanel") || title.includes("fachada") || title.includes("pared")) {
    if (espesor) {
      const eps = informe?.paneles_pared?.ISOPANEL_EPS?.espesores?.[espesor]?.precio_m2_usd
                || informe?.paneles_pared?.ISOWALL_PIR?.espesores?.[espesor]?.precio_m2_usd;
      if (eps) return { precio: eps, fuente: `Matriz Isopanel EPS ${espesor}mm` };
    }
  }

  // Isoroof (techo — buscar en matriz_precios)
  if (title.includes("isoroof") && espesor) {
    const familia = title.includes("foil") ? "ISOROOF_FOIL"
                  : title.includes("plus") ? "ISOROOF_PLUS"
                  : "ISOROOF_3G";
    const match = (informe?.matriz_precios?.techo || []).find(
      (p) => p.familia === familia && p.espesor_mm === espesor
    );
    if (match) return { precio: match.precio_m2_usd, fuente: `Matriz ${familia} ${espesor}mm` };
  }

  return null; // no se encontró match
}

// ─── Generar respuesta sugerida ──────────────────────────────────────────────

function generateResponse(q, item, nickname, hasPriceMismatch) {
  // Si hay discrepancia de precio → no sugerir respuesta (requiere revisión manual)
  if (hasPriceMismatch) return "";

  const text = (q.text || "").toLowerCase();
  const itemTitle = (item?.title || "").toLowerCase();
  const priceML = item?.price;

  // Nombre amigable del comprador (primera parte del nickname)
  const firstName = nickname.replace(/[_\d]/g, " ").trim().split(" ")[0] || nickname;

  // Detectar tipo de consulta
  const isColorQ    = text.includes("color") || text.includes("opciones") || text.includes("colores");
  const isShipping  = text.includes("envío") || text.includes("envio") || text.includes("flete") || text.includes("delivery");
  const hasDims     = /\d+\s*(x|por|\*)\s*\d+/.test(text);
  const hasM2       = text.includes("m2") || text.includes("m²") || text.includes("metro");
  const isPriceQ    = text.includes("cuánto") || text.includes("cuanto") || text.includes("precio") || text.includes("costo") || text.includes("presupuesto") || text.includes("vale") || text.includes("cuesta");
  const isTechoQ    = text.includes("techo");
  const isFachadaQ  = text.includes("fachada") || text.includes("pared");

  // ¿La consulta corresponde al producto publicado?
  const pubEsTecho   = itemTitle.includes("techo") || itemTitle.includes("isodec") || itemTitle.includes("cubierta");
  const pubEsFachada = itemTitle.includes("fachada") || itemTitle.includes("isopanel") || itemTitle.includes("pared");
  const productoEquivocado = (isTechoQ && pubEsFachada) || (isFachadaQ && pubEsTecho);

  // ── Consulta de color
  if (isColorQ) {
    const color = item?.attributes?.find((a) => a.id === "COLOR")?.value_name;
    const colorText = color ? `en color ${color}` : "en los colores indicados en la publicación";
    return `Hola ${firstName}! Esta publicación viene ${colorText}. Si necesitás otra variante escribinos por acá y te confirmamos disponibilidad. ${CLOSE}`;
  }

  // ── Consulta de envío
  if (isShipping) {
    return `Hola ${firstName}! Realizamos envíos a todo el país. Indicanos la ciudad de entrega y la cantidad que necesitás para cotizarte el traslado. ${CLOSE}`;
  }

  // ── Producto equivocado (techo en fachada o viceversa)
  if (productoEquivocado) {
    const tipoNecesita = isTechoQ ? "techo" : "fachada";
    const tipoPublicado = pubEsTecho ? "techo" : "fachada";
    if (priceML) {
      return `Hola ${firstName}! Esta publicación corresponde a paneles de ${tipoPublicado}. Para ${tipoNecesita} tenemos otra línea con características específicas — el precio de referencia publicado es USD ${priceML}/m². ¿Nos confirmás las medidas y el uso para armarte el presupuesto correcto? ${CLOSE}`;
    }
    return `Hola ${firstName}! Esta publicación es para paneles de ${tipoPublicado}. Para ${tipoNecesita} contamos con otra línea — escribinos con las medidas y te cotizamos. ${CLOSE}`;
  }

  // ── Consulta con dimensiones → cotización orientativa
  if ((hasDims || hasM2) && priceML) {
    return `Hola ${firstName}! El precio publicado es de USD ${priceML}/m². Con las medidas que indicás te armamos el presupuesto completo con cantidad de unidades e IVA incluido — confirmanos largo y ancho a cubrir si querés el detalle. ${CLOSE}`;
  }

  // ── Consulta de precio sin dimensiones
  if (isPriceQ && priceML) {
    return `Hola ${firstName}! El precio es de USD ${priceML}/m² IVA inc. Si nos indicás las medidas (largo × ancho) te calculamos la cantidad exacta y el total. ${CLOSE}`;
  }

  // ── Genérica
  return `Hola ${firstName}! Con gusto te ayudamos. ¿Podés darnos más detalles sobre lo que necesitás (medidas, cantidad, uso)? ${CLOSE}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(">>> PANELSIM ML→CRM sync");

  // 1. Verificar API
  const health = await apiGet("/health").catch(() => null);
  if (!health?.ok) {
    console.error("✗ API no disponible en", API_BASE);
    process.exit(1);
  }

  // 2. Cargar Matriz de precios
  const informe = await apiGet("/calc/informe").catch(() => null);
  if (!informe) console.warn("  ⚠ No se pudo cargar /calc/informe — comparación de precios deshabilitada");

  // 3. Preguntas sin responder
  const qRes = await apiGet("/ml/questions?status=UNANSWERED&limit=50");
  const questions = qRes.questions || [];
  if (questions.length === 0) {
    console.log("✓ Sin preguntas ML pendientes");
    return;
  }
  console.log(`  ${questions.length} pregunta(s) sin responder`);
  questions.sort((a, b) => new Date(a.date_created) - new Date(b.date_created));

  // 4. Nicknames
  const nicknames = {};
  for (const q of questions) {
    const uid = q.from?.id;
    if (uid && !nicknames[uid]) {
      const u = await apiGet(`/ml/users/${uid}`).catch(() => null);
      nicknames[uid] = u?.nickname || `ML#${uid}`;
    }
  }

  // 5. Items ML
  const items = {};
  for (const q of questions) {
    if (q.item_id && !items[q.item_id]) {
      const it = await apiGet(`/ml/items/${q.item_id}`).catch(() => null);
      items[q.item_id] = it;
    }
  }

  // 6. Conectar Sheets
  if (!SHEET_ID) { console.error("✗ BMC_SHEET_ID no configurado"); process.exit(1); }
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  // 7. Leer CRM
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_TAB}'!A${HEADER_ROW}:AF2000`,
  });
  const allRows = dataRes.data.values || [];
  const headers  = allRows[0] || [];
  const dataRows = allRows.slice(1);

  const iObs   = headers.indexOf("Observaciones");
  const iFecha = headers.indexOf("Fecha");

  // 8. Dedup por Q:<id>
  const existingQIds = new Set();
  for (const row of dataRows) {
    const match = (row[iObs] || "").match(/Q:(\d+)/);
    if (match) existingQIds.add(match[1]);
  }

  const newQuestions = questions.filter((q) => !existingQIds.has(String(q.id)));
  if (newQuestions.length === 0) {
    console.log("✓ Todas las preguntas ya están en el CRM");
    return;
  }
  console.log(`  ${newQuestions.length} nueva(s) para agregar`);

  // 9. Primeras filas vacías
  const emptyRows = [];
  for (let i = 0; i < dataRows.length; i++) {
    if (!(dataRows[i][iFecha] || "").trim()) {
      emptyRows.push(HEADER_ROW + 1 + i);
    }
    if (emptyRows.length >= newQuestions.length) break;
  }

  // 10. Escribir
  let written = 0;
  for (let i = 0; i < newQuestions.length && i < emptyRows.length; i++) {
    const q        = newQuestions[i];
    const rowNum   = emptyRows[i];
    const item     = items[q.item_id] || {};
    const nickname = nicknames[q.from?.id] || `ML#${q.from?.id}`;
    const itemTitle = item.title || q.item_id || "";
    const priceML  = item.price || null;

    // Comparar precio ML vs Matriz
    const matrizMatch = informe ? findMatrizPrice(itemTitle, informe) : null;
    const hasPriceMismatch = priceML && matrizMatch && (priceML !== matrizMatch.precio);
    const priceAlert = hasPriceMismatch
      ? `⚠ PRECIO ML USD ${priceML} ≠ ${matrizMatch.fuente} USD ${matrizMatch.precio} — verificar antes de responder`
      : "";

    // Estado
    const estado = hasPriceMismatch ? "Pendiente revisión precio" : "Pendiente";

    // Respuesta sugerida
    const respuestaSugerida = generateResponse(q, item, nickname, hasPriceMismatch);

    // Observaciones
    const obsBase = `Q:${q.id} | ${formatDateTime(q.date_created)} | ${q.item_id} ${itemTitle}`;
    const obs = priceAlert ? `${obsBase} | ${priceAlert}` : obsBase;

    const rowData = [
      formatDate(q.date_created), // Fecha
      nickname,                    // Cliente
      "",                          // Teléfono
      "",                          // Ubicación / Dirección
      "ML",                        // Origen
      q.text,                      // Consulta / Pedido
      autoCategoria(itemTitle, q.text), // Categoría
      "Alta",                      // Prioridad manual
      estado,                      // Estado
      "PANELSIM",                  // Responsable
      "Responder ML",              // Próxima acción
      today(),                     // Fecha próxima acción
      "Nuevo",                     // Nivel de avance
      "No",                        // Necesita cotización
      "No",                        // Cotización enviada
      "",                          // Monto estimado USD
      "",                          // Probabilidad cierre
      "Hoy",                       // Urgencia
      "No",                        // Stock a validar
      "",                          // Datos faltantes
      "ML",                        // Tipo de cliente
      obs,                         // Observaciones
      formatDate(q.date_created),  // Último contacto
      "",                          // Resultado esperado
      "",                          // Cierre / Estado final
      "",                          // Días sin movimiento
      "Sí",                        // Vence hoy
      "",                          // Score auto
      "",                          // Prioridad auto
      "SI",                        // Alerta
      respuestaSugerida,           // Respuesta Sugerida (col AF)
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_TAB}'!B${rowNum}:AF${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowData] },
    });

    const flag = hasPriceMismatch ? " 🔴 revisión precio" : "";
    console.log(`  ✓ F${rowNum} — Q:${q.id} | ${nickname} | "${q.text.slice(0,45)}"${flag}`);
    written++;
  }

  console.log(`>>> Sync completo: ${written} pregunta(s) ingresada(s)`);
}

main().catch((e) => {
  console.error("✗ Error en panelsim-ml-crm-sync:", e.message);
  process.exit(1);
});
