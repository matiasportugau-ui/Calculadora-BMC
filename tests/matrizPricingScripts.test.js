import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPathForMatrizSku, normalizeSku } from "../src/data/matrizPreciosMapping.js";
import { parseCsvRows } from "../src/utils/csvPricingImport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const node = process.execPath;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bmc-matriz-pricing-"));
}

function writeFixture(dir, name, contents) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents, "utf8");
  return file;
}

function runScript(script, args) {
  return execFileSync(node, [path.join(repoRoot, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

{
  assert.equal(normalizeSku(" iagro-40 col "), "IAGRO40COL");
  assert.equal(
    getPathForMatrizSku(" iagro-40 col "),
    "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
    "historical Colonial aliases must keep resolving to the distinct Colonial panel",
  );
  assert.equal(
    getPathForMatrizSku(6838),
    "PERFIL_TECHO.gotero_frontal.ISODEC.100",
    "numeric BROMYROS SKUs must survive object-key coercion",
  );
  assert.equal(
    getPathForMatrizSku("CAN.ISDC120"),
    "PERFIL_TECHO.canalon.ISODEC.120",
    "SKUs with dots must not be normalized away",
  );
}

{
  const dir = tmpDir();
  const csv = writeFixture(dir, "prices.csv", [
    "path,venta_local,venta_web,costo",
    "PANELS_TECHO.ISOROOF_COLONIAL.esp.40,77.77,88.88,55.55",
    "FIJACIONES.tornillo_exagonal_12_34,0.12,0.13,0.04",
    "PANELS_TECHO.DOES_NOT_EXIST.esp.999,1,2,3",
    "",
  ].join("\n"));

  const constantsPath = path.join(repoRoot, "src/data/constants.js");
  const before = fs.readFileSync(constantsPath, "utf8");
  const stdout = runScript("scripts/bake-matriz-to-constants.mjs", [csv, "--dry-run"]);
  const after = fs.readFileSync(constantsPath, "utf8");

  assert.equal(after, before, "dry-run must not mutate constants.js");
  assert.match(stdout, /paths con precio: 3/);
  assert.match(stdout, /Hojas con cambios de valor: 2/);
  assert.match(stdout, /ediciones numericas: 6|ediciones numéricas: 6/);
  assert.match(stdout, /Paths del CSV sin hoja en constants\.js: 1/);
  assert.match(stdout, /PANELS_TECHO\.ISOROOF_COLONIAL\.esp\.40/);
  assert.match(stdout, /FIJACIONES\.tornillo_exagonal_12_34/);
}

{
  const dir = tmpDir();
  const calcCsv = writeFixture(dir, "calc.csv", [
    "path,label,categoria,unidad,costo,venta_bmc_local,venta_local_iva_inc,venta_web,venta_web_iva_inc",
    '"PANELS_TECHO.ISOROOF_COLONIAL.esp.40","Colonial, 40","Paneles","m2","1.234,50","2.000,00",2440,2100,2562',
    "FIJACIONES.tornillo_exagonal_12_34,Tornillo,Fijaciones,unid,0.04,0.12,,0.13,",
    "SELLADORES.silicona,Silicona,Selladores,unid,1,2,2.44,3,3.66",
    "",
  ].join("\n"));
  const matrizCsv = writeFixture(dir, "matriz.csv", [
    "sku,path,costo,venta_local,venta_local_iva_inc,venta_web,venta_web_iva_inc",
    "ISOCOL40,PANELS_TECHO.ISOROOF_COLONIAL.esp.40,1234.50,1999.00,1000,2100,2562",
    "THEX1234,FIJACIONES.tornillo_exagonal_12_34,0.04,,0.15,-0.13,0.16",
    "GHOST,NO_EXISTE.en.calc,1,2,2.44,3,3.66",
    "",
  ].join("\n"));

  const stdout = runScript("scripts/reconcile-calc-vs-matriz.mjs", [calcCsv, matrizCsv, "--out-dir", dir]);
  const report = JSON.parse(fs.readFileSync(path.join(dir, "reconcile-report.json"), "utf8"));
  const importRows = parseCsvRows(fs.readFileSync(path.join(dir, "matriz-import-ready.csv"), "utf8"));
  const rowsByPath = new Map(importRows.slice(1).map((row) => [row[1], row]));

  assert.match(stdout, /Solo en calc .*: 1/);
  assert.match(stdout, /Solo en MATRIZ .*:     1/);
  assert.equal(report.resumen.soloEnCalc, 1);
  assert.deepEqual(report.soloEnCalc, ["SELLADORES.silicona"]);
  assert.equal(report.resumen.soloEnMatriz, 1);
  assert.deepEqual(report.soloEnMatriz, ["NO_EXISTE.en.calc"]);
  assert.equal(report.resumen.pathsConDiferencias, 2);
  assert.equal(report.resumen.anomaliasMatriz, 2);
  assert.equal(report.resumen.celdasRellenadasEnImport, 1);

  const colonial = rowsByPath.get("PANELS_TECHO.ISOROOF_COLONIAL.esp.40");
  assert.equal(colonial[0], "ISOCOL40", "import-ready should preserve the sheet SKU when present");
  assert.equal(colonial[2], "Colonial, 40", "quoted descriptions with commas should round-trip");
  assert.equal(colonial[4], "1234.5", "UY decimal thousands should parse to numeric cost");
  assert.equal(colonial[5], "2000", "calculator price should win over stale MATRIZ values");

  const tornillo = rowsByPath.get("FIJACIONES.tornillo_exagonal_12_34");
  assert.equal(tornillo[0], "THEX1234");
  assert.equal(tornillo[5], "0.12", "missing MATRIZ venta_local should be filled from calculator");
  assert.equal(tornillo[7], "0.13", "negative MATRIZ web price should not flow into import-ready");
  assert.equal(tornillo[8], "0.16", "missing web c/IVA should be derived from calculator web price");
}

console.log("matrizPricingScripts tests OK");
