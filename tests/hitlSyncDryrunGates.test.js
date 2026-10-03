// Offline CSV projection used by `npm run hitl:dryrun:csv`.
// Pins quoted newlines, the Admin. column map, and the header drop.
// Does not call Google.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(repoRoot, "scripts", "hitl-sync-dryrun.mjs");

function runCsv(csvPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, "--csv", csvPath, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        WOLFB_ADMIN_SHEET_ID: "sheet-test-id",
        WOLFB_ADMIN_TAB: "Admin.",
      },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, out, err }));
  });
}

function splitCompat(out) {
  const marker = "--- board.json compat (first 5) ---";
  const at = out.indexOf(marker);
  assert.ok(at > 0, "compat section missing");
  const summary = JSON.parse(out.slice(0, at));
  const flat = JSON.parse(out.slice(at + marker.length));
  return { summary, flat };
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hitl-csv-"));
const csvPath = path.join(dir, "admin.csv");

const consulta = "Hola precio, 10m\n— Q:13649370945 · MLU445615830 · https://articulo.mercadolibre.com.uy/MLU-445615830-foo";
const respuesta = '=HYPERLINK("http://evil")';

function csvField(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const header = ["Edit", "Asig", "Estado", "Fecha", "Cliente", "Origen", "Telefono", "Zona", "Consulta", "Interpretacion", "Respuesta", "Datos", "Presupuesto", "Enviado"];
const pendiente = [
  "https://edit", "op", "Pendiente", "25-09", 'ACME "NORTE"', "ML", "099", "MVD",
  consulta, "INTERP-SECRET", respuesta, "faltan", "https://drive.example/q", "Enviado",
];
const cerrado = [
  "https://edit", "op", "Enviado", "01-09", "SKIP", "WA", "1", "X",
  "no", "ai", "r", "d", "", "Pendiente",
];
const text = [header, pendiente, cerrado].map((cols) => cols.map(csvField).join(",")).join("\r\n") + "\r\n\r\n";
fs.writeFileSync(csvPath, text);

const { code, out, err } = await runCsv(csvPath, ["--quiet", "--compat"]);
assert.equal(code, 0, err);
const { summary, flat } = splitCompat(out);
assert.equal(summary.source, "csv");
assert.equal(summary.sheet_id, "sheet-test-id");
assert.equal(summary.tab, "Admin.");
assert.equal(summary.counts.sheet_rows, 2);
assert.equal(summary.counts.actionable, 1);
assert.equal(summary.counts.by_estado.pendiente, 1);
assert.equal(summary.counts.by_estado.enviado, 1);

assert.equal(flat.length, 1);
const item = flat[0];
assert.equal(item.admin_row, 2);
assert.equal(item.cliente, 'ACME "NORTE"');
assert.equal(item.canal, "ML");
assert.equal(item.zona, "MVD");
assert.equal(item.status, "Pendiente");
assert.equal(item.qid, "13649370945");
assert.equal(item.title, "Hola precio, 10m");
assert.ok(item.consulta.includes("\n"));
assert.equal(item.respuesta_ai, respuesta);
assert.equal(item.respuesta_ai.includes("INTERP-SECRET"), false);
assert.equal(item.link, "https://drive.example/q");
assert.equal(item.url, "https://docs.google.com/spreadsheets/d/sheet-test-id/edit");
assert.equal(item.url.includes("mercadolibre"), false);

const missing = await runCsv(path.join(dir, "nope.csv"), ["--quiet"]);
assert.equal(missing.code, 2);
assert.match(missing.err, /CSV not found/);

fs.rmSync(dir, { recursive: true, force: true });
console.log("hitlSyncDryrunGates.test.js: ok");
