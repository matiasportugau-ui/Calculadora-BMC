import { setTimeout as delay } from "node:timers/promises";
import { redirectUri } from "./config.js";

const shouldRetry = (status) => status === 429 || status >= 500;

const parseJsonSafe = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export const createMercadoLibreClient = ({ config, tokenStore, logger }) => {
  let refreshInFlight = null;

  const assertOAuthConfig = () => {
    const missing = [];
    if (!config.mlClientId) missing.push("ML_CLIENT_ID");
    if (!config.mlClientSecret) missing.push("ML_CLIENT_SECRET");
    if (!redirectUri()) missing.push("ML_REDIRECT_URI_DEV/PROD");
    if (missing.length > 0) {
      const err = new Error(`Missing OAuth configuration: ${missing.join(", ")}`);
      err.status = 500;
      throw err;
    }
  };

  const buildAuthUrl = (state, codeChallenge) => {
    assertOAuthConfig();
    const url = new URL("/authorization", config.mlAuthBase);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", config.mlClientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("state", state);
    if (codeChallenge) {
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  };

  const saveOAuthPayload = async (payload) => {
    const existing = await tokenStore.read();
    const expiresIn = Number(payload.expires_in || 0);
    const expiresAt = Date.now() + expiresIn * 1000;
    // Refresh responses often omit user_id / refresh_token; keep prior values
    const next = {
      access_token: payload.access_token,
      token_type: payload.token_type ?? existing?.token_type,
      user_id: payload.user_id ?? existing?.user_id,
      scope: payload.scope ?? existing?.scope,
      refresh_token: payload.refresh_token ?? existing?.refresh_token,
      expires_in: expiresIn,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };
    await tokenStore.write(next);
    return next;
  };

  const tokenRequest = async (formData) => {
    assertOAuthConfig();
    const response = await fetch(`${config.mlApiBase}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(formData),
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
      const err = new Error("MercadoLibre OAuth token request failed");
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  };

  const exchangeCodeForTokens = async (code, codeVerifier) => {
    const body = {
      grant_type: "authorization_code",
      client_id: config.mlClientId,
      client_secret: config.mlClientSecret,
      code,
      redirect_uri: redirectUri(),
    };
    if (codeVerifier) body.code_verifier = codeVerifier;
    const payload = await tokenRequest(body);
    return saveOAuthPayload(payload);
  };

  const refreshTokens = async (refreshToken) => {
    const payload = await tokenRequest({
      grant_type: "refresh_token",
      client_id: config.mlClientId,
      client_secret: config.mlClientSecret,
      refresh_token: refreshToken,
    });
    return saveOAuthPayload(payload);
  };

  const ensureValidToken = async () => {
    const tokens = await tokenStore.read();
    if (!tokens?.access_token) {
      const err = new Error("OAuth not initialized. Complete /auth/ml/start flow first.");
      err.status = 401;
      throw err;
    }

    const expiresAt = Number(tokens.expires_at || 0);
    const needsRefresh = !expiresAt || Date.now() >= expiresAt - 60_000;
    if (!needsRefresh) return tokens;

    if (!tokens.refresh_token) {
      const err = new Error("Refresh token missing. Re-run OAuth login.");
      err.status = 401;
      throw err;
    }

    if (!refreshInFlight) {
      refreshInFlight = refreshTokens(tokens.refresh_token)
        .then((next) => {
          logger.info({ userId: next.user_id }, "MercadoLibre token refreshed");
          return next;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }

    return refreshInFlight;
  };

  const requestWithRetries = async ({ method, path, query, body, tryRefreshOn401 = true }) => {
    const tokens = await ensureValidToken();
    const url = new URL(path, config.mlApiBase);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value != null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let attempt = 0;
    while (true) {
      attempt += 1;
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });
      const payload = await parseJsonSafe(response);

      if (response.ok) return payload;

      if (response.status === 401 && tryRefreshOn401) {
        logger.warn("Access token rejected, forcing refresh and retry");
        await refreshTokens(tokens.refresh_token);
        return requestWithRetries({ method, path, query, body, tryRefreshOn401: false });
      }

      if (attempt <= config.maxRetries && shouldRetry(response.status)) {
        const waitMs = Math.min(1000 * 2 ** (attempt - 1), 5000);
        logger.warn(
          { status: response.status, attempt, waitMs, path },
          "Retrying MercadoLibre API request"
        );
        await delay(waitMs);
        continue;
      }

      const err = new Error("MercadoLibre API request failed");
      err.status = response.status;
      err.payload = payload;
      err.path = path;
      throw err;
    }
  };

  const getStoredTokens = async () => tokenStore.read();

  /** user_id from token file, or JWT payload, or GET /users/me (then persisted) */
  const sellerIdFromStoredOrJwt = (tokens) => {
    if (!tokens) return null;
    if (tokens.user_id != null && tokens.user_id !== "") return String(tokens.user_id);
    const at = tokens.access_token;
    if (typeof at !== "string" || at.split(".").length < 2) return null;
    try {
      const payload = JSON.parse(Buffer.from(at.split(".")[1], "base64url").toString("utf8"));
      if (payload.uid != null) return String(payload.uid);
      if (payload.user_id != null) return String(payload.user_id);
    } catch {
      return null;
    }
    return null;
  };

  const resolveSellerId = async () => {
    const tokens = await tokenStore.read();
    const fromStore = sellerIdFromStoredOrJwt(tokens);
    if (fromStore) return fromStore;
    if (!tokens?.access_token) return null;
    try {
      const me = await requestWithRetries({ method: "GET", path: "/users/me" });
      const id = me?.id;
      if (id == null) return null;
      const latest = await tokenStore.read();
      if (latest) {
        await tokenStore.write({
          ...latest,
          user_id: id,
          updated_at: new Date().toISOString(),
        });
      }
      return String(id);
    } catch (error) {
      logger.warn({ err: error }, "resolveSellerId: /users/me failed");
      return null;
    }
  };

  return {
    buildAuthUrl,
    exchangeCodeForTokens,
    getStoredTokens,
    requestWithRetries,
    resolveSellerId,
  };
};
