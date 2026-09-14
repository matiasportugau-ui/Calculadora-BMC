import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { isPaidTier, canUseWhiteLabel, assertPaid, requirePaid } from "../server/lib/paidEntitlement.js";
import { validateLogoBuffer, sniffImageMime } from "../server/lib/brandingValidate.js";
import { applyPdfAudience, resolveAudience } from "../server/lib/pdfAudience.js";
import {
  buildBmcSnapshot,
  buildListaActivaCatalog,
  extractLines,
  pickClientTotal,
} from "../server/lib/quoteSnapshot.js";

function png1x1() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

describe("paid entitlement", () => {
  it("base cannot white-label; paid can; plus cannot", () => {
    assert.equal(isPaidTier({ plan_tier: "base" }), false);
    assert.equal(isPaidTier({ plan_tier: "plus" }), false);
    assert.equal(isPaidTier({ plan_tier: "paid" }), true);
    assert.equal(canUseWhiteLabel({ plan_tier: "plus", role: "comprador" }), false);
    assert.equal(canUseWhiteLabel({ plan_tier: "paid", role: "comprador" }), true);
    assert.equal(canUseWhiteLabel({ plan_tier: "base", role: "superadmin" }), true);
  });

  it("unpaid POST /api/me/branding → 403 plan_required", async () => {
    const fakeRequireUser = () => (req, _res, next) => {
      req.user = { id: "u1", plan_tier: "base", role: "comprador" };
      next();
    };
    const app = express();
    app.use(express.json());
    app.post("/api/me/branding", requirePaid(fakeRequireUser), (_req, res) => res.json({ ok: true }));
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const r = await fetch(`http://127.0.0.1:${port}/api/me/branding`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = await r.json();
    await new Promise((resolve) => server.close(resolve));
    assert.equal(r.status, 403);
    assert.equal(j.error, "plan_required");
  });

  it("unpaid assertPaid returns 403 plan_required", () => {
    const res = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    const ok = assertPaid({ user: { plan_tier: "base", role: "comprador" } }, res);
    assert.equal(ok, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "plan_required");
  });
});

describe("logo validation", () => {
  it("accepts png and rejects svg", () => {
    const png = validateLogoBuffer(png1x1());
    assert.equal(png.ok, true);
    assert.equal(png.mime, "image/png");
    const svg = validateLogoBuffer(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"));
    assert.equal(svg.ok, false);
    assert.equal(svg.error, "invalid_logo_type");
    assert.equal(sniffImageMime(Buffer.from("<?xml version='1.0'?><svg")), "image/svg+xml");
  });
});

describe("pdf audience", () => {
  const html = `<html><body><img src="/bmc-pdf/assets/bmc-logo.png" alt="BMC Uruguay"/><h1>BMC Uruguay</h1></body></html>`;

  it("paid client PDF omits BMC logo and header", () => {
    const out = applyPdfAudience(html, {
      audience: "client",
      branding: { display_name: "Barraca Sur", logo_data_url: "data:image/png;base64,AAA" },
    });
    assert.equal(out.includes("bmc-logo.png"), false);
    assert.equal(/BMC Uruguay/i.test(out), false);
    assert.equal(out.includes("data:image/png;base64,AAA"), true);
    assert.equal(out.includes("Barraca Sur"), true);
  });

  it("escapes hostile display_name in client HTML", () => {
    const out = applyPdfAudience(html, {
      audience: "client",
      branding: { display_name: `<img src=x onerror=alert(1)>`, logo_data_url: null },
    });
    assert.equal(out.includes("<img src=x"), false);
    assert.equal(out.includes("&lt;img"), true);
  });

  it("anonymous / unpaid HTML stays BMC-branded", () => {
    const out = applyPdfAudience(html, { audience: "client", branding: null });
    assert.equal(out.includes("bmc-logo.png"), true);
    assert.equal(out.includes("BMC Uruguay"), true);
  });

  it("comprador cannot request audience=bmc", () => {
    const r = resolveAudience("bmc", { role: "comprador" });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
    const ok = resolveAudience("bmc", { role: "admin" });
    assert.equal(ok.ok, true);
  });
});

describe("bmc snapshot freeze", () => {
  const catalog = { ISODEC_EPS_100: 37.76, "ISODEC_EPS-100": 37.76 };

  it("ignores tampered client totals", () => {
    const { snapshot, reused } = buildBmcSnapshot({
      totalUsd: 1,
      lines: [{ sku: "ISODEC_EPS_100", qty: 10, unit_price: 1 }],
    }, { catalog });
    assert.equal(reused, false);
    assert.equal(snapshot.price_drift, true);
    assert.equal(snapshot.lines[0].unit_price_server, 37.76);
    assert.equal(snapshot.lines[0].source, "LISTA_ACTIVA");
    const expectedSub = Math.round(37.76 * 10 * 100) / 100;
    assert.equal(snapshot.subtotal_usd, expectedSub);
    assert.equal(snapshot.total_usd, Math.round(expectedSub * 1.22 * 100) / 100);
    assert.notEqual(snapshot.total_usd, 1);
  });

  it("does not overwrite existing snapshot (soft-delete safe freeze)", () => {
    const first = buildBmcSnapshot({
      lines: [{ sku: "ISODEC_EPS_100", qty: 2 }],
    }, { catalog }).snapshot;
    const second = buildBmcSnapshot({
      lines: [{ sku: "ISODEC_EPS_100", qty: 99 }],
      totalUsd: 9999,
    }, { catalog, existingSnapshot: first });
    assert.equal(second.reused, true);
    assert.deepEqual(second.snapshot, first);
  });

  it("never uses client unit prices when catalog misses (no payload_fallback)", () => {
    const { snapshot } = buildBmcSnapshot({
      totalUsd: 999,
      lines: [{ sku: "FAKE_SKU_XYZ", qty: 10, unit_price: 50 }],
    }, { catalog: {} });
    assert.equal(snapshot.lines[0].source, "unpriced");
    assert.equal(snapshot.lines[0].unit_price_server, 0);
    assert.equal(snapshot.total_usd, null);
    assert.equal(snapshot.incomplete, true);
  });

  it("calc-shaped payload without flat lines must not freeze total_usd=0", () => {
    // Regression: /calc/cotizar/pdf used to store resumen+request without bom,
    // extractLines=[] → snapshot.total_usd=0 → coalesce wiped real quote totals.
    const payload = {
      lista: "venta",
      resumen: { total_usd: 5123.45, subtotal_usd: 4200 },
      request: { escenario: "solo_techo", lista: "venta" },
    };
    assert.deepEqual(extractLines(payload), []);
    assert.equal(pickClientTotal(payload), 5123.45);
    const { snapshot } = buildBmcSnapshot(payload, { catalog: {} });
    assert.equal(snapshot.lines.length, 0);
    assert.equal(snapshot.total_usd, null);
    assert.equal(snapshot.incomplete, true);
    assert.equal(snapshot.client_total_usd, 5123.45);
  });

  it("extracts nested gpt bom groups and prices from LISTA_ACTIVA", () => {
    const live = buildListaActivaCatalog("venta");
    assert.ok(live["ISODEC_EPS-100"] > 0);
    const payload = {
      lista: "venta",
      resumen: { total_usd: 1 },
      bom: [
        {
          grupo: "PANELES",
          items: [
            { descripcion: "ISODEC EPS 100mm", sku: "ISODEC_EPS-100", cant: 10, pu_usd: 1, total_usd: 10 },
          ],
        },
      ],
    };
    const lines = extractLines(payload);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].sku, "ISODEC_EPS-100");
    assert.equal(lines[0].qty, 10);
    const { snapshot } = buildBmcSnapshot(payload);
    assert.equal(snapshot.incomplete, false);
    assert.equal(snapshot.lines[0].source, "LISTA_ACTIVA");
    assert.equal(snapshot.lines[0].unit_price_server, live["ISODEC_EPS-100"]);
    assert.ok(snapshot.total_usd > 100);
    assert.notEqual(snapshot.total_usd, 1);
    assert.equal(snapshot.price_drift, true);
  });
});
