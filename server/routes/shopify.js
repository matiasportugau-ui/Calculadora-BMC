/**
 * Shopify Integration v4 – OAuth (PKCE + HMAC), webhooks, admin questions/answers.
 * Replaces Mercado Libre questions flow: webhook → Sheet append, admin list, one-click send.
 */
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { Router } from "express";
import { google } from "googleapis";
import { createShopifyStore } from "../shopifyStore.js";

const SCOPES_SHEETS = ["https://www.googleapis.com/auth/spreadsheets"];
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 600,
  path: "/",
};

const oauthStateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;
function pruneStateStore() {
  const now = Date.now();
  for (const [k, v] of oauthStateStore.entries()) {
    if (now - (v.createdAt || 0) > STATE_TTL_MS) oauthStateStore.delete(k);
  }
}

function pkceChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function buildQueryMap(query) {
  const map = {};
  for (const [k, v] of new URLSearchParams(query)) map[k] = v;
  return map;
}

function hmacQuery(query, secret) {
  const sorted = Object.entries(query)
    .filter(([k]) => k !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return crypto.createHmac("sha256", secret).update(sorted).digest("hex");
}

function verifyShopifyHmacQuery(query, secret, receivedHmac) {
  if (!receivedHmac || !secret) return false;
  const computed = hmacQuery(typeof query === "string" ? Object.fromEntries(new URLSearchParams(query)) : query, secret);
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(receivedHmac, "hex"));
}

function verifyShopifyWebhookHmac(rawBody, secret, receivedHmac) {
  if (!receivedHmac || !secret) return false;
  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(receivedHmac, "utf8"));
}

function validShop(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.myshopify\.com$/.test(String(shop || ""));
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    out[key] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export default function createShopifyRouter(config, logger) {
  const router = Router();
  const {
    shopifyClientId,
    shopifyClientSecret,
    shopifyScopes,
    shopifyWebhookSecret,
    shopifyQuestionsSheetTab,
    bmcSheetId,
    publicBaseUrl,
    tokenEncryptionKey,
  } = config;

  const store = createShopifyStore({
    dataDir: ".shopify-shops",
    encryptionKey: tokenEncryptionKey,
    logger: logger || { warn: () => {}, info: () => {} },
  });

  const redirectUri = () => `${(publicBaseUrl || config.publicBaseUrl || "").replace(/\/$/, "")}/auth/shopify/callback`;

  function requireApiAuth(req, res, next) {
    const token = config.apiAuthToken;
    if (!token) {
      return res.status(503).json({ ok: false, error: "API_AUTH_TOKEN not configured" });
    }
    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
    if (bearer === token || xKey === token) return next();
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  async function shopifyGraphql({ shop, accessToken, query, variables }) {
    const gqlRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!gqlRes.ok) {
      return {
        ok: false,
        status: 502,
        error: "GraphQL request failed",
        details: (await gqlRes.text()).slice(0, 200),
      };
    }
    const json = await gqlRes.json();
    if (json.errors?.length) {
      return {
        ok: false,
        status: 400,
        error: json.errors[0]?.message || "GraphQL error",
      };
    }
    return { ok: true, data: json.data };
  }

  function parsePageSize(value, fallback = 50, max = 250) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(Math.floor(n), max));
  }

  function buildShopifyProductQuery({ status = "active", q = "" }) {
    const queryParts = [];
    const normalizedStatus = String(status || "active").trim().toLowerCase();
    if (normalizedStatus && normalizedStatus !== "all") {
      queryParts.push(`status:${normalizedStatus}`);
    }
    const freeText = String(q || "").trim();
    if (freeText) queryParts.push(freeText);
    return queryParts.join(" ");
  }

  // ——— OAuth: start ———
  router.get("/auth/shopify", asyncHandler(async (req, res) => {
    const shop = (req.query.shop || "").trim().toLowerCase();
    if (!validShop(shop)) {
      return res.status(400).json({ ok: false, error: "Invalid or missing shop (e.g. store.myshopify.com)" });
    }
    if (!shopifyClientId || !shopifyClientSecret) {
      return res.status(503).json({ ok: false, error: "Shopify app not configured" });
    }

    const state = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = pkceChallenge(codeVerifier);

    oauthStateStore.set(state, { shop, codeVerifier, nonce, createdAt: Date.now() });
    pruneStateStore();
    res.cookie("shopify_oauth", state, { ...COOKIE_OPTIONS, maxAge: 600 });

    const shopHost = shop.startsWith("http") ? shop : `https://${shop}`;
    const authUrl = new URL(`${shopHost}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", shopifyClientId);
    authUrl.searchParams.set("scope", shopifyScopes);
    authUrl.searchParams.set("redirect_uri", redirectUri());
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return res.redirect(302, authUrl.toString());
  }));

  // ——— OAuth: callback ———
  router.get("/auth/shopify/callback", asyncHandler(async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const stateFromCookie = cookies.shopify_oauth;
    if (!stateFromCookie) return res.status(400).json({ ok: false, error: "Missing or expired state cookie" });

    const stored = oauthStateStore.get(stateFromCookie);
    oauthStateStore.delete(stateFromCookie);
    if (!stored) return res.status(400).json({ ok: false, error: "Invalid or expired state" });

    const { shop, codeVerifier } = stored;
    const q = buildQueryMap(req.url.split("?")[1] || "");
    if (q.state !== stateFromCookie) return res.status(400).json({ ok: false, error: "State mismatch" });
    if (!validShop(shop)) return res.status(400).json({ ok: false, error: "Invalid shop" });
    if (!verifyShopifyHmacQuery(q, shopifyClientSecret, q.hmac)) {
      return res.status(400).json({ ok: false, error: "HMAC verification failed" });
    }

    res.clearCookie("shopify_oauth", { path: "/" });

    const code = q.code;
    if (!code) return res.status(400).json({ ok: false, error: "Missing code" });

    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const body = new URLSearchParams({
      client_id: shopifyClientId,
      client_secret: shopifyClientSecret,
      code,
      code_verifier: codeVerifier,
    });
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return res.status(502).json({ ok: false, error: "Token exchange failed", details: text.slice(0, 200) });
    }
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return res.status(502).json({ ok: false, error: "No access_token in response" });
    }

    await store.setTokens(shop, {
      access_token: tokens.access_token,
      scope: tokens.scope,
      associated_user: tokens.associated_user || null,
      expires_in: tokens.expires_in || null,
      updated_at: new Date().toISOString(),
    });

    const redirectTo = `${(publicBaseUrl || config.publicBaseUrl || "").replace(/\/$/, "")}/admin/questions?shop=${encodeURIComponent(shop)}`;
    return res.redirect(302, redirectTo);
  }));

  // ——— Webhooks: raw body required; mount with express.raw for this path ———
  router.post("/webhooks/shopify", asyncHandler(async (req, res) => {
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ ok: false, error: "Webhook body must be raw" });
    }
    const hmac = req.headers["x-shopify-hmac-sha256"];
    if (!verifyShopifyWebhookHmac(rawBody, shopifyWebhookSecret, hmac)) {
      return res.status(401).json({ ok: false, error: "HMAC verification failed" });
    }
    const topic = req.headers["x-shopify-topic"] || "";
    const shop = req.headers["x-shopify-shop-domain"] || "";
    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid JSON" });
    }

    // Idempotent: append to Sheet if questions/orders related
    if (bmcSheetId && (topic.includes("orders") || topic.includes("draft_orders") || topic.includes("customers"))) {
      try {
        const auth = new google.auth.GoogleAuth({ scopes: SCOPES_SHEETS });
        const authClient = await auth.getClient();
        const sheets = google.sheets({ version: "v4", auth: authClient });
        const row = [
          new Date().toISOString(),
          shop,
          topic,
          payload.id || "",
          JSON.stringify(payload).slice(0, 500),
        ];
        await sheets.spreadsheets.values.append({
          spreadsheetId: bmcSheetId,
          range: `'${shopifyQuestionsSheetTab}'!A:E`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [row] },
        });
      } catch (e) {
        if (logger) logger.warn({ err: e, topic, shop }, "Sheet append failed");
      }
    }

    res.status(200).send();
  }));

  // ——— API: catálogo Shopify para integración app (paginado + full) ———
  router.get("/api/shopify/products", requireApiAuth, asyncHandler(async (req, res) => {
    const shop = String(req.query.shop || "").trim().toLowerCase();
    if (!validShop(shop)) return res.status(400).json({ ok: false, error: "Invalid shop" });

    const tokens = await store.getTokens(shop);
    if (!tokens?.access_token) return res.status(401).json({ ok: false, error: "Not installed or token missing" });

    const first = parsePageSize(req.query.limit, 50, 250);
    const after = req.query.cursor ? String(req.query.cursor) : null;
    const queryFilter = buildShopifyProductQuery({
      status: req.query.status || "active",
      q: req.query.q || "",
    });

    const query = `
      query ProductsPage($first: Int!, $after: String, $query: String) {
        products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          edges {
            cursor
            node {
              id
              handle
              title
              status
              vendor
              productType
              tags
              publishedAt
              updatedAt
              descriptionHtml
              onlineStoreUrl
              options {
                name
                values
              }
              images(first: 20) {
                edges {
                  node {
                    id
                    url
                    altText
                  }
                }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    barcode
                    availableForSale
                    price
                    compareAtPrice
                    inventoryPolicy
                    inventoryQuantity
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const gql = await shopifyGraphql({
      shop,
      accessToken: tokens.access_token,
      query,
      variables: { first, after, query: queryFilter || null },
    });
    if (!gql.ok) {
      return res.status(gql.status || 500).json({ ok: false, error: gql.error, details: gql.details });
    }

    const products = (gql.data?.products?.edges || []).map((edge) => ({
      cursor: edge.cursor,
      ...edge.node,
      images: (edge.node?.images?.edges || []).map((img) => img.node),
      variants: (edge.node?.variants?.edges || []).map((v) => v.node),
    }));

    return res.json({
      ok: true,
      source: "shopify-admin-graphql",
      shop,
      filters: { status: req.query.status || "active", q: req.query.q || "" },
      page: {
        limit: first,
        cursor: after,
        hasNextPage: Boolean(gql.data?.products?.pageInfo?.hasNextPage),
        endCursor: gql.data?.products?.pageInfo?.endCursor || null,
      },
      data: products,
    });
  }));

  router.get("/api/shopify/catalog/full", requireApiAuth, asyncHandler(async (req, res) => {
    const shop = String(req.query.shop || "").trim().toLowerCase();
    if (!validShop(shop)) return res.status(400).json({ ok: false, error: "Invalid shop" });

    const tokens = await store.getTokens(shop);
    if (!tokens?.access_token) return res.status(401).json({ ok: false, error: "Not installed or token missing" });

    const pageSize = parsePageSize(req.query.pageSize, 100, 250);
    const maxPages = parsePageSize(req.query.maxPages, 20, 200);
    const queryFilter = buildShopifyProductQuery({
      status: req.query.status || "active",
      q: req.query.q || "",
    });

    const query = `
      query ProductsPage($first: Int!, $after: String, $query: String) {
        products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          edges {
            cursor
            node {
              id
              handle
              title
              status
              vendor
              productType
              tags
              publishedAt
              updatedAt
              descriptionHtml
              onlineStoreUrl
              options {
                name
                values
              }
              images(first: 20) {
                edges {
                  node {
                    id
                    url
                    altText
                  }
                }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    barcode
                    availableForSale
                    price
                    compareAtPrice
                    inventoryPolicy
                    inventoryQuantity
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const all = [];
    let after = null;
    let hasNext = true;
    let pagesFetched = 0;

    while (hasNext && pagesFetched < maxPages) {
      const gql = await shopifyGraphql({
        shop,
        accessToken: tokens.access_token,
        query,
        variables: { first: pageSize, after, query: queryFilter || null },
      });
      if (!gql.ok) {
        return res.status(gql.status || 500).json({ ok: false, error: gql.error, details: gql.details });
      }

      const edges = gql.data?.products?.edges || [];
      for (const edge of edges) {
        all.push({
          cursor: edge.cursor,
          ...edge.node,
          images: (edge.node?.images?.edges || []).map((img) => img.node),
          variants: (edge.node?.variants?.edges || []).map((v) => v.node),
        });
      }

      hasNext = Boolean(gql.data?.products?.pageInfo?.hasNextPage);
      after = gql.data?.products?.pageInfo?.endCursor || null;
      pagesFetched += 1;
    }

    return res.json({
      ok: true,
      source: "shopify-admin-graphql",
      shop,
      filters: { status: req.query.status || "active", q: req.query.q || "" },
      meta: {
        totalProducts: all.length,
        pagesFetched,
        pageSize,
        maxPages,
        hasMore: hasNext,
        nextCursor: hasNext ? after : null,
      },
      data: all,
    });
  }));

  // ——— Admin: list questions (from Sheet) ———
  router.get("/admin/questions", asyncHandler(async (req, res) => {
    const shop = (req.query.shop || "").trim();
    if (!shop) return res.status(400).json({ ok: false, error: "Missing shop" });
    if (!bmcSheetId) return res.status(503).json({ ok: false, error: "Sheets not configured" });

    const auth = new google.auth.GoogleAuth({ scopes: SCOPES_SHEETS });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: bmcSheetId,
      range: `'${shopifyQuestionsSheetTab}'!A:Z`,
    });
    const rows = result.data.values || [];
    const headers = rows[0] || ["timestamp", "shop", "topic", "id", "payload"];
    const data = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
      return obj;
    });
    res.json({ ok: true, data, shop });
  }));

  // ——— Admin: approve & send reply (GraphQL order/customer note) ———
  router.post("/admin/answer", asyncHandler(async (req, res) => {
    const { shop, questionId, text } = req.body || {};
    if (!shop || !validShop(shop)) return res.status(400).json({ ok: false, error: "Invalid shop" });
    if (!text || typeof text !== "string") return res.status(400).json({ ok: false, error: "Missing text" });

    const tokens = await store.getTokens(shop);
    if (!tokens?.access_token) return res.status(401).json({ ok: false, error: "Not installed or token missing" });

    const orderId = String(questionId).replace(/^gid:\/\/shopify\/Order\//, "");
    const gql = `mutation OrderUpdate($input: OrderInput!) { orderUpdate(input: $input) { order { id } userErrors { field message } } }`;
    const gqlRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": tokens.access_token,
      },
      body: JSON.stringify({
        query: gql,
        variables: { input: { id: `gid://shopify/Order/${orderId}`, note: text } },
      }),
    });
    if (!gqlRes.ok) {
      return res.status(502).json({ ok: false, error: "GraphQL request failed", details: (await gqlRes.text()).slice(0, 200) });
    }
    const json = await gqlRes.json();
    if (json.errors?.length) {
      return res.status(400).json({ ok: false, error: json.errors[0]?.message || "GraphQL error" });
    }
    res.json({ ok: true, questionId });
  }));

  // ——— Admin: auto-reply config (toggle + UTC-3 schedule) ———
  router.post("/admin/auto-config", asyncHandler(async (req, res) => {
    const shop = (req.body?.shop || req.query.shop || "").trim();
    if (!shop || !validShop(shop)) return res.status(400).json({ ok: false, error: "Invalid shop" });

    const { enabled, cronExpression, utc3HoursStart, utc3HoursEnd, daysOfWeek } = req.body || {};
    await store.setConfig(shop, {
      autoReplyEnabled: Boolean(enabled),
      cronExpression: cronExpression || null,
      utc3HoursStart: utc3HoursStart != null ? Number(utc3HoursStart) : null,
      utc3HoursEnd: utc3HoursEnd != null ? Number(utc3HoursEnd) : null,
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : null,
    });
    res.json({ ok: true, shop });
  }));

  router.get("/admin/auto-config", asyncHandler(async (req, res) => {
    const shop = (req.query.shop || "").trim();
    if (!shop) return res.status(400).json({ ok: false, error: "Missing shop" });
    const config = await store.getConfig(shop);
    res.json({ ok: true, shop, config });
  }));

  return router;
}
