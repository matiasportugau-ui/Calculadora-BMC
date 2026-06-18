#!/usr/bin/env node
/**
 * BMC API Authorization Health Check
 *
 * Diagnostica el estado de autorización de todas las conexiones de API del proyecto.
 * Detecta la causa raíz de errores de auth (Panelin, calc, CRM, AI providers, etc.).
 *
 * Modos:
 *   node scripts/check-api-auth.js              → solo env audit (sin servidor)
 *   node scripts/check-api-auth.js --live        → env + live endpoint checks (:3001)
 *   BMC_API_BASE=http://... node scripts/check-api-auth.js --live → custom base
 *
 * Salida: 0 = todo OK, 1 = fallos críticos
 */

import "dotenv/config";
import { readFileSync, existsSync } from "fs";

const args = process.argv.slice(2);
const LIVE = args.includes("--live") || Boolean(process.env.BMC_API_BASE);
const BASE = process.env.BMC_API_BASE || "http://localhost:3001";
const API_TOKEN = process.env.API_AUTH_TOKEN || process.env.API_KEY || "";

// ──────────────────────────────────────────────────────────────────────────────
// Counters
// ──────────────────────────────────────────────────────────────────────────────
let totalPass = 0;
let totalFail = 0;
let totalWarn = 0;
const criticalIssues = [];

function pass(label) {
  console.log(`  ✅ ${label}`);
  totalPass++;
}
function fail(label, reason, fix) {
  console.log(`  ❌ ${label}`);
  console.log(`     → ${reason}`);
  if (fix) console.log(`     💡 FIX: ${fix}`);
  totalFail++;
  criticalIssues.push({ label, reason, fix });
}
function warn(label, reason) {
  console.log(`  ⚠️  ${label}`);
  if (reason) console.log(`     → ${reason}`);
  totalWarn++;
}
function info(label) {
  console.log(`  ℹ️  ${label}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. ENV VAR AUDIT
// ──────────────────────────────────────────────────────────────────────────────
function auditEnv() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║            1. ENV VAR AUDIT                         ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  // API_AUTH_TOKEN — causa raíz más común de errores Panelin/calc
  const apiToken = process.env.API_AUTH_TOKEN || process.env.API_KEY || "";
  if (!apiToken) {
    fail(
      "API_AUTH_TOKEN",
      "No configurado — CAUSA RAÍZ MÁS PROBABLE del error de Panelin",
      "Agregar en .env: API_AUTH_TOKEN=<secreto-32+-chars>  (cualquier string largo)"
    );
  } else if (apiToken.length < 16) {
    warn("API_AUTH_TOKEN", `Muy corto (${apiToken.length} chars) — recomendado ≥32`);
  } else {
    pass(`API_AUTH_TOKEN (${apiToken.length} chars)`);
  }

  // IDENTITY_JWT_SECRET
  const jwtSecret = process.env.IDENTITY_JWT_SECRET || "";
  if (!jwtSecret || jwtSecret === "replace-me-with-openssl-rand-base64-48-output") {
    fail(
      "IDENTITY_JWT_SECRET",
      "No configurado o valor default — rutas /auth/* devolverán 500",
      "Generar con: openssl rand -base64 48  y agregar al .env"
    );
  } else if (jwtSecret.length < 32) {
    fail(
      "IDENTITY_JWT_SECRET",
      `Muy corto (${jwtSecret.length} chars) — requiere ≥32`,
      "Regenerar con: openssl rand -base64 48"
    );
  } else {
    pass(`IDENTITY_JWT_SECRET (${jwtSecret.length} chars)`);
  }

  // WA_JWT_SECRET — debe existir y ser distinto de IDENTITY_JWT_SECRET
  const waSecret = process.env.WA_JWT_SECRET || "";
  if (!waSecret || waSecret === "change-me-please-32-chars-minimum") {
    fail(
      "WA_JWT_SECRET",
      "No configurado o valor default — sesiones de operador WA fallarán",
      "Generar con: openssl rand -base64 48  (distinto de IDENTITY_JWT_SECRET)"
    );
  } else if (waSecret === jwtSecret) {
    fail(
      "WA_JWT_SECRET",
      "Igual a IDENTITY_JWT_SECRET — el servidor rechaza esto (cross-system token substitution guard)",
      "Generar un WA_JWT_SECRET distinto: openssl rand -base64 48"
    );
  } else if (waSecret.length < 32) {
    warn("WA_JWT_SECRET", `Corto (${waSecret.length} chars) — recomendado ≥32`);
  } else {
    pass(`WA_JWT_SECRET (${waSecret.length} chars, distinto de IDENTITY_JWT_SECRET)`);
  }

  // DATABASE_URL
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl) {
    warn(
      "DATABASE_URL",
      "No configurado — rutas de identity auth, Transportista, WA Cockpit, TraKtiMe y RAG no funcionarán"
    );
  } else if (!dbUrl.startsWith("postgres")) {
    warn("DATABASE_URL", `Formato inesperado: "${dbUrl.slice(0, 20)}..."`);
  } else {
    pass("DATABASE_URL (formato postgres)");
  }

  // AI Providers
  const anthropic = process.env.ANTHROPIC_API_KEY || "";
  if (!anthropic) {
    warn("ANTHROPIC_API_KEY", "No configurado — Panelin chat usará fallback OpenAI/Gemini");
  } else if (!anthropic.startsWith("sk-ant")) {
    warn("ANTHROPIC_API_KEY", "Formato inesperado (debería empezar con sk-ant-)");
  } else {
    pass("ANTHROPIC_API_KEY");
  }

  const openai = process.env.OPENAI_API_KEY || "";
  if (!openai) {
    warn("OPENAI_API_KEY", "No configurado — sin fallback OpenAI para Panelin chat");
  } else if (!openai.startsWith("sk-")) {
    warn("OPENAI_API_KEY", "Formato inesperado (debería empezar con sk-)");
  } else {
    pass("OPENAI_API_KEY");
  }

  // Google credentials (Sheets/Drive)
  const gcreds = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!gcreds) {
    warn(
      "GOOGLE_APPLICATION_CREDENTIALS",
      "No configurado — CRM/Finanzas/Sheets no funcionarán"
    );
  } else if (!existsSync(gcreds)) {
    fail(
      "GOOGLE_APPLICATION_CREDENTIALS",
      `Archivo no encontrado: ${gcreds}`,
      "Verificar que el path al service account JSON sea correcto"
    );
  } else {
    try {
      const raw = readFileSync(gcreds, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.type !== "service_account") {
        warn("GOOGLE_APPLICATION_CREDENTIALS", "El JSON no es un service_account");
      } else {
        pass(`GOOGLE_APPLICATION_CREDENTIALS (service_account: ${parsed.client_email?.split("@")[0] || "?"})`);
      }
    } catch {
      fail(
        "GOOGLE_APPLICATION_CREDENTIALS",
        "El archivo existe pero no es JSON válido",
        "Verificar que el service account JSON no esté corrupto"
      );
    }
  }

  // PANELIN_RELAX_DEV_AUTH — solo informativo
  const relaxDevAuth = process.env.PANELIN_RELAX_DEV_AUTH;
  if (relaxDevAuth === "1" || relaxDevAuth === "true") {
    warn(
      "PANELIN_RELAX_DEV_AUTH",
      "Activo — el check de Bearer token en devMode está BYPASEADO (solo usar en dev local)"
    );
  } else {
    info("PANELIN_RELAX_DEV_AUTH no activo (comportamiento seguro, requiere token real en devMode)");
  }

  // BUDGET_ENABLED
  const budget = process.env.BUDGET_ENABLED;
  if (budget === "true" || budget === "1") {
    info("BUDGET_ENABLED activo — Panelin chat tiene límite de turnos/tokens por IP");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// HTTP helper
// ──────────────────────────────────────────────────────────────────────────────
async function req(path, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal, ...opts });
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else if (ct.includes("text/event-stream")) {
      // Read first line only
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (const line of buf.split("\n")) {
          if (line.startsWith("data: ")) {
            try { data = JSON.parse(line.slice(6)); } catch { data = line.slice(6); }
            break outer;
          }
        }
      }
      reader.cancel().catch(() => {});
    } else {
      data = await res.text().catch(() => null);
    }
    return { status: res.status, headers: res.headers, data };
  } finally {
    clearTimeout(timeout);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. PUBLIC ENDPOINTS
// ──────────────────────────────────────────────────────────────────────────────
async function checkPublicEndpoints() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║            2. PUBLIC ENDPOINTS                      ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  // /health
  try {
    const { status, data } = await req("/health");
    if (status === 200 && data?.ok) {
      pass(`GET /health → ok:true (hasSheets:${data.hasSheets}, hasTokens:${data.hasTokens})`);
      if (!data.hasSheets) warn("  /health.hasSheets=false", "Google Sheets no conectado");
      if (!data.hasTokens) warn("  /health.hasTokens=false", "OAuth tokens (ML) no configurados");
    } else {
      fail("GET /health", `HTTP ${status} / ok=${data?.ok}`, "Verificar que el servidor esté corriendo en " + BASE);
    }
  } catch (e) {
    fail("GET /health", e.name === "AbortError" ? "Timeout 8s" : e.message, `¿Está el servidor corriendo? npm run start:api (${BASE})`);
  }

  // /capabilities
  try {
    const { status, data } = await req("/capabilities");
    if (status === 200 && data?.ok) {
      pass("GET /capabilities → ok:true");
    } else {
      fail("GET /capabilities", `HTTP ${status}`, null);
    }
  } catch (e) {
    fail("GET /capabilities", e.message, null);
  }

  // /version
  try {
    const { status, data } = await req("/version");
    if (status === 200 && data?.version) {
      pass(`GET /version → ${data.version}`);
    } else {
      warn("GET /version", `HTTP ${status}`);
    }
  } catch (e) {
    warn("GET /version", e.message);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. PANELIN CHAT & AUTH — FOCO DEL BUG REPORTADO
// ──────────────────────────────────────────────────────────────────────────────
async function checkPanelinAuth() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║            3. PANELIN CHAT / AUTH  ← bug reportado  ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  const CHAT = "/api/agent/chat";

  // 3a — Chat público (sin devMode) debe funcionar sin token
  try {
    const { status, headers } = await req(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hola" }] }),
    });
    if (status === 200 && headers.get("content-type")?.includes("text/event-stream")) {
      pass("POST /api/agent/chat (público, sin token) → 200 + SSE");
    } else if (status === 429) {
      warn("POST /api/agent/chat (público)", "429 rate limit — servidor vivo pero saturado");
    } else if (status === 200) {
      warn("POST /api/agent/chat (público)", `200 pero content-type inesperado: ${headers.get("content-type")}`);
    } else {
      fail(
        "POST /api/agent/chat (público sin token)",
        `HTTP ${status} — el endpoint público no debería requerir auth`,
        "Revisar server/routes/agentChat.js — la ruta pública no debe tener requireAuth"
      );
    }
  } catch (e) {
    fail("POST /api/agent/chat (público)", e.message, null);
  }

  // 3b — devMode SIN token → debe rechazar con 401 o 503
  try {
    const { status, data } = await req(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "test devmode no auth" }],
        devMode: true,
      }),
    });
    if (status === 401 && data?.error?.includes("Unauthorized developer mode")) {
      pass("POST /api/agent/chat (devMode sin token) → 401 Unauthorized (comportamiento correcto)");
    } else if (status === 503 && data?.error?.includes("API_AUTH_TOKEN")) {
      fail(
        "POST /api/agent/chat (devMode sin token) → 503 API_AUTH_TOKEN no configurado",
        "API_AUTH_TOKEN no está en .env — CAUSA RAÍZ del error de Panelin",
        "Agregar API_AUTH_TOKEN en .env y reiniciar el servidor"
      );
    } else if (status === 200) {
      warn(
        "POST /api/agent/chat (devMode sin token)",
        "200 sin token — PANELIN_RELAX_DEV_AUTH está activo (bypass de seguridad en dev)"
      );
    } else {
      warn("POST /api/agent/chat (devMode sin token)", `HTTP ${status}: ${JSON.stringify(data)?.slice(0, 120)}`);
    }
  } catch (e) {
    fail("POST /api/agent/chat (devMode sin token)", e.message, null);
  }

  // 3c — devMode CON token correcto → debe funcionar
  if (API_TOKEN) {
    try {
      const { status, headers } = await req(CHAT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "test devmode con auth" }],
          devMode: true,
        }),
      });
      if (status === 200 && headers.get("content-type")?.includes("text/event-stream")) {
        pass("POST /api/agent/chat (devMode + Bearer token) → 200 + SSE ✓");
      } else if (status === 401) {
        fail(
          "POST /api/agent/chat (devMode + Bearer token)",
          "401 — el token no coincide con API_AUTH_TOKEN del servidor",
          "Verificar que el API_AUTH_TOKEN en .env del servidor coincida con el que usa el frontend"
        );
      } else if (status === 503) {
        fail(
          "POST /api/agent/chat (devMode + Bearer token)",
          "503 — API_AUTH_TOKEN no configurado en el servidor",
          "Reiniciar el servidor después de agregar API_AUTH_TOKEN en .env"
        );
      } else {
        warn("POST /api/agent/chat (devMode + Bearer token)", `HTTP ${status}`);
      }
    } catch (e) {
      fail("POST /api/agent/chat (devMode + Bearer token)", e.message, null);
    }
  } else {
    warn(
      "POST /api/agent/chat (devMode + Bearer token)",
      "SKIP — API_AUTH_TOKEN no configurado en este entorno (no puede probar auth válida)"
    );
  }

  // 3d — /api/panelin/* requiere API_AUTH_TOKEN
  try {
    const { status, data } = await req("/api/panelin/health", {
      method: "GET",
      ...(API_TOKEN ? { headers: { Authorization: `Bearer ${API_TOKEN}` } } : {}),
    });
    if (status === 200) {
      pass("GET /api/panelin/health → 200" + (API_TOKEN ? " (con token)" : ""));
    } else if (status === 404) {
      warn(
        "GET /api/panelin/health → 404",
        "La ruta existe en server/routes/panelin.js pero devuelve 404 — posible problema de montaje o API desactualizada"
      );
    } else if (status === 401 || status === 503) {
      if (!API_TOKEN) {
        warn(
          "GET /api/panelin/* (sin token)",
          `HTTP ${status} esperado — la ruta requiere API_AUTH_TOKEN`
        );
      } else {
        fail(
          "GET /api/panelin/* (con token)",
          `HTTP ${status}: ${JSON.stringify(data)?.slice(0, 120)}`,
          "Verificar que API_AUTH_TOKEN coincida en .env y en el servidor"
        );
      }
    } else {
      warn("GET /api/panelin/health", `HTTP ${status}: ${JSON.stringify(data)?.slice(0, 80)}`);
    }
  } catch (e) {
    warn("GET /api/panelin/health", e.message);
  }

  // 3e — /api/agent/stats (requiere token)
  if (API_TOKEN) {
    try {
      const { status, data } = await req("/api/agent/stats", {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      if (status === 200 && data?.ok) {
        pass(`GET /api/agent/stats → ok:true (${data.conversations} conversaciones)`);
      } else if (status === 503 && data?.error?.includes("API_AUTH_TOKEN")) {
        fail(
          "GET /api/agent/stats",
          "503 API_AUTH_TOKEN no configurado en el servidor",
          "Reiniciar servidor con API_AUTH_TOKEN en .env"
        );
      } else {
        fail("GET /api/agent/stats", `HTTP ${status}: ${JSON.stringify(data)?.slice(0, 100)}`, null);
      }
    } catch (e) {
      fail("GET /api/agent/stats", e.message, null);
    }
  } else {
    warn("GET /api/agent/stats", "SKIP — API_AUTH_TOKEN no configurado");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. CALC ENDPOINTS
// ──────────────────────────────────────────────────────────────────────────────
async function checkCalcEndpoints() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║            4. CALC ENDPOINTS                        ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  // /calc/cotizar requiere API_AUTH_TOKEN
  const body = {
    escenario: "solo_techo",
    lista: "web",
    techo: { familia: "ISODEC_EPS", espesor: 100, largo: 6, ancho: 5, color: "Blanco" },
  };
  try {
    const { status, data } = await req("/calc/cotizar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (status === 200 && data?.ok) {
      pass("POST /calc/cotizar → ok:true (calc engine vivo)");
    } else if (status === 401 || status === 503) {
      if (!API_TOKEN) {
        fail(
          "POST /calc/cotizar (sin token)",
          `HTTP ${status} — /calc/* requiere API_AUTH_TOKEN`,
          "Configurar API_AUTH_TOKEN en .env y reiniciar servidor"
        );
      } else {
        fail(
          "POST /calc/cotizar (con token)",
          `HTTP ${status}: ${JSON.stringify(data)?.slice(0, 100)}`,
          "Verificar que API_AUTH_TOKEN del .env coincida con el del servidor"
        );
      }
    } else {
      warn("POST /calc/cotizar", `HTTP ${status}: ${JSON.stringify(data)?.slice(0, 100)}`);
    }
  } catch (e) {
    fail("POST /calc/cotizar", e.message, null);
  }

  // MATRIZ CSV — endpoint público crítico
  try {
    const { status, data } = await req("/api/actualizar-precios-calculadora");
    if (status === 200 && typeof data === "string" && data.includes("path")) {
      const lines = data.split("\n").length;
      pass(`GET /api/actualizar-precios-calculadora → CSV ok (${lines} líneas)`);
    } else if (status === 503) {
      warn("GET /api/actualizar-precios-calculadora", "503 — Google Sheets no disponible");
    } else {
      fail(
        "GET /api/actualizar-precios-calculadora",
        `HTTP ${status} — MATRIZ de precios no disponible`,
        "Verificar GOOGLE_APPLICATION_CREDENTIALS y BMC_MATRIZ_SHEET_ID en .env"
      );
    }
  } catch (e) {
    fail("GET /api/actualizar-precios-calculadora", e.message, null);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. IDENTITY / AUTH ROUTES
// ──────────────────────────────────────────────────────────────────────────────
async function checkIdentityRoutes() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║            5. IDENTITY / AUTH ROUTES                ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  // /api/auth/me sin token → debe ser 401 missing_credentials (NO 500)
  try {
    const { status, data } = await req("/api/auth/me");
    if (status === 401 && data?.error === "missing_credentials") {
      pass("GET /api/auth/me (sin token) → 401 missing_credentials (identity auth operativo)");
    } else if (status === 500) {
      fail(
        "GET /api/auth/me → 500",
        `Error interno: ${data?.error || JSON.stringify(data)?.slice(0, 120)}`,
        "Verificar IDENTITY_JWT_SECRET (≥32 chars, distinto de WA_JWT_SECRET) y DATABASE_URL en .env"
      );
    } else if (status === 503) {
      fail(
        "GET /api/auth/me → 503",
        "Base de datos no disponible",
        "Verificar DATABASE_URL en .env — identity auth requiere PostgreSQL"
      );
    } else {
      warn("GET /api/auth/me (sin token)", `HTTP ${status}: ${JSON.stringify(data)?.slice(0, 100)}`);
    }
  } catch (e) {
    fail("GET /api/auth/me", e.message, null);
  }

  // /api/auth/refresh sin cookie → 401
  try {
    const { status, data } = await req("/api/auth/refresh", { method: "POST" });
    if (status === 401) {
      pass("POST /api/auth/refresh (sin cookie) → 401 (correcto)");
    } else if (status === 500) {
      fail(
        "POST /api/auth/refresh → 500",
        `Error: ${data?.error || JSON.stringify(data)?.slice(0, 100)}`,
        "Verificar IDENTITY_JWT_SECRET y DATABASE_URL"
      );
    } else {
      warn("POST /api/auth/refresh (sin cookie)", `HTTP ${status}: ${JSON.stringify(data)?.slice(0, 80)}`);
    }
  } catch (e) {
    fail("POST /api/auth/refresh", e.message, null);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. CRM / DASHBOARD ENDPOINTS
// ──────────────────────────────────────────────────────────────────────────────
async function checkCrmEndpoints() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║            6. CRM / DASHBOARD ENDPOINTS             ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  // suggest-response — AI health check
  try {
    const { status, data } = await req("/api/crm/suggest-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consulta: "Necesito un presupuesto para techo" }),
    });
    if (status === 200 && data?.ok) {
      pass(`POST /api/crm/suggest-response → ok:true (provider: ${data.provider || "?"})`);
    } else if (status === 503) {
      warn("POST /api/crm/suggest-response", "503 — AI providers no configurados (falta ANTHROPIC_API_KEY / OPENAI_API_KEY)");
    } else {
      warn("POST /api/crm/suggest-response", `HTTP ${status}: ${JSON.stringify(data)?.slice(0, 100)}`);
    }
  } catch (e) {
    warn("POST /api/crm/suggest-response", e.message);
  }

  // CRM queue — requiere token
  if (API_TOKEN) {
    try {
      const { status, data } = await req("/api/crm/cockpit/ml-queue", {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      if (status === 200 && data?.ok) {
        pass(`GET /api/crm/cockpit/ml-queue → ok:true (${(data.items || []).length} items)`);
      } else if (status === 503) {
        warn("GET /api/crm/cockpit/ml-queue", "503 — Google Sheets no disponible");
      } else if (status === 401) {
        fail(
          "GET /api/crm/cockpit/ml-queue (con token)",
          "401 — token no autorizado",
          "Verificar que API_AUTH_TOKEN en .env coincida con el del servidor"
        );
      } else {
        warn("GET /api/crm/cockpit/ml-queue", `HTTP ${status}`);
      }
    } catch (e) {
      warn("GET /api/crm/cockpit/ml-queue", e.message);
    }
  } else {
    warn("GET /api/crm/cockpit/ml-queue", "SKIP — API_AUTH_TOKEN no configurado");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 7. WHATSAPP / WEBHOOKS
// ──────────────────────────────────────────────────────────────────────────────
async function checkWebhooks() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║            7. WHATSAPP / WEBHOOKS                   ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  // WA health
  try {
    const { status, data } = await req("/api/wa/health");
    if (status === 200) {
      pass("GET /api/wa/health → 200");
    } else if (status === 503) {
      warn("GET /api/wa/health", "503 — WA Cockpit no conectado (DATABASE_URL o config WA faltante)");
    } else {
      warn("GET /api/wa/health", `HTTP ${status}`);
    }
  } catch (e) {
    warn("GET /api/wa/health", e.message);
  }

  // Webhook endpoint liveness
  try {
    const { status } = await req("/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test");
    if (status === 200 || status === 403) {
      pass(`GET /webhooks/whatsapp → ${status} (endpoint activo)`);
    } else {
      warn("GET /webhooks/whatsapp", `HTTP ${status}`);
    }
  } catch (e) {
    warn("GET /webhooks/whatsapp", e.message);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 8. ML AUTO-MODE
// ──────────────────────────────────────────────────────────────────────────────
async function checkMlEndpoints() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║            8. ML AUTO-MODE                          ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  try {
    const { status, data } = await req("/api/ml/auto-mode");
    if (status === 200 && data?.ok) {
      pass(`GET /api/ml/auto-mode → ok:true (fullAuto: ${data.autoMode?.fullAuto})`);
    } else {
      warn("GET /api/ml/auto-mode", `HTTP ${status}`);
    }
  } catch (e) {
    warn("GET /api/ml/auto-mode", e.message);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────────────────────────────────────
function printSummary() {
  const total = totalPass + totalFail + totalWarn;
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║               RESUMEN FINAL                         ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  ✅ PASS  ${String(totalPass).padEnd(3)}   ⚠️  WARN  ${String(totalWarn).padEnd(3)}   ❌ FAIL  ${String(totalFail).padEnd(3)}        ║`);
  console.log("╚══════════════════════════════════════════════════════╝");

  if (criticalIssues.length > 0) {
    console.log("\n❌ FALLOS CRÍTICOS:");
    for (const { label, reason, fix } of criticalIssues) {
      console.log(`\n  • ${label}`);
      console.log(`    Causa: ${reason}`);
      if (fix) console.log(`    Fix:   ${fix}`);
    }
  }

  if (totalFail === 0 && totalWarn === 0) {
    console.log("\n🎉 Todo OK — todas las conexiones de API están bien configuradas.\n");
  } else if (totalFail === 0) {
    console.log("\n✅ Sin fallos críticos. Revisar advertencias arriba.\n");
  } else {
    console.log("\n🔴 Hay fallos — revisar las causas y fixes indicados arriba.\n");

    // Quick fix checklist
    const needsApiToken = criticalIssues.some((i) => i.label.includes("API_AUTH_TOKEN") || i.reason.includes("API_AUTH_TOKEN"));
    const needsJwtSecret = criticalIssues.some((i) => i.label.includes("IDENTITY_JWT_SECRET"));
    if (needsApiToken || needsJwtSecret) {
      console.log("⚡ ACCIÓN RÁPIDA — correr estos comandos:");
      if (needsApiToken) {
        console.log("   echo \"API_AUTH_TOKEN=$(openssl rand -base64 32 | tr -d '\\n')\" >> .env");
      }
      if (needsJwtSecret) {
        console.log("   echo \"IDENTITY_JWT_SECRET=$(openssl rand -base64 48 | tr -d '\\n')\" >> .env");
        console.log("   echo \"WA_JWT_SECRET=$(openssl rand -base64 48 | tr -d '\\n')\" >> .env");
      }
      console.log("   npm run start:api   # reiniciar servidor");
      console.log("");
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║     BMC API Authorization Health Check               ║");
  console.log(`║     Base: ${BASE.padEnd(41)}║`);
  console.log(`║     Modo: ${(LIVE ? "LIVE (endpoints activos)" : "ENV ONLY (sin servidor)").padEnd(41)}║`);
  console.log("╚══════════════════════════════════════════════════════╝");

  // Always: env audit
  auditEnv();

  // Live checks only when server is reachable
  if (LIVE) {
    await checkPublicEndpoints();
    await checkPanelinAuth();
    await checkCalcEndpoints();
    await checkIdentityRoutes();
    await checkCrmEndpoints();
    await checkWebhooks();
    await checkMlEndpoints();
  } else {
    console.log("\nℹ️  Para checks de endpoints live, correr:");
    console.log("   npm run check:auth:live   (requiere npm run start:api)");
  }

  printSummary();
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
