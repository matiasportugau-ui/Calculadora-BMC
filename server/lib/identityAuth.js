/**
 * Comprador identity — Google OAuth + JWT + DB-backed refresh rotation.
 *
 *   1) POST /auth/google   { idToken | accessToken }  → emite access JWT (15min) + refresh (30d)
 *   2) POST /auth/refresh                              → rotación obligatoria + reuse detection
 *   3) POST /auth/logout                               → revoca refresh
 *   4) GET  /auth/me        (Bearer JWT)               → perfil + role + plan
 *   5) middleware requireUser({ role?, module?, minLevel? })
 *
 * Mirrors server/lib/waOperatorAuth.js but adapted for end-users:
 *   - Auth source = Google ID token (preferred) or access token (fallback).
 *   - Sessions live in a dedicated identity.sessions table; rotation = insert new + mark old revoked.
 *   - Roles: superadmin > admin > operator > comprador.
 *   - Module grants: per-(user, module) override + role-derived defaults.
 *
 * Plan: docs/master-plans/user-identity-master-plan.md §Phase B
 */

import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const ACCESS_JWT_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

const ALL_MODULES = [
  "calc",
  "wa",
  "ml",
  "admin",
  "plan-import",
  "agent-admin",
  "canales",
  "crm-personal",
];

const ROLE_RANK = { superadmin: 4, admin: 3, operator: 2, comprador: 1 };
const LEVEL_RANK = { admin: 3, write: 2, read: 1, none: 0 };

let _pool = null;
let _logger = null;
let _googleAuthClient = null;

/** Bootstrap. Llamar al arranque en server/index.js. */
export function initIdentityAuth({ pool, logger = console } = {}) {
  _pool = pool;
  _logger = logger;
  _googleAuthClient = null; // lazy init on first use

  // Hard fail-fast on misconfiguration in production. Emit a loud warning in
  // dev/test so engineers see it before the first authenticated request hits
  // the silent token-substitution risk.
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const isProd = appEnv === "production";
  const idSecret = process.env.IDENTITY_JWT_SECRET || "";
  const waSecret = process.env.WA_JWT_SECRET || "";

  // Cross-system token substitution guard: if both subsystems share the same
  // HS256 secret, a valid wa_operator access JWT would pass identity verify
  // (and vice versa). Reject this configuration outright.
  if (idSecret && waSecret && idSecret === waSecret) {
    throw new Error(
      "[identityAuth] IDENTITY_JWT_SECRET must differ from WA_JWT_SECRET (cross-system token substitution guard)",
    );
  }
  if (!idSecret) {
    const msg = "[identityAuth] IDENTITY_JWT_SECRET is empty — Comprador auth will throw 500 on first authenticated request";
    if (isProd) throw new Error(msg);
    logger.warn?.(msg);
  } else if (idSecret.length < 32) {
    const msg = "[identityAuth] IDENTITY_JWT_SECRET must be ≥32 chars";
    if (isProd) throw new Error(msg);
    logger.warn?.(msg);
  }
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
    const msg = "[identityAuth] GOOGLE_OAUTH_CLIENT_ID is unset — access-token audience check is disabled";
    if (isProd) throw new Error(msg);
    logger.warn?.(msg);
  }
}

function logger() {
  return _logger || console;
}

function getJwtSecret() {
  // No fallback to WA_JWT_SECRET (Cross-system token substitution guard,
  // see initIdentityAuth + cursor[bot] C-1). Use a distinct secret per
  // subsystem.
  const s = process.env.IDENTITY_JWT_SECRET || "";
  if (!s || s.length < 32) {
    throw Object.assign(
      new Error("IDENTITY_JWT_SECRET no configurado (requiere ≥32 chars)"),
      { status: 500 },
    );
  }
  return s;
}

// ─── Google verification ───────────────────────────────────────────────

async function _getGoogleAuthClient() {
  if (_googleAuthClient) return _googleAuthClient;
  const { OAuth2Client } = await import("google-auth-library");
  _googleAuthClient = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID || "");
  return _googleAuthClient;
}

/** Verifies a Google ID token (signed JWT) — preferred. */
async function _verifyIdToken(idToken) {
  const aud = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!aud) {
    throw _serverError("GOOGLE_OAUTH_CLIENT_ID not configured (cannot verify ID token)");
  }
  const client = await _getGoogleAuthClient();
  const ticket = await client.verifyIdToken({ idToken, audience: aud });
  const p = ticket.getPayload();
  if (!p || !p.sub) throw _unauthorized("id_token_invalid");
  return {
    sub: p.sub,
    email: p.email,
    email_verified: !!p.email_verified,
    name: p.name,
    picture: p.picture,
    locale: p.locale,
  };
}

/**
 * Verifies a Google access token via tokeninfo (audience check) AND userinfo
 * (profile fetch). REJECTS the token if:
 *   - tokeninfo `aud` does not match GOOGLE_OAUTH_CLIENT_ID (token-substitution
 *     attack: a token minted for a different OAuth client cannot mint a BMC
 *     session for that user).
 *   - `email_verified` is not true.
 *
 * If GOOGLE_OAUTH_CLIENT_ID is unset (dev), the audience check is skipped with
 * a logger warning so local development still works against the GIS popup
 * but production deploys must set it.
 */
async function _verifyAccessToken(accessToken) {
  const expectedAud = process.env.GOOGLE_OAUTH_CLIENT_ID;

  // Step 1: tokeninfo — verifies the token is genuinely Google-issued AND
  // returns the OAuth client (`aud`) it was minted for.
  const tiResp = await fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
  if (!tiResp.ok) {
    // cursor[bot] W-3: never forward Google's error body to unauthenticated
    // callers; log server-side only.
    const body = await tiResp.text().catch(() => "");
    logger().warn?.({ status: tiResp.status, body: body.slice(0, 200) }, "[identityAuth] tokeninfo non-200");
    throw _unauthorized(`tokeninfo_${tiResp.status}`);
  }
  const ti = await tiResp.json().catch(() => null);
  if (!ti?.aud) throw _unauthorized("tokeninfo_no_aud");

  if (expectedAud) {
    if (ti.aud !== expectedAud) {
      // cursor[bot] F-1: do NOT include expectedAud (= GOOGLE_OAUTH_CLIENT_ID)
      // in the wire-facing detail; that leaks the OAuth client ID to anyone
      // who can hit /auth/google. Log internal context, return generic 401.
      logger().warn?.(
        { got_aud: ti.aud },
        "[identityAuth] tokeninfo aud mismatch",
      );
      throw _unauthorized("tokeninfo_aud_mismatch");
    }
  } else {
    // Production deploys without GOOGLE_OAUTH_CLIENT_ID would accept ANY
    // Google access token from ANY OAuth client — refuse outright.
    const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
    if (appEnv === "production") {
      throw _serverError(
        "GOOGLE_OAUTH_CLIENT_ID required in production for access-token authentication",
      );
    }
    logger().warn?.(
      { aud: ti.aud },
      "[identityAuth] GOOGLE_OAUTH_CLIENT_ID not configured — skipping aud check (dev only)",
    );
  }

  // Step 2: userinfo — pulls the OIDC profile claims.
  const resp = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    logger().warn?.({ status: resp.status, body: body.slice(0, 200) }, "[identityAuth] userinfo non-200");
    throw _unauthorized(`userinfo_${resp.status}`);
  }
  const u = await resp.json().catch(() => null);
  if (!u?.sub) throw _unauthorized("userinfo_no_sub");

  // Step 3: enforce verified email.
  // cursor[bot] MEDIUM: Google's /tokeninfo returns email_verified as the
  // STRING "false" for unverified accounts (not boolean false). The OIDC
  // userinfo v3 endpoint returns a proper boolean. Use explicit equality
  // checks so the string "false" stays falsy.
  const emailVerified =
    u.email_verified === true ||
    u.email_verified === "true" ||
    ti.email_verified === true ||
    ti.email_verified === "true";
  if (!emailVerified) {
    throw _unauthorized("email_not_verified");
  }

  return {
    sub: u.sub,
    email: u.email,
    email_verified: true,
    name: u.name,
    picture: u.picture,
    locale: u.locale,
  };
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Verifies a Google credential (idToken preferred, accessToken fallback),
 * upserts identity.users, creates a new session, and returns access+refresh.
 */
export async function verifyGoogleAndUpsert({
  idToken,
  accessToken,
  ip,
  userAgent,
} = {}) {
  if (!_pool) throw _serverError("identityAuth not initialized");
  if (!idToken && !accessToken) throw _badReq("idToken or accessToken required");

  const profile = idToken
    ? await _verifyIdToken(idToken)
    : await _verifyAccessToken(accessToken);

  const email = String(profile.email || "").toLowerCase();
  if (!email) throw _unauthorized("no_email_in_profile");

  // Reject unverified emails on BOTH paths. The seed migration pre-creates
  // identity.users + role_grants by email for internal admins; an ID token
  // carrying an unverified email matching a seeded row would otherwise bind
  // the Google subject to that privileged identity.
  if (!profile.email_verified) {
    throw _unauthorized("email_not_verified");
  }

  // Self-audit fix: wrap user upsert + role grant + session creation in a
  // single transaction so a partial failure (e.g. role_grants insert errors
  // after users upsert succeeded) does NOT leave a half-provisioned account
  // — _resolveTopRole would default to 'comprador' for the orphaned user
  // even if the grant never landed, hiding the failure from operators.
  let u;
  let jwtToken, refreshToken, sessionId, refreshExpiresAt;
  const client = typeof _pool.connect === "function" ? await _pool.connect() : null;
  try {
    if (client) await client.query("BEGIN");
    const tx = client || _pool;
    const upsert = await tx.query(
      `insert into identity.users (
          google_sub, email, email_verified, name, picture_url, last_login_at, last_active_at
       ) values ($1, $2, $3, $4, $5, now(), now())
       on conflict (email) do update
          set google_sub      = coalesce(identity.users.google_sub, excluded.google_sub),
              email_verified  = excluded.email_verified or identity.users.email_verified,
              name            = coalesce(excluded.name, identity.users.name),
              picture_url     = coalesce(excluded.picture_url, identity.users.picture_url),
              last_login_at   = now(),
              last_active_at  = now()
       returning user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at`,
      [profile.sub, email, profile.email_verified, profile.name, profile.picture],
    );
    u = upsert.rows[0];
    if (u.status !== "active") throw _unauthorized("user_disabled");

    // First-time users get the 'comprador' role. Idempotent.
    await tx.query(
      `insert into identity.role_grants (user_id, role) values ($1, 'comprador')
       on conflict (user_id, role) do nothing`,
      [u.user_id],
    );

    ({ accessToken: jwtToken, refreshToken, sessionId, refreshExpiresAt } =
      await _createSession({ userId: u.user_id, ip, userAgent, tx }));

    if (client) await client.query("COMMIT");
  } catch (err) {
    if (client) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    if (client && typeof client.release === "function") client.release();
  }

  const role = await _resolveTopRole(u.user_id);

  await _audit({
    actorId: u.user_id,
    action: "auth.login",
    resource: "identity.users",
    resourceId: u.user_id,
    ip,
    userAgent,
    payload: { provider: idToken ? "google_id_token" : "google_access_token" },
  });

  return {
    ok: true,
    user: _publicUser({ ...u, role }),
    role,
    plan_tier: u.plan_tier,
    accessToken: jwtToken,
    accessTokenExpiresIn: ACCESS_JWT_TTL_SEC,
    refreshToken,
    refreshExpiresAt,
    sessionId,
  };
}

/** Rotates a refresh token, returning a fresh access JWT + new refresh. */
export async function refreshTokens({ refreshToken, ip, userAgent } = {}) {
  if (!_pool) throw _serverError("identityAuth not initialized");
  if (!refreshToken) throw _unauthorized("refresh_required");
  const hash = _sha256(String(refreshToken));

  const { rows } = await _pool.query(
    `select s.session_id, s.user_id, s.refresh_expires_at, s.revoked_at,
            u.status, u.email, u.name, u.picture_url, u.avatar_preset, u.plan_tier
       from identity.sessions s
       join identity.users u on u.user_id = s.user_id
      where s.refresh_token_hash = $1`,
    [hash],
  );
  const s = rows[0];
  if (!s) throw _unauthorized("refresh_invalid");

  // Reuse detection: if the matched session is already revoked, an attacker
  // has presented a stolen, rotated refresh. Kill ALL sessions for this user
  // and bump jwt_revoked_at to invalidate any in-flight access JWTs.
  if (s.revoked_at) {
    await _pool.query(
      `update identity.sessions
          set revoked_at = coalesce(revoked_at, now())
        where user_id = $1`,
      [s.user_id],
    );
    await _pool.query(
      `update identity.users set jwt_revoked_at = now() where user_id = $1`,
      [s.user_id],
    );
    await _audit({
      actorId: s.user_id,
      action: "auth.token_reuse_detected",
      resource: "identity.sessions",
      resourceId: s.session_id,
      ip,
      userAgent,
    });
    throw _unauthorized("token_reuse_detected");
  }

  if (s.status !== "active") throw _unauthorized("user_disabled");
  if (new Date(s.refresh_expires_at).getTime() < Date.now()) {
    throw _unauthorized("refresh_expired");
  }

  // cursor[bot] round-6 MEDIUM: refresh rotation must be atomic. Two
  // concurrent calls with the same valid refresh both pass the SELECT
  // above (revoked_at=null at that moment). Without a CAS, both then mint
  // new sessions and the reuse-detection branch is never reached.
  //
  // Atomic compare-and-swap revoke: only one concurrent caller wins the
  // UPDATE (RETURNING returns 1 row); any later/concurrent caller sees
  // 0 rows and falls into the reuse-detection kill-all path below.
  const cas = await _pool.query(
    `update identity.sessions
        set revoked_at = now()
      where session_id = $1 and revoked_at is null
      returning session_id`,
    [s.session_id],
  );
  if (!cas.rows.length) {
    // Lost the CAS: another concurrent rotate already revoked this session.
    // That's the same threat model as replaying a previously-rotated refresh
    // — kill every session for this user and bump jwt_revoked_at.
    await _pool.query(
      `update identity.sessions set revoked_at = coalesce(revoked_at, now())
        where user_id = $1`,
      [s.user_id],
    );
    await _pool.query(
      `update identity.users set jwt_revoked_at = now() where user_id = $1`,
      [s.user_id],
    );
    await _audit({
      actorId: s.user_id,
      action: "auth.token_reuse_detected",
      resource: "identity.sessions",
      resourceId: s.session_id,
      ip,
      userAgent,
      payload: { via: "concurrent_rotate_race" },
    });
    throw _unauthorized("token_reuse_detected");
  }

  // We won the CAS: mint the replacement session.
  const { accessToken, refreshToken: newRefresh, sessionId, refreshExpiresAt } =
    await _createSession({
      userId: s.user_id,
      ip,
      userAgent,
      rotatedFromSessionId: s.session_id,
    });

  const role = await _resolveTopRole(s.user_id);

  await _audit({
    actorId: s.user_id,
    action: "auth.refresh",
    resource: "identity.sessions",
    resourceId: sessionId,
    ip,
    userAgent,
  });

  return {
    ok: true,
    user: _publicUser({
      user_id: s.user_id,
      email: s.email,
      name: s.name,
      picture_url: s.picture_url,
      avatar_preset: s.avatar_preset,
      plan_tier: s.plan_tier,
      role,
    }),
    role,
    plan_tier: s.plan_tier,
    accessToken,
    accessTokenExpiresIn: ACCESS_JWT_TTL_SEC,
    refreshToken: newRefresh,
    refreshExpiresAt,
    sessionId,
  };
}

/**
 * Revoke a session whose refresh-token cookie value is known but whose
 * access JWT was not presented (typical SPA logout: browser only sends the
 * httpOnly cookie). Looks up the session row by sha256(refreshToken) and
 * marks it revoked. Returns the userId that owned the session, or null if
 * the cookie matched no session (already logged out / fake cookie).
 */
export async function logoutByRefreshToken({ refreshToken, ip, userAgent } = {}) {
  if (!_pool) throw _serverError("identityAuth not initialized");
  if (!refreshToken) return { ok: true, userId: null };
  const hash = _sha256(String(refreshToken));
  const { rows } = await _pool.query(
    `select session_id, user_id, revoked_at from identity.sessions
      where refresh_token_hash = $1`,
    [hash],
  );
  const s = rows[0];
  if (!s) return { ok: true, userId: null };
  if (!s.revoked_at) {
    await _pool.query(
      `update identity.sessions set revoked_at = now() where session_id = $1`,
      [s.session_id],
    );
  }
  await _audit({
    actorId: s.user_id,
    action: "auth.logout",
    resource: "identity.sessions",
    resourceId: s.session_id,
    ip,
    userAgent,
    payload: { via: "refresh_cookie" },
  });
  return { ok: true, userId: s.user_id, sessionId: s.session_id };
}

/** Logs out a single session (or all sessions if sessionId omitted). */
export async function logout({ userId, sessionId, ip, userAgent } = {}) {
  if (!_pool) throw _serverError("identityAuth not initialized");
  if (!userId) return { ok: true };
  if (sessionId) {
    await _pool.query(
      `update identity.sessions set revoked_at = coalesce(revoked_at, now())
        where session_id = $1 and user_id = $2`,
      [sessionId, userId],
    );
  } else {
    await _pool.query(
      `update identity.sessions set revoked_at = coalesce(revoked_at, now())
        where user_id = $1`,
      [userId],
    );
  }
  await _audit({
    actorId: userId,
    action: "auth.logout",
    resource: "identity.sessions",
    resourceId: sessionId || null,
    ip,
    userAgent,
  });
  return { ok: true };
}

/** Admin-only: revokes everything for a user (kills sessions and bumps jwt_revoked_at). */
export async function revokeUser({ userId, actorId, ip, userAgent } = {}) {
  if (!_pool) throw _serverError("identityAuth not initialized");
  await _pool.query(
    `update identity.sessions set revoked_at = coalesce(revoked_at, now())
      where user_id = $1`,
    [userId],
  );
  await _pool.query(
    `update identity.users set jwt_revoked_at = now() where user_id = $1`,
    [userId],
  );
  await _audit({
    actorId: actorId || userId,
    action: "user.revoke",
    resource: "identity.users",
    resourceId: userId,
    ip,
    userAgent,
  });
  return { ok: true };
}

/** Returns the top role for a user (superadmin > admin > operator > comprador). */
export async function getRole(userId) {
  return _resolveTopRole(userId);
}

/** Returns module → level map: role-derived defaults overridden by explicit grants. */
export async function getModuleGrants(userId) {
  if (!_pool) throw _serverError("identityAuth not initialized");
  const role = await _resolveTopRole(userId);
  const baseline = _roleDefaults(role);
  const explicit = await _pool.query(
    `select module, level from identity.module_grants where user_id = $1`,
    [userId],
  );
  const out = { ...baseline };
  for (const r of explicit.rows) out[r.module] = r.level;
  return out;
}

/** Express middleware: requires authenticated user; optionally role/module/level. */
export function requireUser(opts = {}) {
  const { role, module: requiredModule, minLevel = "read", optional = false } = opts;
  return async (req, res, next) => {
    try {
      const claims = await _readClaimsFromRequest(req);
      if (!claims) {
        if (optional) return next();
        return res.status(401).json({ ok: false, error: "missing_credentials" });
      }
      const { rows } = await _pool.query(
        `select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at
           from identity.users where user_id = $1`,
        [claims.sub],
      );
      const u = rows[0];
      if (!u) return res.status(401).json({ ok: false, error: "user_not_found" });
      if (u.status !== "active") return res.status(401).json({ ok: false, error: "user_disabled" });
      if (
        u.jwt_revoked_at &&
        Number(claims.iat) * 1000 < new Date(u.jwt_revoked_at).getTime()
      ) {
        return res.status(401).json({ ok: false, error: "token_revoked" });
      }
      const userRole = await _resolveTopRole(u.user_id);

      // superadmin bypass
      if (userRole !== "superadmin") {
        // cursor[bot] LOW: do NOT echo the caller's actual role/grant on the
        // wire. Production responses are intentionally opaque ('forbidden')
        // so a low-privilege JWT can't probe admin routes to enumerate its
        // own state without going through /auth/me/grants. Outside production
        // we surface the detail to keep the dev experience explicit.
        const isProdResp = (process.env.APP_ENV || process.env.NODE_ENV) === "production";
        if (role && !_roleAllows(userRole, role)) {
          if (isProdResp) {
            return res.status(403).json({ ok: false, error: "forbidden" });
          }
          return res.status(403).json({
            ok: false,
            error: "insufficient_role",
            required: role,
            have: userRole,
          });
        }
        if (requiredModule) {
          const grants = await getModuleGrants(u.user_id);
          const have = grants[requiredModule] || "none";
          if (!_levelAllows(have, minLevel)) {
            if (isProdResp) {
              return res.status(403).json({ ok: false, error: "forbidden" });
            }
            return res.status(403).json({
              ok: false,
              error: "insufficient_module_grant",
              required: { module: requiredModule, minLevel },
              have: { module: requiredModule, level: have },
            });
          }
        }
      }

      req.user = {
        id: u.user_id,
        email: u.email,
        name: u.name,
        picture_url: u.picture_url,
        avatar_preset: u.avatar_preset,
        plan_tier: u.plan_tier,
        role: userRole,
        subject_type: "user",
        sessionId: claims.sid || null,
      };
      _pool
        .query("update identity.users set last_active_at = now() where user_id = $1", [u.user_id])
        .catch(() => {});
      next();
    } catch (e) {
      logger().error?.({ err: e }, "[identityAuth] requireUser error");
      res.status(e.status || 500).json({ ok: false, error: e.message || "auth_internal" });
    }
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────

async function _createSession({ userId, ip, userAgent, rotatedFromSessionId = null, tx = null }) {
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const refreshHash = _sha256(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  // Self-audit fix: when called from inside verifyGoogleAndUpsert's
  // transaction, route the insert through the same client so a session
  // failure rolls back the user/role inserts atomically.
  const runner = tx || _pool;
  const ins = await runner.query(
    `insert into identity.sessions (
        user_id, refresh_token_hash, refresh_expires_at, ip, user_agent, rotated_from_session_id
     ) values ($1, $2, $3, $4, $5, $6)
     returning session_id`,
    [userId, refreshHash, refreshExpiresAt, ip || null, userAgent || null, rotatedFromSessionId],
  );
  const sessionId = ins.rows[0].session_id;

  const accessToken = _signJwt({
    sub: userId,
    sid: sessionId,
    subject_type: "user",
  });

  return {
    accessToken,
    refreshToken,
    sessionId,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  };
}

async function _resolveTopRole(userId) {
  const { rows } = await _pool.query(
    `select role from identity.role_grants where user_id = $1`,
    [userId],
  );
  let top = "comprador";
  for (const r of rows) {
    if ((ROLE_RANK[r.role] || 0) > (ROLE_RANK[top] || 0)) top = r.role;
  }
  return top;
}

function _roleDefaults(role) {
  const allWrite = Object.fromEntries(ALL_MODULES.map((m) => [m, "write"]));
  const allAdmin = Object.fromEntries(ALL_MODULES.map((m) => [m, "admin"]));
  switch (role) {
    case "superadmin":
      return allAdmin;
    case "admin":
      return { ...allWrite, admin: "admin" };
    case "operator":
      return { calc: "write", wa: "write", ml: "write", "agent-admin": "read", canales: "read" };
    case "comprador":
    default:
      return { calc: "write" };
  }
}

function _roleAllows(actual, minimum) {
  return (ROLE_RANK[actual] || 0) >= (ROLE_RANK[minimum] || 0);
}

function _levelAllows(actual, minimum) {
  return (LEVEL_RANK[actual] || 0) >= (LEVEL_RANK[minimum] || 0);
}

async function _readClaimsFromRequest(req) {
  // cursor[bot] W-1: access JWT must arrive ONLY in `Authorization: Bearer`.
  // The previous `bmc_access` cookie fallback was undocumented and would
  // accept a JWT planted by a client-side script (XSS / extension), bypassing
  // the httpOnly intent that protects the refresh cookie (`bmc_sess`).
  // Refresh cookie → `/auth/refresh` only; access JWT → header only.
  const auth = req.get?.("authorization") || "";
  const m = /^Bearer (.+)$/i.exec(auth.trim());
  if (!m) return null;
  try {
    const claims = jwt.verify(m[1], getJwtSecret(), { algorithms: ["HS256"] });
    if (!claims?.sub) return null;
    return claims;
  } catch {
    return null;
  }
}

function _publicUser(u) {
  return {
    id: u.user_id,
    email: u.email,
    name: u.name || null,
    picture: u.picture_url || null,
    avatar_preset: u.avatar_preset || null,
    plan_tier: u.plan_tier || "base",
    role: u.role || "comprador",
  };
}

function _signJwt(claims) {
  return jwt.sign(claims, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: ACCESS_JWT_TTL_SEC,
  });
}

function _sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function _unauthorized(error, detail) {
  const e = new Error(error);
  e.status = 401;
  if (detail) e.detail = detail;
  return e;
}

function _badReq(error) {
  const e = new Error(error);
  e.status = 400;
  return e;
}

function _serverError(error) {
  const e = new Error(error);
  e.status = 500;
  return e;
}

async function _audit(entry) {
  if (!_pool) return;
  try {
    await _pool.query(
      `insert into identity.audit_log (actor_user_id, actor_kind, action, resource, resource_id, ip, user_agent, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        entry.actorId || null,
        entry.actorKind || "user",
        entry.action,
        entry.resource || null,
        entry.resourceId || null,
        entry.ip || null,
        entry.userAgent || null,
        entry.payload ? JSON.stringify(entry.payload) : "{}",
      ],
    );
  } catch (e) {
    logger().warn?.({ err: e }, "[identityAuth] audit insert failed");
  }
}

// ─── Test helpers ──────────────────────────────────────────────────────

/** Internal — for tests only. */
export const __test__ = {
  reset() {
    _pool = null;
    _logger = null;
    _googleAuthClient = null;
  },
  injectGoogleAuthClient(c) {
    _googleAuthClient = c;
  },
};

export const _internal = { ROLE_RANK, LEVEL_RANK, ALL_MODULES };
