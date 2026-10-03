// Offline pins for src/utils/quotationNaming.js — Drive / PDF filenames.
// Run: node tests/quotationNamingGates.test.js
//
// A slash that survives sanitizing, a UTC date used as the file stamp, or an
// en-dash treated as the legacy folder marker would overwrite the wrong Drive folder.

import {
  buildDriveClientFolderName,
  buildDriveQuotationFolderName,
  buildGlobalPdfFileName,
  clientFileSlug,
  extractCityFromDireccion,
  isLegacyFlatQuotationFolder,
  montevideoDdmmyy,
  montevideoYmd,
  sanitizeFileSegment,
} from "../src/utils/quotationNaming.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

group("sanitizeFileSegment", () => {
  assert(sanitizeFileSegment("../../etc/passwd") === "....etcpasswd", "slashes stripped, dots kept");
  assert(sanitizeFileSegment("..\\..\\secret") === "....secret", "backslashes stripped");
  assert(sanitizeFileSegment('a/b?c*d:e"f<g>h|i') === "abcdefghi", "reserved filename chars stripped");
  assert(sanitizeFileSegment("Arcor  SA\nS.A.") === "Arcor SAS.A.", "newline is deleted, so the tokens glue together");
  assert(sanitizeFileSegment("Peña Núñez") === "Peña Núñez", "Spanish letters kept");
  assert(sanitizeFileSegment("ok🙂") === "ok", "emoji stripped");
  assert(sanitizeFileSegment("   ") === "proyecto", "blank → proyecto");
  assert(sanitizeFileSegment(null) === "proyecto", "null → proyecto");
  assert(sanitizeFileSegment("abcdefghijklmnopqrstuvwxyz0123456789") === "abcdefghijklmnopqrstuvwxyz0123", "default cap is 30");
  assert(sanitizeFileSegment("abcdefghij", 4) === "abcd", "explicit max length");
});

group("client and Drive folder names", () => {
  assert(clientFileSlug(null) === "proyecto", "null client → proyecto");
  assert(clientFileSlug("  Galpón Norte  ") === "Galpón Norte", "string slug trimmed");
  assert(
    clientFileSlug({ razonSocial: "Arcor SA", nombre: "Obra vieja" }) === "Arcor SA",
    "razón social beats nombre",
  );
  assert(
    clientFileSlug({ razonSocial: "   ", nombre: "Solo nombre" }) === "Solo nombre",
    "blank razón falls through to nombre",
  );
  assert(clientFileSlug({}) === "proyecto", "empty client object → proyecto");

  assert(
    buildDriveClientFolderName({ rut: "21.456.789-0", razonSocial: "Arcor SA" }) === "21456789-0 - Arcor SA",
    "RUT dots and spaces compacted, hyphen kept",
  );
  assert(
    buildDriveClientFolderName({ rut: "12*345/99", nombre: "A/B" }) === "1234599 - AB",
    "RUT and label lose path characters",
  );
  assert(
    buildDriveClientFolderName({ rut: "123456789012345999", nombre: "Cliente" }) === "12345678901234 - Cliente",
    "RUT truncated to 14 before the label",
  );
  assert(
    buildDriveClientFolderName({ nombre: "Solo nombre" }) === "Solo nombre",
    "no RUT → label only",
  );
  assert(buildDriveClientFolderName({}) === "proyecto", "empty proyecto → proyecto");
  assert(buildDriveQuotationFolderName("BMC/001:A") === "BMC001A", "quotation code cannot add a path segment");
  assert(buildDriveQuotationFolderName("   ") === "BMC", "blank quotation code → BMC");
  assert(buildDriveQuotationFolderName(null) === "BMC", "null quotation code → BMC");
});

group("legacy folder and city", () => {
  assert(isLegacyFlatQuotationFolder("BMC-001 — Cliente") === true, "BMC- plus em dash is legacy");
  assert(isLegacyFlatQuotationFolder("BMC-001 - Cliente") === false, "hyphen is not the legacy marker");
  assert(isLegacyFlatQuotationFolder("bmc-001 — Cliente") === false, "legacy prefix is case-sensitive");
  assert(isLegacyFlatQuotationFolder("BMC- — x") === true, "em dash anywhere after BMC- matches");
  assert(isLegacyFlatQuotationFolder(null) === false, "null name is not legacy");

  assert(extractCityFromDireccion("Ruta 8 km 26, Montevideo") === "Montevideo", "last comma segment is the city");
  assert(extractCityFromDireccion("a, b, Canelones") === "Canelones", "last of several segments");
  assert(extractCityFromDireccion("Montevideo") === "Montevideo", "no comma → first word");
  assert(extractCityFromDireccion("calle 123,") === "calle", "trailing comma does not invent an empty city");
  assert(extractCityFromDireccion("foo,  , bar") === "bar", "blank segments dropped");
  assert(extractCityFromDireccion("   ") === "", "blank address → empty");
  assert(extractCityFromDireccion(null) === "", "null address → empty");
});

group("Montevideo stamp and PDF name", () => {
  const beforeMidnight = new Date("2026-05-20T02:30:00.000Z");
  const atMidnight = new Date("2026-05-20T03:00:00.000Z");
  assert(montevideoYmd(beforeMidnight) === "2026-05-19", "02:30Z is still 19 May in Montevideo");
  assert(montevideoDdmmyy(beforeMidnight) === "190526", "ddmmyy follows Montevideo, not UTC");
  assert(montevideoYmd(atMidnight) === "2026-05-20", "03:00Z is 20 May in Montevideo");
  assert(montevideoDdmmyy(atMidnight) === "200526", "ddmmyy rolls at Montevideo midnight");

  assert(
    buildGlobalPdfFileName(22, { razonSocial: "Arcor/SA", nombre: "Otro", direccion: "Ruta 8, Montevideo" }, atMidnight)
      === "0022BMC-200526-ArcorSA-Montevideo.pdf",
    "pdf name pads the counter, strips slashes, and appends the city",
  );
  assert(
    buildGlobalPdfFileName(7, { nombre: "Obra" }, atMidnight) === "0007BMC-200526-Obra-proyecto.pdf",
    "missing city still appends -proyecto because sanitize never returns empty",
  );
  assert(
    buildGlobalPdfFileName(null, {}, atMidnight) === "nullBMC-200526-proyecto-proyecto.pdf",
    "null counter is not coerced to 0000 and the empty city repeats proyecto",
  );
});

console.log(`\nquotationNamingGates: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
