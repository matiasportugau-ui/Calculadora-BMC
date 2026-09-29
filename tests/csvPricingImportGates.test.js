/**
 * MATRIZ CSV price edges suite 23 does not pin.
 * Run: node tests/csvPricingImportGates.test.js
 *
 * Pins: negatives and "$" stay null; 0 is kept; US "1,025.50" becomes 1.03
 * (comma wins); 42,999 rounds to 43; venta_local_iva_inc is not the net column;
 * venta_web_iva_inc is not venta_web.
 */
import assert from "node:assert/strict";
import {
  parseCsvNumber,
  findVentaColumnIndex,
  findVentaWebColumnIndex,
  findVentaWebIvaIncColumnIndex,
  findVentaLocalIvaIncColumnIndex,
  parseCsvRows,
  getDuplicatePathReport,
  getDuplicatePathReportFromRows,
} from "../src/utils/csvPricingImport.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("csvPricingImportGates");

assert.equal(parseCsvNumber("0"), 0);
assert.equal(parseCsvNumber("0,00"), 0);
ok("zero price is kept");

assert.equal(parseCsvNumber("-1"), null);
assert.equal(parseCsvNumber(" -2,5 "), null);
assert.equal(parseCsvNumber("abc"), null);
assert.equal(parseCsvNumber("$42,99"), null);
assert.equal(parseCsvNumber("=42"), null);
assert.equal(parseCsvNumber(true), null);
ok("negative, currency, formula, and non-strings are null");

assert.equal(parseCsvNumber("1,025.50"), 1.03);
ok("US thousands comma is not a thousands separator");

assert.equal(parseCsvNumber("42,999"), 43);
assert.equal(parseCsvNumber("42.999"), 43);
ok("third decimal rounds half up via toFixed");

assert.equal(parseCsvNumber("1.2.3"), 1.2);
assert.equal(parseCsvNumber(" 42,5 "), 42.5);
assert.equal(parseCsvNumber("1.025,5"), 1025.5);
ok("dot-decimal stops early; UY miles+comma still parses");

assert.equal(findVentaColumnIndex(["venta_local_iva_inc"]), -1);
assert.equal(findVentaColumnIndex(["venta_web", "venta"]), 1);
assert.equal(findVentaColumnIndex(["venta web"]), -1);
assert.equal(findVentaColumnIndex(["Venta_BMC"]), 0);
ok("IVA-inclusive and venta web are not the net venta column");

assert.equal(findVentaWebColumnIndex(["VENTA_WEB"]), 0);
assert.equal(findVentaWebColumnIndex(["venta_web_iva_inc"]), -1);
assert.equal(findVentaWebIvaIncColumnIndex(["venta_web"]), -1);
assert.equal(findVentaLocalIvaIncColumnIndex([" Venta_Local_IVA_INC "]), 0);
ok("web and local IVA columns stay exact");

assert.deepEqual(parseCsvRows(""), []);
assert.deepEqual(parseCsvRows("\n\n"), []);
assert.deepEqual(getDuplicatePathReport(["path"], -1), []);
assert.deepEqual(
  getDuplicatePathReport(["path,venta", ",10", "  ,11", "A,1", "A,2"], 0),
  [{ path: "A", count: 2, lineNumbers: [4, 5] }],
);
assert.deepEqual(getDuplicatePathReportFromRows([["path"], ["", "1"]], 0), []);
ok("blank CSV and empty paths do not invent duplicates");

console.log(`csvPricingImportGates: ${passed} passed`);
