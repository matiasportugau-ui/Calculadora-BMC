/**
 * techoZonasActions — preserve dosAguas across agent setTechoZonas / aplicar_estado_calc
 */
import assert from "node:assert/strict";
import {
  mergeTechoZonasPayload,
  syncZonasDosAguasFromTipoAguas,
  stampDosAguasOnZonas,
} from "../src/utils/techoZonasActions.js";

function isAnnex(z) {
  return !!z?.preview?.attachParentGi || z?.preview?.lateralSide != null;
}

{
  const prev = [{ largo: 10, ancho: 8, dosAguas: true, preview: { mark: "A" } }];
  const merged = mergeTechoZonasPayload(prev, [{ largo: 12, ancho: 9 }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].largo, 12);
  assert.equal(merged[0].ancho, 9);
  assert.equal(merged[0].dosAguas, true, "bare agent zonas must keep prior dosAguas");
  assert.deepEqual(merged[0].preview, { mark: "A" }, "preview preserved");
}

{
  const prev = [{ largo: 10, ancho: 8, dosAguas: true }];
  const merged = mergeTechoZonasPayload(prev, [{ largo: 12, ancho: 9, dosAguas: false }]);
  assert.equal(merged[0].dosAguas, false, "explicit dosAguas in payload wins");
}

{
  const zonas = [
    { largo: 6, ancho: 5, dosAguas: false },
    { largo: 3, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der" }, dosAguas: false },
  ];
  const synced = syncZonasDosAguasFromTipoAguas(zonas, "dos_aguas", isAnnex);
  assert.equal(synced[0].dosAguas, true);
  assert.equal(synced[1].dosAguas, false, "lateral annex left alone");
}

{
  const stamped = stampDosAguasOnZonas([{ largo: 10, ancho: 5 }], "dos_aguas");
  assert.equal(stamped[0].dosAguas, true);
  const plain = stampDosAguasOnZonas([{ largo: 10, ancho: 5 }], undefined);
  assert.equal(plain[0].dosAguas, undefined);
}

{
  const { buildAplicarActions } = await import("../server/lib/agentTools.js");
  const acts = buildAplicarActions({
    techo: {
      familia: "ISODEC_EPS",
      espesor: "100",
      tipoAguas: "dos_aguas",
      zonas: [{ largo: 10, ancho: 5 }],
    },
  });
  const zonasAct = acts.find((a) => a.type === "setTechoZonas");
  assert.ok(zonasAct, "emits setTechoZonas");
  assert.equal(zonasAct.payload[0].dosAguas, true, "aplicar stamps dosAguas from tipoAguas");
  const techoAct = acts.find((a) => a.type === "setTecho");
  assert.equal(techoAct?.payload?.tipoAguas, "dos_aguas");
}

console.log("techoZonasActions.test.js: ok");
