/**
 * Drive / PDF filename helpers — path sanitization + UY calendar dates.
 * Run: node tests/quotationNaming.test.js
 */
import assert from "node:assert/strict";
import {
  montevideoYmd,
  montevideoDdmmyy,
  sanitizeFileSegment,
  clientFileSlug,
  buildDriveClientFolderName,
  buildDriveQuotationFolderName,
  isLegacyFlatQuotationFolder,
  extractCityFromDireccion,
  buildGlobalPdfFileName,
} from "../src/utils/quotationNaming.js";

console.log("\n— quotationNaming\n");

// Fixed instants: Uruguay is UTC−3 year-round (no DST).
const UY_NOON_20_MAY = new Date("2026-05-20T15:00:00.000Z"); // 12:00 UY
const UY_EVE_19_MAY = new Date("2026-05-20T02:30:00.000Z"); // 23:30 UY previous day

assert.equal(montevideoYmd(UY_NOON_20_MAY), "2026-05-20");
assert.equal(montevideoYmd(UY_EVE_19_MAY), "2026-05-19");
assert.equal(montevideoDdmmyy(UY_NOON_20_MAY), "200526");
assert.equal(montevideoDdmmyy(UY_EVE_19_MAY), "190526");

assert.equal(sanitizeFileSegment(""), "proyecto");
assert.equal(sanitizeFileSegment("   "), "proyecto");
assert.equal(sanitizeFileSegment("Arcor SA"), "Arcor SA");
assert.equal(sanitizeFileSegment("foo/bar\\baz"), "foobarbaz");
assert.equal(sanitizeFileSegment('a?*:"<>|b'), "ab");
assert.equal(sanitizeFileSegment("José Ñandú"), "José Ñandú");
assert.equal(sanitizeFileSegment("ok_file-name.v2"), "ok_file-name.v2");
assert.equal(sanitizeFileSegment("a".repeat(40)).length, 30);
// `/` stripped; `.` is an allowed filename char (not a traversal collapse).
assert.equal(sanitizeFileSegment("../etc/passwd"), "..etcpasswd");
assert.equal(sanitizeFileSegment("foo/../../bar"), "foo....bar");

assert.equal(clientFileSlug(null), "proyecto");
assert.equal(clientFileSlug("  "), "proyecto");
assert.equal(clientFileSlug("Cliente Uno"), "Cliente Uno");
assert.equal(
  clientFileSlug({ razonSocial: "Arcor SA", nombre: "ignored" }),
  "Arcor SA",
);
assert.equal(clientFileSlug({ nombre: "Juan Pérez" }), "Juan Pérez");

assert.equal(
  buildDriveClientFolderName({ rut: "21.123.456.001", razonSocial: "Arcor SA" }),
  "21123456001 - Arcor SA",
);
assert.equal(
  buildDriveClientFolderName({ rut: "123", nombre: "Solo Nombre" }),
  "123 - Solo Nombre",
);
assert.equal(
  buildDriveClientFolderName({ nombre: "Sin RUT" }),
  "Sin RUT",
);
assert.equal(buildDriveClientFolderName({}), "proyecto");
assert.ok(!buildDriveClientFolderName({ rut: "1", razonSocial: "a/b" }).includes("/"));

assert.equal(buildDriveQuotationFolderName("BMC-0042"), "BMC-0042");
assert.equal(buildDriveQuotationFolderName("BMC/hack"), "BMChack");
assert.equal(buildDriveQuotationFolderName(""), "BMC");

assert.equal(isLegacyFlatQuotationFolder("BMC-0042 — Cliente"), true);
assert.equal(isLegacyFlatQuotationFolder("BMC-0042 - Cliente"), false);
assert.equal(isLegacyFlatQuotationFolder("ENV-0042 — Cliente"), false);
assert.equal(isLegacyFlatQuotationFolder(""), false);

assert.equal(extractCityFromDireccion(""), "");
assert.equal(extractCityFromDireccion("Ruta 8 km 12, Montevideo"), "Montevideo");
assert.equal(extractCityFromDireccion("Pando"), "Pando");
assert.equal(extractCityFromDireccion("  Calle 1, Centro, Canelones  "), "Canelones");

assert.equal(
  buildGlobalPdfFileName(22, {
    razonSocial: "Arcor SA",
    direccion: "Ruta 1, Montevideo",
  }, UY_NOON_20_MAY),
  "0022BMC-200526-Arcor SA-Montevideo.pdf",
);
// Empty city still runs through sanitizeFileSegment → fallback slug "proyecto".
assert.equal(
  buildGlobalPdfFileName(1, { nombre: "Juan" }, UY_NOON_20_MAY),
  "0001BMC-200526-Juan-proyecto.pdf",
);

console.log("quotationNaming: ok");
