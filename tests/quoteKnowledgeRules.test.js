// ═══════════════════════════════════════════════════════════════════════════
// Conocimiento rules wired into code — unit + golden consultas
// Source: docs/team/knowledge/CONOCIMIENTO-COMPARATIVE-2026-10-11.md (§D matrix)
//   #4/#5 familia (uso → familia) · #7 USD/m² sanity · draft #1 ML/CL clarify
//   #3 adjuntos (gap) · scenario-router guard
// Run: node --test tests/quoteKnowledgeRules.test.js  (or `node tests/...` for TAP)
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanityCheckUsdPerM2,
  suggestFamiliaForUso,
  needsClarifyForIncompleteLead,
  inferQuoteIntentFromUserText,
  buildQuoteIntentConflict,
  attachmentGeometryGap,
} from "../server/lib/quoteKnowledgeRules.js";

describe("#7 USD/m² sanity band", () => {
  it("accepts a plausible quote (no familia prior)", () => {
    const r = sanityCheckUsdPerM2({ totalUsd: 2400, areaM2: 40 });
    assert.equal(r.usdPerM2, 60);
    assert.equal(r.ok, true);
    assert.deepEqual(r.flags, []);
  });

  it("flags USD/m² below the hard band", () => {
    const r = sanityCheckUsdPerM2({ totalUsd: 1000, areaM2: 40 }); // 25/m²
    assert.equal(r.ok, false);
    assert.match(r.flags[0], /por debajo de la banda/);
  });

  it("flags USD/m² above the hard band", () => {
    const r = sanityCheckUsdPerM2({ totalUsd: 5000, areaM2: 40 }); // 125/m²
    assert.equal(r.ok, false);
    assert.match(r.flags[0], /por encima de la banda/);
  });

  it("flags a soft deviation from the family typical", () => {
    const r = sanityCheckUsdPerM2({ totalUsd: 2800, areaM2: 40, familia: "ISOPANEL_EPS" }); // 70/m² vs ~46
    assert.equal(r.typical, 46);
    assert.equal(r.ok, false);
    assert.match(r.flags[0], /se aleja del típico/);
  });

  it("never throws on invalid inputs", () => {
    const r = sanityCheckUsdPerM2({ totalUsd: 0, areaM2: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.usdPerM2, null);
  });
});

describe("#4/#5 familia by uso (golden consultas)", () => {
  it("IsoPanel for a TECHO → suggest IsoDec EPS", () => {
    const r = suggestFamiliaForUso({ familia: "ISOPANEL_EPS", scope: "techo" });
    assert.equal(r.changed, true);
    assert.equal(r.sugerida, "ISODEC_EPS");
    assert.match(r.motivo, /Regla #4/);
  });

  it("IsoWall for a TECHO → suggest IsoDec PIR", () => {
    const r = suggestFamiliaForUso({ familia: "ISOWALL_PIR", scope: "techo" });
    assert.equal(r.sugerida, "ISODEC_PIR");
  });

  it("IsoDec EPS for a PARED → suggest IsoPanel EPS", () => {
    const r = suggestFamiliaForUso({ familia: "ISODEC_EPS", scope: "pared" });
    assert.equal(r.changed, true);
    assert.equal(r.sugerida, "ISOPANEL_EPS");
    assert.match(r.motivo, /Regla #5/);
  });

  it("IsoDec PIR for a PARED → suggest IsoWall PIR", () => {
    const r = suggestFamiliaForUso({ familia: "ISODEC_PIR", scope: "pared" });
    assert.equal(r.sugerida, "ISOWALL_PIR");
  });

  it("keeps a coherent familia (isodec + techo) unchanged", () => {
    const r = suggestFamiliaForUso({ familia: "isodec_eps", scope: "techo" });
    assert.equal(r.changed, false);
    assert.equal(r.sugerida, "ISODEC_EPS");
    assert.equal(r.motivo, null);
  });
});

describe("draft #1 — ML/CL clarify before quoting", () => {
  it("asks familia+espesor for an incomplete ML lead", () => {
    const r = needsClarifyForIncompleteLead({ origen: "ML", familia: "", espesor: "" });
    assert.equal(r.clarify, true);
    assert.deepEqual(r.missing, ["familia", "espesor"]);
  });

  it("asks only the missing field for CL", () => {
    const r = needsClarifyForIncompleteLead({ origen: "CL", familia: "ISODEC_EPS", espesor: "" });
    assert.deepEqual(r.missing, ["espesor"]);
  });

  it("does not gate a complete ML lead", () => {
    const r = needsClarifyForIncompleteLead({ origen: "ML", familia: "ISODEC_EPS", espesor: 100 });
    assert.equal(r.clarify, false);
  });

  it("does not gate non ML/CL origins (WA is quote-ready)", () => {
    const r = needsClarifyForIncompleteLead({ origen: "WA", familia: "", espesor: "" });
    assert.equal(r.clarify, false);
  });
});

describe("#3 attachment/plan gap", () => {
  it("returns the gap when a plan is attached with no usable measures", () => {
    const r = attachmentGeometryGap({ text: "te mando el plano", hasAttachments: true });
    assert.equal(r.needsAttachment, true);
    assert.equal(r.gap, "medidas_desde_plano_o_adjunto");
    assert.ok(r.pedir.includes("m²"));
  });

  it("does not flag when the text already carries measures", () => {
    const r = attachmentGeometryGap({ text: "te mando el plano, son 200 m2", hasAttachments: true });
    assert.equal(r.gap, null);
  });

  it("ignores non-attachment WA consultations", () => {
    const r = attachmentGeometryGap({ text: "cotizar 100m2 isodec", origen: "WA" });
    assert.equal(r.needsAttachment, false);
  });

  it("treats EM as attachment-prone", () => {
    const r = attachmentGeometryGap({ text: "hola, ver adjunto", origen: "EM" });
    assert.equal(r.needsAttachment, true);
  });
});

describe("scenario-router guard (golden consultas)", () => {
  it("detects presupuesto libre from a WA panel paste", () => {
    const text = "cotices 2 paneles de 2,45 de 100mm y súmame 9 metros de ángulo de aluminio";
    assert.equal(inferQuoteIntentFromUserText(text), "presupuesto_libre");
    const err = buildQuoteIntentConflict({ scenario: "camara_frig", pared: {}, camara: {} }, text);
    assert.match(err, /presupuesto libre/);
  });

  it("allows a matching techo buildQuote", () => {
    assert.equal(buildQuoteIntentConflict({ scenario: "solo_techo" }, "cotizame un techo ISODEC 100"), null);
  });

  it("rejects cámara when the user asked for a techo", () => {
    const err = buildQuoteIntentConflict({ scenario: "camara_frig" }, "Necesito un techo ISODEC");
    assert.match(err, /no coincide/);
  });
});
