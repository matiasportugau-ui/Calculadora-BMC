// Contract tests for server/lib/crmRowMapper.js
// Run: node tests/crmRowMapper.test.js
//
// Guards the header-anchored, key-based CRM_Operativo write contract that
// replaced the fragile position-based array append (the column-shift bug:
// a missing Teléfono pushed every later field one column to the left).

import {
  buildCrmRow,
  validateCrmRow,
  sliceCrmRange,
  resolveCrmColumnIndex,
  buildHeaderIndex,
  normalizeHeader,
} from "../server/lib/crmRowMapper.js";

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
  fn();
}

// Canonical CRM_Operativo row-3 headers (A..AN), matching CRM_TO_BMC /
// crmRowParse / CRM-OPERATIVO-COCKPIT.md.
function canonicalHeaders() {
  const h = new Array(40).fill("");
  h[0] = "ID";
  h[1] = "Fecha";
  h[2] = "Cliente";
  h[3] = "Teléfono";
  h[4] = "Ubicación / Dirección";
  h[5] = "Origen";
  h[6] = "Consulta / Pedido";
  h[7] = "Categoría";
  h[8] = "Subestado";
  h[9] = "Estado";
  h[10] = "Responsable";
  h[17] = "Probabilidad de cierre";
  h[18] = "Urgencia";
  h[19] = "Validar stock";
  h[21] = "Tipo de cliente";
  h[22] = "Observaciones";
  h[32] = "Provider IA";
  h[33] = "Link presupuesto";
  h[34] = "Aprobado enviar";
  h[35] = "Enviado el";
  h[36] = "Bloquear auto";
  return h;
}

const emailLead = {
  fecha: "2026-06-30T00:00:00.000Z",
  cliente: "Juan Pérez",
  // telefono intentionally absent → the historic shift trigger
  ubicacion: "Canelones",
  origen: "Email-Auto",
  consulta: "200 m2 de techo",
  categoria: "Paneles techo",
  estado: "Pendiente",
  probabilidad: "Alta",
  urgencia: "24h",
  validarStock: "No",
  tipoCliente: "Empresa",
  observaciones: "obra nueva",
};

group("normalizeHeader strips accents/case/punctuation", () => {
  assert(normalizeHeader("Teléfono") === "telefono", "Teléfono");
  assert(normalizeHeader("Ubicación / Dirección") === "ubicacion direccion", "Ubicación / Dirección");
  assert(normalizeHeader("  PROBABILIDAD ") === "probabilidad", "trim+lower");
});

group("missing Teléfono does NOT shift later columns", () => {
  const { row, resolved } = buildCrmRow(canonicalHeaders(), emailLead);
  assert(row[3] === "", "D (Teléfono) is empty string, not omitted");
  assert(row[4] === "Canelones", "E (Ubicación) stays in column E — no shift");
  assert(row[5] === "Email-Auto", "F (Origen) stays in column F");
  assert(row[1] === emailLead.fecha, "B (Fecha) correct");
  assert(row[2] === "Juan Pérez", "C (Cliente) correct");
  assert(resolved.telefono === undefined, "telefono unresolved (caller omitted the key)");
});

group("explicit empty Teléfono behaves the same as absent", () => {
  const { row } = buildCrmRow(canonicalHeaders(), { ...emailLead, telefono: "" });
  assert(row[3] === "", "D empty");
  assert(row[4] === "Canelones", "E still Ubicación");
});

group("values are placed by header NAME (auto-corrects a reordered sheet)", () => {
  // Someone swapped the Teléfono and Ubicación columns in the sheet.
  const headers = canonicalHeaders();
  headers[3] = "Ubicación / Dirección";
  headers[4] = "Teléfono";
  const { row } = buildCrmRow(headers, { ...emailLead, telefono: "099111222" });
  assert(row[3] === "Canelones", "Ubicación follows its header to column D");
  assert(row[4] === "099111222", "Teléfono follows its header to column E");
});

group("renamed/missing header falls back to documented column letter", () => {
  const headers = canonicalHeaders();
  headers[3] = "Celular"; // no longer matches any Teléfono alias
  const { row, fallbacks, warnings } = buildCrmRow(headers, { ...emailLead, telefono: "099111222" });
  assert(row[3] === "099111222", "fallback writes Teléfono at documented column D");
  assert(fallbacks.includes("telefono"), "fallback recorded for telefono");
  assert(warnings.some((w) => w.key === "telefono" && w.issue === "header_fallback"), "warning emitted");
});

group("CSV/formula guard applied per cell when sanitize passed", () => {
  const { row } = buildCrmRow(canonicalHeaders(), {
    ...emailLead,
    cliente: "=HYPERLINK(\"http://evil\")",
  }, { sanitize: (v) => (/^[=+\-@]/.test(String(v)) ? "'" + v : String(v)) });
  assert(row[2].startsWith("'="), "leading = is neutralised");
});

group("validateCrmRow — canonical headers pass", () => {
  const built = buildCrmRow(canonicalHeaders(), emailLead);
  const r = validateCrmRow(built, canonicalHeaders(), { requireHeaders: true });
  assert(r.ok === true, `ok (errors: ${r.errors.join(",")})`);
});

group("validateCrmRow — too-narrow sheet degrades (requireHeaders:true)", () => {
  const narrow = ["ID", "Fecha", "Cliente"]; // missing Estado and everything after
  const built = buildCrmRow(narrow, emailLead);
  const r = validateCrmRow(built, narrow, { requireHeaders: true });
  assert(r.ok === false, "rejected");
  assert(r.errors.some((e) => e.startsWith("required_out_of_range") || e === "row_exceeds_headers"), "structural error reported");
});

group("validateCrmRow — empty headers", () => {
  const built = buildCrmRow([], emailLead);
  const strict = validateCrmRow(built, [], { requireHeaders: true });
  assert(strict.ok === false, "strict (email path) rejects missing headers");
  assert(strict.errors.includes("headers_unavailable"), "headers_unavailable reported");
  const lenient = validateCrmRow(built, [], { requireHeaders: false });
  assert(lenient.ok === true, "lenient (quote append path) tolerates fixed-letter fallback");
});

group("validateCrmRow window — canonical layout fits B:W", () => {
  const built = buildCrmRow(canonicalHeaders(), emailLead);
  const r = validateCrmRow(built, canonicalHeaders(), {
    requireHeaders: true,
    window: { from: "B", to: "W" },
  });
  assert(r.ok === true, `ok (errors: ${r.errors.join(",")})`);
});

group("validateCrmRow window — field pushed past W is rejected (not silently dropped)", () => {
  // Insert a column before Observaciones so it resolves to X (index 23),
  // outside the B:W write window.
  const headers = canonicalHeaders();
  headers[22] = "NUEVA_COLUMNA"; // was Observaciones
  headers[23] = "Observaciones"; // pushed to X
  const built = buildCrmRow(headers, emailLead);
  assert(built.resolved.observaciones === 23, "observaciones resolves to X(23)");
  const r = validateCrmRow(built, headers, {
    requireHeaders: true,
    window: { from: "B", to: "W" },
  });
  assert(r.ok === false, "rejected (would degrade instead of dropping the field)");
  assert(r.errors.includes("field_outside_write_range:observaciones"), "names the dropped field");
});

group("validateCrmRow window — quote gate field pushed past AK is rejected", () => {
  // Insert a column before the AG–AK gate block so bloquearAuto lands past AK.
  const headers = canonicalHeaders();
  headers.splice(32, 0, "NUEVA_COLUMNA"); // shift AG..AK right by one
  const quoteLead = {
    fecha: "2026", cliente: "ACME", origen: "Calculadora-Panelin",
    consulta: "x", categoria: "Cotización", estado: "Pendiente",
    providerIa: "", linkPresupuesto: "https://example.com/q.pdf",
    aprobadoEnviar: "No", enviadoEl: "", bloquearAuto: "No",
  };
  const built = buildCrmRow(headers, quoteLead);
  const r = validateCrmRow(built, headers, {
    requireHeaders: false,
    window: { from: "B", to: "AK" },
  });
  assert(r.ok === false, "rejected");
  assert(r.errors.some((e) => e === "field_outside_write_range:bloquearAuto"), "names bloquearAuto");
});

group("validateCrmRow — two keys resolving to the same column is rejected", () => {
  // Teléfono column deleted; "Ubicación / Dirección" now sits in D (index 3).
  const headers = canonicalHeaders();
  headers[3] = "Ubicación / Dirección";
  const built = buildCrmRow(headers, {
    fecha: "x", cliente: "c", estado: "Pendiente", telefono: "099", ubicacion: "Canelones",
  });
  assert(built.resolved.ubicacion === 3, "ubicacion resolves to D(3) by header");
  assert(built.resolved.telefono === 3, "telefono falls back to letter D(3) → collision");
  const r = validateCrmRow(built, headers, { requireHeaders: false });
  assert(r.ok === false, "collision rejected");
  assert(r.errors.some((e) => e.startsWith("duplicate_column")), "duplicate_column error reported");
});

group("validateCrmRow window — omitting window preserves prior behaviour", () => {
  const headers = canonicalHeaders();
  headers[22] = "NUEVA_COLUMNA";
  headers[23] = "Observaciones"; // out of B:W, but no window passed
  const built = buildCrmRow(headers, emailLead);
  const r = validateCrmRow(built, headers, { requireHeaders: true });
  assert(r.ok === true, "no window arg → no window check (back-compat)");
});

group("sliceCrmRange — email B:W window is 22 cells, Teléfono at slice idx 2", () => {
  const { row } = buildCrmRow(canonicalHeaders(), { ...emailLead, telefono: "099111222" });
  const window = sliceCrmRange(row, "B", "W");
  assert(window.length === 22, `22 cells (got ${window.length})`);
  assert(window[0] === emailLead.fecha, "slice[0] = B = Fecha");
  assert(window[2] === "099111222", "slice[2] = D = Teléfono");
  assert(window[3] === "Canelones", "slice[3] = E = Ubicación");
});

group("sliceCrmRange — quote B:AK window is 36 cells with gate tail", () => {
  const quoteLead = {
    fecha: "2026-06-30T00:00:00.000Z",
    cliente: "ACME",
    origen: "Calculadora-Panelin",
    consulta: "[solo_techo] total=USD 1000.00 c/IVA",
    categoria: "Cotización",
    estado: "Pendiente",
    linkPresupuesto: "https://example.com/q.pdf",
    aprobadoEnviar: "No",
    enviadoEl: "",
    bloquearAuto: "No",
  };
  const { row } = buildCrmRow(canonicalHeaders(), quoteLead);
  const window = sliceCrmRange(row, "B", "AK");
  assert(window.length === 36, `36 cells (got ${window.length})`);
  // AH (Link presupuesto) is absolute index 33 → slice index 33 - 1 = 32
  assert(window[32] === "https://example.com/q.pdf", "AH = link presupuesto");
  // AI (Aprobado enviar) absolute 34 → slice index 33
  assert(window[33] === "No", "AI = No");
  // AK (Bloquear auto) absolute 36 → slice index 35
  assert(window[35] === "No", "AK = No");
});

group("respuestaSugerida (AF) — used by WA/ML pipelines", () => {
  const headers = canonicalHeaders();
  headers[31] = "Respuesta sugerida"; // AF
  const idx = buildHeaderIndex(headers);
  assert(resolveCrmColumnIndex(idx, "respuestaSugerida").index === 31, "respuestaSugerida → AF(31) via header");
  // Falls back to documented letter AF when the header is absent.
  const fb = resolveCrmColumnIndex(buildHeaderIndex([]), "respuestaSugerida");
  assert(fb.index === 31 && fb.source === "fallback", "fallback to AF(31)");
  // Inside a B:AK (quote) window, outside a B:W (email) window. Include the
  // required anchors so only the window membership of AF is under test.
  const built = buildCrmRow(headers, {
    fecha: "2026", cliente: "Juan", estado: "Pendiente",
    respuestaSugerida: "Hola, gracias por tu consulta",
  });
  const inQuote = validateCrmRow(built, headers, { requireHeaders: false, window: { from: "B", to: "AK" } });
  assert(inQuote.ok === true, `AF is inside B:AK (errors: ${inQuote.errors.join(",")})`);
  const inEmail = validateCrmRow(built, headers, { requireHeaders: true, window: { from: "B", to: "W" } });
  assert(inEmail.ok === false && inEmail.errors.includes("field_outside_write_range:respuestaSugerida"), "AF is outside B:W");
});

group("resolveCrmColumnIndex / buildHeaderIndex basics", () => {
  const idx = buildHeaderIndex(canonicalHeaders());
  assert(resolveCrmColumnIndex(idx, "estado").index === 9, "estado → J(9) via header");
  assert(resolveCrmColumnIndex(idx, "estado").source === "header", "source header");
  const empty = buildHeaderIndex([]);
  const r = resolveCrmColumnIndex(empty, "estado");
  assert(r.index === 9 && r.source === "fallback", "estado falls back to J(9)");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
