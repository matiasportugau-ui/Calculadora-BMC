import test from "node:test";
import assert from "node:assert/strict";
import { WHITELABEL_BRANDS } from "../src/config/whitelabel.js";
import { tenantAccessState, tenantSlugFromHost } from "../src/utils/tenantAccess.js";
import { IDENT_OVERTURE_MS, identOvertureMs, shouldPlayIdentCinema } from "../src/utils/tenantIdentMotion.js";
import { IDENT_STING_SRC, identStingSrc } from "../src/utils/tenantIdentAudio.js";

test("each tenant has a cinematic ident pack", () => {
  assert.equal(WHITELABEL_BRANDS.bc.ident.style, "gold-title");
  assert.equal(WHITELABEL_BRANDS.paneleslam.ident.style, "stack");
  assert.equal(WHITELABEL_BRANDS.smartbuilding.ident.style, "imax-void");
  for (const slug of ["bc", "paneleslam", "smartbuilding"]) {
    const i = WHITELABEL_BRANDS[slug].ident;
    assert.ok(i.bg && i.ink && i.accent);
  }
});

test("tenant calculator is gated until Google; BMC hub is open", () => {
  assert.equal(tenantAccessState({ whitelabel: null, status: "anonymous" }), "open");
  assert.equal(tenantAccessState({ whitelabel: "bc", status: "loading" }), "boot");
  assert.equal(tenantAccessState({ whitelabel: "bc", status: "anonymous" }), "login");
  assert.equal(tenantAccessState({
    whitelabel: "bc", status: "authenticated", member: null, role: "comprador",
  }), "denied");
  assert.equal(tenantAccessState({
    whitelabel: "bc", status: "authenticated", member: { slug: "bc" }, role: "comprador",
  }), "ok");
  assert.equal(tenantAccessState({
    whitelabel: "bc", status: "authenticated", member: null, role: "superadmin",
  }), "ok");
});

test("membership for a different tenant does not unlock this host (closed silo)", () => {
  assert.equal(tenantAccessState({
    whitelabel: "paneleslam",
    status: "authenticated",
    member: { slug: "bc" },
    role: "comprador",
  }), "denied");
  assert.equal(tenantAccessState({
    whitelabel: "smartbuilding",
    status: "authenticated",
    member: { slug: "bc", role: "owner" },
    role: "user",
  }), "denied");
  assert.equal(tenantAccessState({
    whitelabel: "paneleslam",
    status: "authenticated",
    member: { slug: "paneleslam" },
    role: "comprador",
  }), "ok");
  assert.equal(tenantAccessState({
    whitelabel: "BC",
    status: "authenticated",
    member: { slug: "bc" },
    role: "comprador",
  }), "ok");
});

test("glory cinema plays after grant, not for uninvited Gmail", () => {
  assert.equal(shouldPlayIdentCinema({ role: "superadmin", member: null }), true);
  assert.equal(shouldPlayIdentCinema({ role: "admin", member: null }), true);
  assert.equal(shouldPlayIdentCinema({ role: "comprador", member: { slug: "bc" } }), true);
  assert.equal(shouldPlayIdentCinema({ role: "comprador", member: null }), false);
  assert.equal(shouldPlayIdentCinema({ role: "user", member: {} }), false);
});

test("logo lock holds ~2.4s unless reduced motion", () => {
  assert.equal(IDENT_OVERTURE_MS, 2400);
  assert.equal(identOvertureMs(), 2400);
  assert.equal(identOvertureMs(() => ({ matches: true })), 0);
  assert.equal(identOvertureMs(() => ({ matches: false })), 2400);
});

test("each tenant ident has a glory sting", () => {
  assert.equal(identStingSrc("bc"), "/audio/ident/bc-gold-foil.wav");
  assert.equal(identStingSrc("paneleslam"), "/audio/ident/lam-three-planks.wav");
  assert.equal(identStingSrc("smartbuilding"), "/audio/ident/smart-imax-air.wav");
  assert.equal(identStingSrc("nope"), null);
  assert.equal(WHITELABEL_BRANDS.bc.ident.sting, IDENT_STING_SRC.bc);
  assert.equal(WHITELABEL_BRANDS.paneleslam.ident.sting, IDENT_STING_SRC.paneleslam);
  assert.equal(WHITELABEL_BRANDS.smartbuilding.ident.sting, IDENT_STING_SRC.smartbuilding);
});

test("host map keeps tenant silos", () => {
  assert.equal(tenantSlugFromHost("https://calculadora-bc.vercel.app/"), "bc");
  assert.equal(tenantSlugFromHost("calculadora-paneleslam.vercel.app"), "paneleslam");
  assert.equal(tenantSlugFromHost("https://calculadora-smartbuilding.vercel.app"), "smartbuilding");
  assert.equal(tenantSlugFromHost("https://calculadora-bmc.vercel.app"), null);
});
