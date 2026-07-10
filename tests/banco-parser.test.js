// Banco — parser de extractos BROU, offline.
// Cubre: XLS "Saldos y Movimientos" (seriales Excel, preámbulo con Nº de
// Cuenta/Moneda, footer), CSV legado (fechas D/M/YYYY, importes es-UY,
// reparación de decimales partidos), dedup hashes y matching de reglas.
// Run: node tests/banco-parser.test.js

import * as XLSX from "xlsx";
import {
  excelSerialToISO,
  matchRule,
  normalizeText,
  parseAmount,
  parseBankStatement,
  parseBrouCsv,
  parseCsvRows,
  parseFecha,
} from "../server/lib/bancoStatementParser.js";

let passed = 0;
let failed = 0;
function assert(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
    failed++;
  }
}

function isoToSerial(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

// ── parseAmount ─────────────────────────────────────────────────────────────
console.log("parseAmount");
assert('EU "1.185,08" → 1185.08', parseAmount("1.185,08") === 1185.08);
assert('US "2,000.00" → 2000', parseAmount("2,000.00") === 2000);
assert('US "36,000.00" → 36000', parseAmount("36,000.00") === 36000);
assert('"45.00" → 45', parseAmount("45.00") === 45);
assert('EU agrupado "1.000" → 1000', parseAmount("1.000") === 1000);
assert('"2995,2" → 2995.2', parseAmount("2995,2") === 2995.2);
assert('con moneda "$ 1.598,70" → 1598.7', parseAmount("$ 1.598,70") === 1598.7);
assert('negativo "-500,25" → -500.25', parseAmount("-500,25") === -500.25);
assert("number passthrough 766.23", parseAmount(766.23) === 766.23);
assert("vacío → null", parseAmount("") === null);
assert("null → null", parseAmount(null) === null);
assert('basura "N/A" → null', parseAmount("N/A") === null);

// ── fechas ──────────────────────────────────────────────────────────────────
console.log("parseFecha");
assert("serial 46213 → 2026-07-10", excelSerialToISO(46213) === "2026-07-10");
assert("serial vía parseFecha", parseFecha(46213) === "2026-07-10");
assert('"02/01/2020" D/M → 2020-01-02', parseFecha("02/01/2020") === "2020-01-02");
assert('"7/4/2025" → 2025-04-07 (D/M, no M/D)', parseFecha("7/4/2025") === "2025-04-07");
assert('"9/7/26" YY → 2026-07-09', parseFecha("9/7/26") === "2026-07-09");
assert("ISO passthrough", parseFecha("2026-07-10") === "2026-07-10");
assert('"31/2/2025" imposible → null', parseFecha("31/2/2025") === null);
assert("texto → null", parseFecha("Movimientos") === null);

// ── XLS e-BROU (estructura real: preámbulo + header + datos + footer) ───────
console.log("XLS Saldos y Movimientos");
const aoa = [
  [null, null, null],
  ["Fecha: 10/07/2026 04:13"],
  ["Saldos y Movimientos"],
  ["110520638-00001"],
  ["Saldo disponible\n$ 1.598,70", null, "Nº de Cuenta\nCA 110520638-00001", null, "Moneda\n$", "N° de Cuenta anterior\nCA 600-7651899"],
  ["Movimientos"],
  ["Fecha", "Descripción", null, "Número de documento", "Asunto", "Dependencia", "Débito", "Crédito"],
  [isoToSerial("2026-07-10"), "Comercio: DLO*PedidosYa Propin", null, "4940", null, "199 - Casa Matriz", 45, null],
  [isoToSerial("2026-07-09"), "TRF E-BROU OTROS", null, "2607090639625228", "METALOG SAS", "171 - Canales Digitales", null, "2,000.00"],
  [isoToSerial("2026-07-07"), "SPI - COMISIÓN", null, null, "Bmc", "171 - Canales Digitales", 66.1, null],
  // dos retiros idénticos legítimos el mismo día:
  [isoToSerial("2026-07-06"), "Retiro Red: REDBROU", null, null, null, "199 - Casa Matriz", 5000, null],
  [isoToSerial("2026-07-06"), "Retiro Red: REDBROU", null, null, null, "199 - Casa Matriz", 5000, null],
  // fila sin importe → error reportado, no descartada en silencio:
  [isoToSerial("2026-07-05"), "MOVIMIENTO RARO", null, null, null, "199 - Casa Matriz", null, null],
  [],
  ["Esta información es la que consta en los Sistemas del Banco en el día y hora indicados."],
];
const ws = XLSX.utils.aoa_to_sheet(aoa);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

const xls = parseBankStatement({ buffer });
assert("header detectado", xls.headerFound === true);
assert("5 movimientos", xls.movements.length === 5, xls.movements.length);
assert("1 error (sin_importe)", xls.errors.length === 1 && xls.errors[0].reason === "sin_importe", xls.errors);
assert("meta cuenta 110520638-00001", xls.meta.accountNumber === "110520638-00001", xls.meta);
assert("meta moneda UYU", xls.meta.currency === "UYU", xls.meta);
assert("meta cuenta anterior", xls.meta.previousAccountNumber === "CA 600-7651899", xls.meta);
const [m0, m1] = xls.movements;
assert("fecha serial → ISO", m0.fecha === "2026-07-10", m0);
assert("débito numérico 45", m0.debito === 45 && m0.credito === null, m0);
assert("crédito texto US → 2000", m1.credito === 2000 && m1.debito === null, m1);
assert("asunto conservado", m1.asunto === "METALOG SAS", m1);
const retiros = xls.movements.filter((m) => m.descripcion === "Retiro Red: REDBROU");
assert("retiros idénticos con hash distinto", retiros.length === 2 && retiros[0].dedupHash !== retiros[1].dedupHash);
assert(
  "hashes únicos en todo el extracto",
  new Set(xls.movements.map((m) => m.dedupHash)).size === xls.movements.length,
);

// idempotencia: mismo archivo → mismos hashes
const xls2 = parseBankStatement({ buffer });
assert(
  "re-parse → hashes idénticos",
  xls2.movements.every((m, i) => m.dedupHash === xls.movements[i].dedupHash),
);

// ── CSV legado "Consulta de Movimientos" ────────────────────────────────────
console.log("CSV legado");
const csv = [
  "Fecha: 23/06/2021 Hora: 17:35",
  "Consulta de Movimientos",
  "COMISIONES BROU 2020",
  "Fecha,Descripción,Número Documento,Num. Dep.,Asunto,Débito,Crédito",
  '02/01/2020,Comercio: TIENDA INGLESA,123027267,199 - Casa Matriz,,"1.185,08",',
  '02/01/2020,TRF SPI PAGO PROV.,200102000072181,171 - Canales Digitales,,,"7.962,94"',
  "03/01/2020,Retiro Red: REDBROU,96,199 - Casa Matriz,,5.000,00,",
].join("\n");
const legacy = parseBrouCsv(csv);
assert("CSV header detectado", legacy.headerFound === true);
assert("3 movimientos CSV", legacy.movements.length === 3, { m: legacy.movements.length, e: legacy.errors });
assert("importe EU citado", legacy.movements[0].debito === 1185.08, legacy.movements[0]);
assert("crédito EU citado", legacy.movements[1].credito === 7962.94, legacy.movements[1]);
assert(
  "decimal partido reparado (5.000,00 → 5000)",
  legacy.movements[2].debito === 5000,
  legacy.movements[2],
);
assert("Num. Dep. → dependencia", legacy.movements[0].dependencia === "199 - Casa Matriz", legacy.movements[0]);
assert("fecha D/M/YYYY", legacy.movements[0].fecha === "2020-01-02");

// fila irreparable → error, nunca descartada en silencio
const bad = parseBrouCsv(
  "Fecha,Descripción,Número Documento,Num. Dep.,Asunto,Débito,Crédito\n02/01/2020,X,1,dep,extra1,extra2,extra3,extra4,extra5",
);
assert("fila irreparable → error columnas_inesperadas", bad.errors.some((e) => e.reason === "columnas_inesperadas"), bad.errors);

// tokenizador: comillas con comas y saltos embebidos
const rows = parseCsvRows('a,"b,1\nb2",c\nd,e,f');
assert("RFC-4180 comillas", rows.length === 2 && rows[0][1] === "b,1\nb2" && rows[1][2] === "f", rows);

// ── reglas ──────────────────────────────────────────────────────────────────
console.log("matchRule");
const rules = [
  { pattern: "SPI - COMISION", categoria: "Comisiones bancarias", entidad: "bmc", priority: 10 },
  { pattern: "pedidosya", categoria: "Gastos varios", entidad: "personal", priority: 20 },
];
assert(
  "match sin acentos ni case",
  matchRule({ descripcion: "SPI - COMISIÓN", asunto: "Bmc" }, rules)?.categoria === "Comisiones bancarias",
);
assert(
  "match por prioridad y substring",
  matchRule({ descripcion: "Comercio: DLO*PedidosYa Market", asunto: null }, rules)?.entidad === "personal",
);
assert("sin match → null", matchRule({ descripcion: "TRF E-BROU OTROS", asunto: "METALOG SAS" }, rules) === null);
assert('normalizeText("Número de documento")', normalizeText("Número de documento") === "numero de documento");

console.log(`\nbanco-parser: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
