// ═══════════════════════════════════════════════════════════════════════════
// server/lib/surface.js — canonical surface enum + mapper
// Run: node tests/surface.test.js
//
// Pure unit tests. Includes a regression guard against the legacy regex used
// by bmcDashboard.classifyCrmChannel before migration.
// ═══════════════════════════════════════════════════════════════════════════

import {
  SURFACES,
  normalizeSurface,
  surfaceToChannel,
  channelToDefaultSurface,
} from "../server/lib/surface.js";

let passed = 0;
let failed = 0;

function assert(name, cond, details = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name}${details ? `\n     ${details}` : ""}`);
  failed += 1;
}

// Legacy regex from bmcDashboard.classifyCrmChannel pre-migration. The
// migration must produce the same string output for the same inputs.
function legacyClassifyCrmChannel(parsed) {
  const origen = String(parsed?.origen || "");
  const obs = String(parsed?.observaciones || "");
  if (/Q:\d+/.test(obs) || /ML/i.test(origen) || /MLU?\d/i.test(origen)) return "mercadolibre";
  if (/WA|WhatsApp/i.test(origen)) return "whatsapp";
  if (/instagram|(^|\s)ig(\s|$)|IG-/i.test(origen)) return "instagram";
  if (/facebook|messenger|\bfb\b/i.test(origen)) return "facebook";
  return null;
}

function newClassifyCrmChannel(parsed) {
  const surface = normalizeSurface({
    origen: parsed?.origen,
    observaciones: parsed?.observaciones,
  });
  switch (surface) {
    case SURFACES.MERCADO_LIBRE: return "mercadolibre";
    case SURFACES.WHATSAPP:      return "whatsapp";
    case SURFACES.INSTAGRAM:     return "instagram";
    case SURFACES.FACEBOOK:      return "facebook";
    default:                     return null;
  }
}

function run() {
  console.log("\n═══ server/lib/surface.js — enum + mapper ═══\n");

  // ── normalizeSurface (string forms) ────────────────────────────────────
  assert("string 'ml' → mercado_libre",
    normalizeSurface("ml") === SURFACES.MERCADO_LIBRE);
  assert("string 'mercadolibre' → mercado_libre",
    normalizeSurface("mercadolibre") === SURFACES.MERCADO_LIBRE);
  assert("string 'MercadoLibre' → mercado_libre (case insensitive)",
    normalizeSurface("MercadoLibre") === SURFACES.MERCADO_LIBRE);
  assert("string 'mercado_libre' canonical → mercado_libre",
    normalizeSurface("mercado_libre") === SURFACES.MERCADO_LIBRE);
  assert("string 'mercado-libre' → mercado_libre (separator normalize)",
    normalizeSurface("mercado-libre") === SURFACES.MERCADO_LIBRE);
  assert("string 'wa' → whatsapp",
    normalizeSurface("wa") === SURFACES.WHATSAPP);
  assert("string 'whatsapp' → whatsapp",
    normalizeSurface("whatsapp") === SURFACES.WHATSAPP);
  assert("string 'wsp' → whatsapp",
    normalizeSurface("wsp") === SURFACES.WHATSAPP);
  assert("string 'ig' → instagram",
    normalizeSurface("ig") === SURFACES.INSTAGRAM);
  assert("string 'instagram' → instagram",
    normalizeSurface("instagram") === SURFACES.INSTAGRAM);
  assert("string 'fb' → facebook",
    normalizeSurface("fb") === SURFACES.FACEBOOK);
  assert("string 'messenger' → facebook",
    normalizeSurface("messenger") === SURFACES.FACEBOOK);
  assert("string 'chat' → panelin_chat",
    normalizeSurface("chat") === SURFACES.PANELIN_CHAT);
  assert("string 'panelin' → panelin_chat",
    normalizeSurface("panelin") === SURFACES.PANELIN_CHAT);
  assert("string 'email' → email",
    normalizeSurface("email") === SURFACES.EMAIL);
  assert("string 'mail' → email",
    normalizeSurface("mail") === SURFACES.EMAIL);

  // ── normalizeSurface (object forms) ────────────────────────────────────
  assert("origen:'MLU8472901' → mercado_libre",
    normalizeSurface({ origen: "MLU8472901" }) === SURFACES.MERCADO_LIBRE);
  assert("observaciones with 'Q:123' → mercado_libre",
    normalizeSurface({ observaciones: "synced from ML, Q:9182734" }) === SURFACES.MERCADO_LIBRE);
  assert("origen:'WhatsApp' → whatsapp",
    normalizeSurface({ origen: "WhatsApp" }) === SURFACES.WHATSAPP);
  assert("origen:'Instagram DM' → instagram",
    normalizeSurface({ origen: "Instagram DM" }) === SURFACES.INSTAGRAM);
  assert("origen:'Facebook Messenger' → facebook",
    normalizeSurface({ origen: "Facebook Messenger" }) === SURFACES.FACEBOOK);
  assert("channel:'ml' → mercado_libre",
    normalizeSurface({ channel: "ml" }) === SURFACES.MERCADO_LIBRE);
  assert("channel:'wa' → whatsapp",
    normalizeSurface({ channel: "wa" }) === SURFACES.WHATSAPP);
  assert("surface:'mercado_libre' wins over channel hint",
    normalizeSurface({ surface: "mercado_libre", channel: "wa" }) === SURFACES.MERCADO_LIBRE);

  // ── normalizeSurface (negative cases) ──────────────────────────────────
  assert("null → null", normalizeSurface(null) === null);
  assert("undefined → null", normalizeSurface(undefined) === null);
  assert("empty string → null", normalizeSurface("") === null);
  assert("garbage 'xyz123' → null", normalizeSurface("xyz123") === null);
  assert("empty object → null", normalizeSurface({}) === null);
  assert("object with all empty → null",
    normalizeSurface({ origen: "", observaciones: "" }) === null);

  // ── surfaceToChannel ───────────────────────────────────────────────────
  assert("MERCADO_LIBRE → ml",
    surfaceToChannel(SURFACES.MERCADO_LIBRE) === "ml");
  assert("WHATSAPP → wa",
    surfaceToChannel(SURFACES.WHATSAPP) === "wa");
  assert("INSTAGRAM → wa (shares WA rules)",
    surfaceToChannel(SURFACES.INSTAGRAM) === "wa");
  assert("FACEBOOK → wa (shares WA rules)",
    surfaceToChannel(SURFACES.FACEBOOK) === "wa");
  assert("EMAIL → chat (rides chat rules until dedicated email channel)",
    surfaceToChannel(SURFACES.EMAIL) === "chat");
  assert("PANELIN_CHAT → chat",
    surfaceToChannel(SURFACES.PANELIN_CHAT) === "chat");
  assert("null surface → chat (safe fallback)",
    surfaceToChannel(null) === "chat");

  // ── channelToDefaultSurface ────────────────────────────────────────────
  assert("ml → MERCADO_LIBRE",
    channelToDefaultSurface("ml") === SURFACES.MERCADO_LIBRE);
  assert("wa → WHATSAPP",
    channelToDefaultSurface("wa") === SURFACES.WHATSAPP);
  assert("chat → PANELIN_CHAT",
    channelToDefaultSurface("chat") === SURFACES.PANELIN_CHAT);

  // ── Regression guard: classifyCrmChannel migration is behavior-preserving
  const regressionFixtures = [
    { origen: "MLU8472901", observaciones: "" },
    { origen: "ML", observaciones: "Q:9182734" },
    { origen: "Q:123 sync", observaciones: "Q:123 from ml-crm-sync" },
    { origen: "WhatsApp", observaciones: "" },
    { origen: "WA outbound", observaciones: "" },
    { origen: "Instagram DM", observaciones: "" },
    { origen: "Facebook Messenger", observaciones: "" },
    { origen: "fb messenger", observaciones: "" },
    { origen: "", observaciones: "" },
    { origen: "Unknown source", observaciones: "" },
  ];
  for (const fx of regressionFixtures) {
    const legacy = legacyClassifyCrmChannel(fx);
    const next = newClassifyCrmChannel(fx);
    assert(
      `classifyCrmChannel preserves legacy output for ${JSON.stringify(fx).slice(0, 60)}`,
      legacy === next,
      `legacy=${legacy} new=${next}`,
    );
  }

  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
  if (failed > 0) process.exit(1);
}

run();
