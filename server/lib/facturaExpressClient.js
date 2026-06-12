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

const DEFAULT_BASE = process.env.FACTURAEXPRESS_BASE_URL || "https://api.facturaexpress.com.uy";

let cachedToken = null;
let tokenExpiresAt = 0;

async function login() {
  const base = DEFAULT_BASE.replace(/\/$/, "");
  const url = `${base}/auth/token`; // o /token según proveedor; común en CFE UY

  const username = process.env.FACTURAEXPRESS_USERNAME;
  const password = process.env.FACTURAEXPRESS_PASSWORD;

  if (!username || !password) {
    throw new Error("FACTURAEXPRESS_USERNAME y FACTURAEXPRESS_PASSWORD son requeridos");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      // o { grant_type: "password", ... } según el proveedor
    }),
  });

  if (!res.ok) {
    const text = await res.text();
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
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  return login();
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const base = DEFAULT_BASE.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`FacturaExpress API ${res.status}: ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
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
   */
  verifyWebhookSignature(rawBody, signatureHeader) {
    const secret = process.env.FACTURAEXPRESS_WEBHOOK_SECRET;
    if (!secret) return { skipped: true, ok: true };

    // Ejemplo HMAC (muchos proveedores usan esto)
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const ok = crypto.timingSafeEqual(Buffer.from(signatureHeader || ""), Buffer.from(expected));
    return { ok, skipped: false };
  },
};

export default facturaExpress;
