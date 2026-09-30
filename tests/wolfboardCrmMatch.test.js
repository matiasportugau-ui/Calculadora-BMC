/**
 * Wolfboard Admin ↔ CRM match: id-first; never text-steal a bound CRM row.
 */
import assert from "node:assert/strict";
import {
  consultaMatchesCrmRow,
  findCrmRowForWolfboard,
  findUnboundCrmRowsByConsulta,
  mapCrmRowsForWolfboardMatch,
  observacionesConsultaStem,
} from "../server/lib/wolfboardCrmMatch.js";

const seed = "Chat tienda Panelin — inicio";

assert.equal(observacionesConsultaStem("Pedido techo 40mm — PDF: https://x"), "Pedido techo 40mm");
assert.equal(observacionesConsultaStem(""), "");

assert.equal(
  consultaMatchesCrmRow({ G: seed, W: "" }, seed),
  true,
);
assert.equal(
  consultaMatchesCrmRow({ G: "", W: seed }, seed),
  true,
);
assert.equal(
  consultaMatchesCrmRow({ G: "", W: `Pedido techo 40mm — PDF: https://x` }, "Pedido techo 40mm"),
  true,
);

const crmRows = [
  { _rowNum: 10, corrId: "WBK-aaa", G: seed, W: seed },
  { _rowNum: 11, corrId: "", G: seed, W: seed },
  { _rowNum: 12, corrId: "WBK-bbb", G: "otro pedido", W: "" },
];

// Id match wins even when text also matches a different row.
const byId = findCrmRowForWolfboard(crmRows, seed, "WBK-aaa");
assert.equal(byId?.matchKind, "id");
assert.equal(byId?.cr._rowNum, 10);

// Bound-only CRM with shared seed: another Admin id must not text-steal AF.
const boundOnly = [{ _rowNum: 10, corrId: "WBK-aaa", G: seed, W: seed }];
const steal = findCrmRowForWolfboard(boundOnly, seed, "WBK-ccc");
assert.equal(steal, null, "must not text-match CRM already bound to WBK-aaa");

// With one unbound + one bound duplicate text, text may only hit the unbound row.
const mixed = findCrmRowForWolfboard(crmRows, seed, "WBK-ccc");
assert.equal(mixed?.matchKind, "text");
assert.equal(mixed?.cr._rowNum, 11);

// Single unbound text match is ok.
const unboundOnly = [
  { _rowNum: 20, corrId: "", G: seed, W: "" },
  { _rowNum: 21, corrId: "WBK-x", G: "distinto", W: "" },
];
const byText = findCrmRowForWolfboard(unboundOnly, seed, "WBK-new");
assert.equal(byText?.matchKind, "text");
assert.equal(byText?.cr._rowNum, 20);

// Ambiguous unbound duplicates → refuse (caller may create a new CRM row).
const ambig = [
  { _rowNum: 30, corrId: "", G: seed, W: "" },
  { _rowNum: 31, corrId: "", G: seed, W: "" },
];
assert.equal(findCrmRowForWolfboard(ambig, seed, "WBK-1"), null);
assert.equal(findUnboundCrmRowsByConsulta(ambig, seed).length, 2);

// Simulate quote-batch: first lead binds CRM; second shared-seed lead must miss.
const batch = [];
const firstHit = findCrmRowForWolfboard(batch, seed, "WBK-1");
assert.equal(firstHit, null);
batch.push({ _rowNum: 40, corrId: "WBK-1", G: seed, W: seed });
const secondHit = findCrmRowForWolfboard(batch, seed, "WBK-2");
assert.equal(secondHit, null, "second storefront seed must not overwrite first CRM AF");

const mapped = mapCrmRowsForWolfboardMatch([["ID1", "", "", "", "", "", "consulta G"]]);
assert.equal(mapped[0]._rowNum, 4);
assert.equal(mapped[0].corrId, "ID1");
assert.equal(mapped[0].G, "consulta G");

console.log("wolfboardCrmMatch: ok");
