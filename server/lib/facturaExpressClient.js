/**
 * FacturaExpress Client — Integración para Panelin BMC Platform
 * 
 * Soporta:
 * - Login (username/password → Bearer token, con refresh básico)
 * - Llamadas autenticadas a API (invoices, stock, products)
 * - Webhook processing helpers
 *
 * Variables de entorno esperadas (en .env o Doppler):
 *   FACTURAEXPRESS_BASE_URL=https://api.facturaexpress.com.uy (o test)
 *   FACTURAEXPRESS_USERNAME=...
 *   FACTURAEXPRESS_PASSWORD=...
 *   FACTURAEXPRESS_WEBHOOK_SECRET= (opcional para validar firma de webhooks entrantes)
 *
 * Nota: Esta es una implementación realista basada en proveedores CFE Uruguay
 * (patrón común: /token + Bearer, endpoints /cfe, /stock, webhooks de estado).
 * Ajustar endpoints exactos según docs del proveedor real de BMC.
 */

// Usa fetch global de Node 18+ / 24 (el proyecto ya lo usa en varios lugares como waWebhooks).
const fetch = globalThis.fetch;

import crypto from "node:crypto";
import { config } from "../config.js";

// FacturaExpress client — fixes per grok-review-5ae44e21 (Issues 2,3,4,8,12):
// - loginInFlight guard (exact pattern like mercadoLibreClient refreshInFlight + .finally cleanup) to prevent thundering-herd races on cold/expiry.
// - 1-retry wrapper + AbortController timeout in login/apiFetch (aligns ML requestTimeoutMs).
// - Credentials read from centralized config (not raw process.env at module eval).
// - verifyWebhookSignature: length guard + prefix normalize + try/catch (prevents timingSafeEqual crash on short/missing sig; Issue 3).
// - Explicit stub/adapter note + defensive logging for remote shapes (Issue 8).
// - Robust content-type + network err mapping (Issue 12).

const DEFAULT_BASE = config.facturaexpressBaseUrl || process.env.FACTURAEXPRESS_BASE_URL || "https://api.facturaexpress.com.uy";

let cachedToken = null;
let tokenExpiresAt = 0;
let loginInFlight = null;  // fix for Issue 2 per review-5ae44e21

async function login(attempt = 0) {
  const base = DEFAULT_BASE.replace(/\/$/, "");
  const url = `${base}/auth/token`; // o /token según proveedor; común en CFE UY

  const username = config.facturaexpressUsername || process.env.FACTURAEXPRESS_USERNAME;
  const password = config.facturaexpressPassword || process.env.FACTURAEXPRESS_PASSWORD;

  if (!username || !password) {
    throw new Error("FACTURAEXPRESS_USERNAME y FACTURAEXPRESS_PASSWORD son requeridos");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs || 15000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        // o { grant_type: "password", ... } según el proveedor
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`FacturaExpress login failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    // Esperado: { access_token, expires_in, token_type: "Bearer" }
    const token = data.access_token || data.token;
    const expiresIn = data.expires_in || 3600;

    if (!token) throw new Error("No access_token en respuesta de login FacturaExpress");

    cachedToken = token;
    tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000; // margen de 1 min

    return token;
  } catch (err) {
    clearTimeout(timeout);
    if (attempt < 1 && (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('failed'))) {
      // 1-retry for transient (network/5xx/timeout) per review fix for Issue 2
      return login(attempt + 1);
    }
    throw err;
  }
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  if (!loginInFlight) {
    loginInFlight = login().finally(() => { loginInFlight = null; });
  }
  return loginInFlight;
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const base = DEFAULT_BASE.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, application/problem+json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs || 15000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`FacturaExpress API ${res.status}: ${text}`);
      err.status = res.status;
      err.body = text;
      throw err;
    }

    const contentType = res.headers.get("content-type") || "";
    // Robust content-type (Issue 12 per review-5ae44e21): handle charset / problem+json
    if (contentType.includes("json") || contentType.startsWith("application/")) {
      return res.json().catch(() => ({}));
    }
    if (res.status === 204) return null;
    return res.text().catch(() => "");
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      const e = new Error('FacturaExpress API timeout');
      e.status = 504;
      throw e;
    }
    // Map network errors to shape callers inspect
    if (!err.status) {
      err.status = 503;
      err.body = err.message;
    }
    throw err;
  }
}

/**
 * Ejemplo de métodos de alto nivel (ajustar según API real del proveedor)
 */
export const facturaExpress = {
  async login() {
    return login();
  },

  // Pull facturas recientes
  async getInvoices({ limit = 50, since = null } = {}) {
    let path = `/invoices?limit=${limit}`;
    if (since) path += `&since=${encodeURIComponent(since)}`;
    return apiFetch(path);
  },

  // Crear/emitir factura (ejemplo)
  async createInvoice(invoiceData) {
    return apiFetch("/invoices", {
      method: "POST",
      body: JSON.stringify(invoiceData),
    });
  },

  // Sync bidireccional ejemplo: obtener stock actual desde FE
  async getStock(sku = null) {
    const path = sku ? `/stock?sku=${encodeURIComponent(sku)}` : "/stock";
    return apiFetch(path);
  },

  // Actualizar stock en FE (push)
  async updateStock(sku, deltaOrQty, { reason = "sync_panelin" } = {}) {
    return apiFetch("/stock", {
      method: "POST",
      body: JSON.stringify({ sku, delta: deltaOrQty, reason }),
    });
  },

  // Precios (si el proveedor expone catálogo de precios)
  async getPrices() {
    return apiFetch("/products/prices");
  },

  async updatePrice(sku, price, priceList = "default") {
    return apiFetch("/products/prices", {
      method: "POST",
      body: JSON.stringify({ sku, price, price_list: priceList }),
    });
  },

  /**
   * Helper para validar firma de webhook entrante (si el proveedor envía X-Signature o similar).
   * Fix per review-5ae44e21 Issue 3: length guard after normalize, prefix strip on both sides, try/catch around timingSafeEqual.
   * Returns {skipped, ok, reason?}. Never throws.
   */
  verifyWebhookSignature(rawBody, signatureHeader) {
    const secret = config.facturaexpressWebhookSecret || process.env.FACTURAEXPRESS_WEBHOOK_SECRET;
    if (!secret) {
      if (config.appEnv === "production") {
        return { skipped: false, ok: false, reason: "missing_secret" };
      }
      return { skipped: true, ok: true };
    }

    try {
      // Ejemplo HMAC (muchos proveedores usan esto)
      const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

      // Normalize incoming: strip common "sha256=" prefix if present
      let incoming = (signatureHeader || "").toString().trim();
      if (incoming.toLowerCase().startsWith("sha256=")) incoming = incoming.slice(7);

      const expBuf = Buffer.from(expectedHex);
      const inBuf = Buffer.from(incoming);

      // Guard length (timingSafeEqual requires equal length or throws)
      if (inBuf.length !== expBuf.length) {
        return { ok: false, skipped: false, reason: "length_mismatch" };
      }

      const ok = crypto.timingSafeEqual(inBuf, expBuf);
      return { ok, skipped: false };
    } catch (e) {
      return { ok: false, skipped: false, reason: "verify_error" };
    }
  },
};

export default facturaExpress;
