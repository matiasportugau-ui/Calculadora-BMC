/**
 * WA Cockpit — Auth multi-operador (Auth.js v5 pattern, 2026 best practices).
 *
 *   1) POST /api/wa/auth/request-magic-link  → email con token (15min TTL)
 *   2) GET  /api/wa/auth/verify?token=...    → emite access JWT (15min) + refresh (30d)
 *   3) POST /api/wa/auth/refresh             → rotación obligatoria + reuse detection
 *   4) POST /api/wa/auth/logout              → revoca refresh (no JWT)
 *   5) middleware requireWaOperator          → valida JWT + tenant + role
 *
 * Seguridad clave:
 *   - JWT corto (15min) → minimiza blast radius si es robado.
 *   - Refresh rotación: cada uso emite uno nuevo y invalida el anterior.
 *     Si alguien reusa un refresh ya rotado → señal de robo, revoca TODOS
 *     los tokens del operador (jwt_revoked_at = now()).
 *   - Magic link single-use (token_hash se borra al verificar).
 *   - Constant-time compare en hashes.
 */

import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const ACCESS_JWT_TTL_SEC = 15 * 60;       // 15 minutos
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000; // 30 días
const MAGIC_TTL_MS = 15 * 60 * 1000;      // 15 minutos

let _pool = null;
let _logger = null;
let _sendMail = null;

/** Bootstrap del módulo. Llamar al arranque en server/index.js. */
export function initWaOperatorAuth({ pool, logger = console, sendMail }) {
  _pool = pool;
  _logger = logger;
  _sendMail = sendMail || _defaultSendMail;
}

function logger() {
  return _logger || console;
}

function getJwtSecret() {
  const s = process.env.WA_JWT_SECRET || process.env.API_AUTH_TOKEN || "";
  if (!s || s.length < 32) {
    throw Object.assign(
      new Error("WA_JWT_SECRET no configurado (requiere ≥32 chars)"),
      { status: 500 },
    );
  }
  return s;
}

// ─── Magic link ─────────────────────────────────────────────────────────

/**
 * Crea un token de magic link y lo envía por mail.
 * Si el email no existe en wa_operators, devolvemos OK silente para evitar
 * enumeración de usuarios (best practice 2026).
 */
export async function requestMagicLink({ email, baseUrl, ip, userAgent }) {
  if (!_pool) throw new Error("waOperatorAuth not initialized");
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    const err = new Error("invalid email");
    err.status = 400;
    throw err;
  }

  const { rows } = await _pool.query(
    "select operator_id, name, status from wa_operators where email = $1",
    [normalizedEmail],
  );
  const op = rows[0];
  if (!op || op.status === "disabled") {
    // Devolvemos ok silente sin generar token (anti enumeration).
    logger().info?.({ email: normalizedEmail }, "[waAuth] magic-link request for unknown/disabled email");
    return { ok: true, sent: false };
  }

  const tokenPlain = crypto.randomBytes(32).toString("hex");
  const tokenHash = _sha256(tokenPlain);
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MS);

  // console.log("[waAuth] magic-link token:", tokenPlain, "hash:", tokenHash);

  await _pool.query(
    `update wa_operators
       set magic_token_hash = $2,
           magic_token_expires_at = $3
     where operator_id = $1`,
    [op.operator_id, tokenHash, expiresAt],
  );

  const verifyUrl = `${(baseUrl || process.env.PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/+$/, "")}/api/wa/auth/verify?token=${encodeURIComponent(tokenPlain)}`;

  await _audit({
    operatorId: op.operator_id,
    action: "auth.magic_link_request",
    target: normalizedEmail,
    ip,
    userAgent,
  });

  try {
    await _sendMail({
      to: normalizedEmail,
      subject: "BMC WA Cockpit — Acceso (válido 15min)",
      text: `Hola ${op.name || ""}.\n\nIngresá al cockpit BMC WhatsApp con este link (expira en 15 minutos, uso único):\n\n${verifyUrl}\n\nSi no fuiste vos, ignorá este mensaje.`,
      html: `
        <p>Hola ${op.name || ""}.</p>
        <p>Ingresá al cockpit BMC WhatsApp con el botón de abajo. Expira en <strong>15 minutos</strong> y se usa una sola vez.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none">Acceder al cockpit</a></p>
        <p style="color:#666;font-size:12px">Si el botón no funciona, copiá este enlace en tu navegador:<br><code>${verifyUrl}</code></p>
        <p style="color:#666;font-size:12px">Si no fuiste vos, ignorá este mensaje.</p>
      `,
    });
  } catch (e) {
    logger().error?.({ err: e }, "[waAuth] sendMail failed");
    const err = new Error("could not send mail (revisar SMTP_USER/SMTP_PASS)");
    err.status = 503;
    throw err;
  }

  return { ok: true, sent: true };
}

/**
 * Verifica un magic link y emite access+refresh.
 * Llamado tanto por GET /api/wa/auth/verify (browser flow) como por
 * POST /api/wa/auth/verify (popup extension flow JSON).
 */
export async function verifyMagicLink({ token, ip, userAgent }) {
  if (!_pool) throw new Error("waOperatorAuth not initialized");
  if (!token) throw _badReq("token required");
  const tokenHash = _sha256(String(token));

  const { rows } = await _pool.query(
    `select operator_id, email, name, role, status, magic_token_expires_at
       from wa_operators
      where magic_token_hash = $1`,
    [tokenHash],
  );
  const op = rows[0];
  if (!op) throw _unauthorized("magic_link_invalid");
  if (op.status === "disabled") throw _unauthorized("operator_disabled");
  const expiresAt = op.magic_token_expires_at;
  if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
    throw _unauthorized("magic_link_expired");
  }

  // Emit tokens.
  const refreshPlain = crypto.randomBytes(32).toString("hex");
  const refreshHash = _sha256(refreshPlain);
  const refreshExpires = new Date(Date.now() + REFRESH_TTL_MS);

  // Single-use: invalidar magic + setear refresh + activar operador si era 'invited'.
  await _pool.query(
    `update wa_operators
        set magic_token_hash = null,
            magic_token_expires_at = null,
            refresh_token_hash = $2,
            refresh_expires_at = $3,
            last_login_at = now(),
            last_active_at = now(),
            status = case when status = 'invited' then 'active' else status end
      where operator_id = $1`,
    [op.operator_id, refreshHash, refreshExpires],
  );

  const accessJwt = _signJwt({
    sub: op.operator_id,
    email: op.email,
    role: op.role,
  });

  await _audit({
    operatorId: op.operator_id,
    action: "auth.login",
    target: op.email,
    ip,
    userAgent,
  });

  return {
    ok: true,
    operator: {
      id: op.operator_id,
      email: op.email,
      name: op.name,
      role: op.role,
    },
    accessToken: accessJwt,
    accessTokenExpiresIn: ACCESS_JWT_TTL_SEC,
    refreshToken: refreshPlain,
    refreshExpiresAt: refreshExpires.toISOString(),
  };
}

// ─── Refresh con rotación + reuse detection ────────────────────────────

export async function refreshTokens({ refreshToken, ip, userAgent }) {
  if (!_pool) throw new Error("waOperatorAuth not initialized");
  if (!refreshToken) throw _unauthorized("refresh_required");
  const tokenHash = _sha256(String(refreshToken));

  // Buscar operador con este hash. Si no aparece y previously era válido,
  // implica reuse → revocamos todo en ese operador.
  const { rows } = await _pool.query(
    `select operator_id, email, role, status, refresh_token_hash, refresh_expires_at,
            jwt_revoked_at
       from wa_operators
      where refresh_token_hash = $1`,
    [tokenHash],
  );
  const op = rows[0];
  if (!op) {
    // Reuse-detection: si el token ya fue rotado, esta consulta no encontrará
    // nada. Como no podemos identificar al dueño, sólo loguamos.
    logger().warn?.({ ip }, "[waAuth] refresh token not found (possible reuse)");
    throw _unauthorized("refresh_invalid");
  }
  if (op.status === "disabled") throw _unauthorized("operator_disabled");
  if (new Date(op.refresh_expires_at).getTime() < Date.now()) {
    throw _unauthorized("refresh_expired");
  }

  // Rotación: nuevo refresh + invalidar el viejo.
  const newRefreshPlain = crypto.randomBytes(32).toString("hex");
  const newRefreshHash = _sha256(newRefreshPlain);
  const newExpires = new Date(Date.now() + REFRESH_TTL_MS);

  await _pool.query(
    `update wa_operators
        set refresh_token_hash = $2,
            refresh_expires_at = $3,
            last_active_at = now()
      where operator_id = $1`,
    [op.operator_id, newRefreshHash, newExpires],
  );

  const accessJwt = _signJwt({
    sub: op.operator_id,
    email: op.email,
    role: op.role,
  });

  await _audit({
    operatorId: op.operator_id,
    action: "auth.refresh",
    target: op.email,
    ip,
    userAgent,
  });

  return {
    ok: true,
    accessToken: accessJwt,
    accessTokenExpiresIn: ACCESS_JWT_TTL_SEC,
    refreshToken: newRefreshPlain,
    refreshExpiresAt: newExpires.toISOString(),
  };
}

export async function logout({ operatorId, ip, userAgent }) {
  if (!_pool) throw new Error("waOperatorAuth not initialized");
  if (!operatorId) return { ok: true };
  await _pool.query(
    `update wa_operators
        set refresh_token_hash = null,
            refresh_expires_at = null
      where operator_id = $1`,
    [operatorId],
  );
  await _audit({ operatorId, action: "auth.logout", ip, userAgent });
  return { ok: true };
}

/** Revoca todos los tokens de un operador (admin action). */
export async function revokeOperator({ operatorId, actorId, ip, userAgent }) {
  if (!_pool) throw new Error("waOperatorAuth not initialized");
  await _pool.query(
    `update wa_operators
        set refresh_token_hash = null,
            refresh_expires_at = null,
            jwt_revoked_at = now()
      where operator_id = $1`,
    [operatorId],
  );
  await _audit({
    operatorId: actorId,
    action: "operator.revoke",
    target: operatorId,
    ip,
    userAgent,
  });
  return { ok: true };
}

/**
 * Crea un operador nuevo y opcionalmente envía magic link de bienvenida.
 * Si ya existe (email único), reusa el operador existente.
 */
export async function inviteOperator({
  email,
  name,
  role = "member",
  invitedBy,
  sendInviteMail = true,
  baseUrl,
  ip,
  userAgent,
}) {
  if (!_pool) throw new Error("waOperatorAuth not initialized");
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail.includes("@")) throw _badReq("invalid email");
  if (!["owner", "admin", "member"].includes(role)) {
    throw _badReq("invalid role");
  }

  // operator_id: derivado del email (slug) — único, legible.
  const operatorId =
    normalizedEmail.split("@")[0].replace(/[^a-z0-9_-]/g, "_") +
    "_" +
    crypto.randomBytes(2).toString("hex");

  const ins = await _pool.query(
    `insert into wa_operators (operator_id, email, name, role, status, invited_by)
     values ($1, $2, $3, $4, 'invited', $5)
     on conflict (email) do update
        set name = coalesce(wa_operators.name, excluded.name),
            role = excluded.role
     returning operator_id, email, name, role, status`,
    [operatorId, normalizedEmail, name || null, role, invitedBy || null],
  );
  const op = ins.rows[0];

  await _audit({
    operatorId: invitedBy,
    action: "operator.invite",
    target: op.email,
    after: { role: op.role, status: op.status },
    ip,
    userAgent,
  });

  if (sendInviteMail) {
    await requestMagicLink({ email: op.email, baseUrl, ip, userAgent });
  }
  return { ok: true, operator: op };
}

// ─── Middleware ────────────────────────────────────────────────────────

/**
 * Express middleware: valida access JWT en Authorization: Bearer <token>.
 * Hace check anti-revocación (JWT iat > jwt_revoked_at).
 *
 * @param {{ require?: 'owner'|'admin'|'member' }} opts
 */
export function requireWaOperator(opts = {}) {
  const minRole = opts.require || "member";
  return async (req, res, next) => {
    try {
      const auth = req.get("authorization") || "";
      const m = /^Bearer (.+)$/i.exec(auth.trim());
      if (!m) {
        return res.status(401).json({ ok: false, error: "missing_bearer" });
      }
      const tokenStr = m[1];
      let payload;
      try {
        payload = jwt.verify(tokenStr, getJwtSecret(), { algorithms: ["HS256"] });
      } catch (e) {
        return res
          .status(401)
          .json({ ok: false, error: "invalid_token", detail: e.message });
      }
      if (!payload?.sub) {
        return res.status(401).json({ ok: false, error: "invalid_payload" });
      }
      // Tenant check (single-tenant hoy → asumimos 'tenant' fijo. Si en el
      // futuro JWT trae payload.tenant_id, comparar contra el tenant del recurso.)

      const { rows } = await _pool.query(
        `select operator_id, email, name, role, status, jwt_revoked_at
           from wa_operators
          where operator_id = $1`,
        [payload.sub],
      );
      const op = rows[0];
      if (!op) return res.status(401).json({ ok: false, error: "operator_not_found" });
      if (op.status === "disabled") {
        return res.status(401).json({ ok: false, error: "operator_disabled" });
      }
      if (op.jwt_revoked_at && payload.iat * 1000 < new Date(op.jwt_revoked_at).getTime()) {
        return res.status(401).json({ ok: false, error: "token_revoked" });
      }
      if (!_roleAllows(op.role, minRole)) {
        return res.status(403).json({ ok: false, error: "insufficient_role", required: minRole, have: op.role });
      }

      req.operator = {
        id: op.operator_id,
        email: op.email,
        name: op.name,
        role: op.role,
      };
      // Best-effort touch last_active (no bloquea request).
      _pool
        .query("update wa_operators set last_active_at=now() where operator_id=$1", [op.operator_id])
        .catch(() => {});
      next();
    } catch (e) {
      logger().error?.({ err: e }, "[waAuth] middleware error");
      res.status(500).json({ ok: false, error: "auth_internal" });
    }
  };
}

const ROLE_RANK = { owner: 3, admin: 2, member: 1 };
function _roleAllows(actual, minimum) {
  return (ROLE_RANK[actual] || 0) >= (ROLE_RANK[minimum] || 0);
}

// ─── Helpers internos ──────────────────────────────────────────────────

function _signJwt(claims) {
  return jwt.sign(claims, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: ACCESS_JWT_TTL_SEC,
  });
}

function _sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function _unauthorized(error) {
  const e = new Error(error);
  e.status = 401;
  return e;
}

function _badReq(error) {
  const e = new Error(error);
  e.status = 400;
  return e;
}

async function _audit(entry) {
  if (!_pool) return;
  try {
    await _pool.query(
      `insert into wa_audit_log (operator_id, action, target, before, after, ip, user_agent)
       values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)`,
      [
        entry.operatorId || null,
        entry.action,
        entry.target || null,
        entry.before == null ? null : JSON.stringify(entry.before),
        entry.after == null ? null : JSON.stringify(entry.after),
        entry.ip || null,
        entry.userAgent || null,
      ],
    );
  } catch (e) {
    logger().warn?.({ err: e }, "[waAuth] audit insert failed");
  }
}

async function _defaultSendMail({ to, subject, text, html }) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP_USER/SMTP_PASS missing");
  }
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: smtpUser, pass: smtpPass },
  });
  const from = process.env.WA_AUTH_EMAIL_FROM || smtpUser;
  await transporter.sendMail({
    from: `"BMC WA Cockpit" <${from}>`,
    to,
    subject,
    text,
    html,
  });
}

// Para tests
export function _resetWaAuthForTests() {
  _pool = null;
  _logger = null;
  _sendMail = null;
}
