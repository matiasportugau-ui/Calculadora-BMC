/**
 * .bmc.json serialize / deserialize — Drive + quote-store restore edges.
 * Complementary to applyQuoteSnapshot (#1058) and extras HITL (#1047).
 * Run: node tests/projectFileRestore.test.js
 */
import assert from "node:assert/strict";
import {
  serializeProject,
  deserializeProject,
  parseProjectFile,
} from "../src/utils/projectFile.js";

console.log("\n— projectFileRestore\n");

assert.throws(() => deserializeProject(null), /inválido/);
assert.throws(() => deserializeProject("nope"), /inválido/);
assert.throws(() => deserializeProject(undefined), /inválido/);

const empty = deserializeProject({});
assert.equal(empty.scenario, "solo_techo");
assert.equal(empty.listaPrecios, "web");
assert.equal(empty.flete, 280);
assert.equal(empty.techo.zonas[0].dosAguas, false);
assert.equal(empty.libreExtras, null);

const fleteZero = deserializeProject({ flete: 0, listaPrecios: "venta" });
assert.equal(fleteZero.flete, 0, "flete 0 must not fall back to 280");
assert.equal(fleteZero.listaPrecios, "venta");

const migrated = deserializeProject({
  techo: {
    tipoAguas: "dos_aguas",
    zonas: [
      { largo: 8, ancho: 6, dosAguas: false },
      { largo: 4, ancho: 3 },
    ],
  },
});
assert.equal(migrated.techo.tipoAguas, "dos_aguas");
assert.equal(migrated.techo.zonas[0].dosAguas, true);
assert.equal(migrated.techo.zonas[1].dosAguas, true);
assert.equal(migrated.techo.zonas[0].largo, 8);

const extras = [{ titulo: "Andamio", precio: "80", cantidad: "1" }];
const blob = serializeProject({
  scenario: "presupuesto_libre",
  listaPrecios: "venta",
  proyecto: { nombre: "ACME" },
  techo: { familia: "ISODEC_EPS", espesor: 100, zonas: [{ largo: 9, ancho: 6, dosAguas: true }] },
  pared: { familia: "" },
  camara: {},
  flete: 0,
  libreExtras: extras,
  quotationCode: "BMC-0099",
});
assert.equal(blob.scenario, "presupuesto_libre");
assert.equal(blob.flete, 0);
assert.deepEqual(blob.libreExtras, extras);
assert.equal(blob._meta.quotationCode, "BMC-0099");
assert.equal(blob._meta.formatVersion, 1);

const noExtras = serializeProject({
  scenario: "solo_techo",
  listaPrecios: "web",
  proyecto: {},
  techo: {},
  pared: {},
  camara: {},
  flete: 10,
  libreExtras: [],
});
assert.equal(noExtras.libreExtras, undefined);

const wrapped = await parseProjectFile(JSON.stringify({
  id: "q-drive-1",
  snapshot: {
    scenario: "solo_fachada",
    listaPrecios: "venta",
    techo: { tipoAguas: "dos_aguas", zonas: [{ largo: 5, ancho: 4 }] },
    flete: 0,
    libreExtras: extras,
  },
}));
assert.equal(wrapped.scenario, "solo_fachada");
assert.equal(wrapped.listaPrecios, "venta");
assert.equal(wrapped.flete, 0);
assert.equal(wrapped.techo.zonas[0].dosAguas, true);
assert.deepEqual(wrapped.libreExtras, extras);

const rawFile = await parseProjectFile(JSON.stringify({
  scenario: "techo_fachada",
  listaPrecios: "web",
  techo: { familia: "ISOROOF", espesor: 50, zonas: [{ largo: 7, ancho: 5, dosAguas: false }] },
}));
assert.equal(rawFile.scenario, "techo_fachada");
assert.equal(rawFile.techo.familia, "ISOROOF");
assert.equal(rawFile.techo.zonas[0].dosAguas, false);

await assert.rejects(() => parseProjectFile({}), /no válida/);

console.log("projectFileRestore: ok");
