/**
 * WA Cockpit — config loader (settings + flags) con cache LRU + LISTEN/NOTIFY.
 *
 * Single source of truth runtime-side. Lee de wa_settings + wa_flags y usa
 * el schema canónico (waConfigSchema.js) para validar + aplicar defaults.
 *
 * Patrón:
 *   1) primeWaConfig({ pool }) — carga inicial desde DB y arranca listener.
 *   2) getConfig({ operatorId? }) — devuelve objeto tipado completo (cached).
 *   3) getFlag(key) — boolean efectivo del flag.
 *   4) setSetting(key, value, { actor, scope, scopeId }) — valida con zod,
 *      escribe wa_settings (NOTIFY automático via trigger), registra audit.
 *   5) setFlag(key, patch, { actor }) — toggle flag con audit.
 *
 * Drift recovery: si DB tiene un valor que falla zod, se loguea y se usa
 * default. Nunca crashea el server.
 */

import {
  SettingsSchema,
  FlagsSchema,
  buildSettings,
  buildFlags,
  describeSchema,
  FLAG_KEYS,
} from "./waConfigSchema.js";

const NOTIFY_CHANNEL = "wa_config_changed";
const CACHE_TTL_MS = 30_000;

let _pool = null;
let _logger = null;
let _cachedTenant = null;       // { data, flags, drift, fetchedAt }
const _cachedOperators = new Map(); // operator_id → { overrides, fetchedAt }
let _listenerClient = null;

function logger() {
  return _logger || console;
}

/**
 * Inicializa el loader: lee la primera vez y monta el listener LISTEN/NOTIFY.
 * Llamar UNA vez al arranque del server (server/index.js).
 *
 * @param {{ pool: import('pg').Pool, logger?: any }} opts
 */
export async function primeWaConfig({ pool, logger: lg = console } = {}) {
  if (!pool) throw new Error("primeWaConfig: pool required");
  _pool = pool;
  _logger = lg;
  await _refreshTenant({ silent: false });
  await _startListener();
  logger().info?.(
    {
      flags: Object.entries(_cachedTenant.flags).filter(([, v]) => v).map(([k]) => k),
      drift: _cachedTenant.drift,
    },
    "[waConfig] primed",
  );
}

/**
 * Devuelve la config efectiva (tenant base + override del operador si aplica).
 * @param {{ operatorId?: string }} opts
 */
export function getConfig({ operatorId } = {}) {
  _ensureFresh();
  const base = _cachedTenant.data;
  if (!operatorId) return base;
  const opEntry = _cachedOperators.get(operatorId);
  const overrides = opEntry?.overrides;
  if (!overrides || Object.keys(overrides).length === 0) return base;
  return _deepMerge(base, overrides);
}

/**
 * Boolean del flag aplicando rollout_percent: si 100 = enabled puro,
 * si <100 se decide deterministico por hash(scope_id || operatorId || 'tenant').
 */
export function getFlag(key, { operatorId } = {}) {
  _ensureFresh();
  const entry = _cachedTenant.flagsRaw?.[key];
  if (!entry) return _cachedTenant.flags[key] ?? false;
  if (!entry.enabled) return false;
  const pct = Number(entry.rollout_percent);
  if (!Number.isFinite(pct) || pct >= 100) return true;
  if (pct <= 0) return false;
  const seed = `${key}|${operatorId || "tenant"}`;
  return _hash01(seed) < pct;
}

/** Lee un setting puntual (path con dots: 'enricher.intervalMs'). */
export function getSetting(path, { operatorId } = {}) {
  const cfg = getConfig({ operatorId });
  return _getPath(cfg, path);
}

/**
 * Escribe un setting. Valida antes de persistir (parse parcial del schema).
 *
 * @param {string} path  — key con dots ej. 'enricher.intervalMs' o namespace 'enricher'.
 * @param {any}    value — valor a guardar.
 * @param {{ actor?: string, scope?: 'tenant'|'operator', scopeId?: string, ip?: string, userAgent?: string }} ctx
 */
export async function setSetting(path, value, ctx = {}) {
  _assertSettingWriteAllowed(path, ctx);
  if (!_pool) throw new Error("setSetting: waConfig not primed");
  const scope = ctx.scope || "tenant";
  const scopeId = ctx.scopeId || (scope === "tenant" ? "tenant" : null);
  if (scope === "operator" && !scopeId) {
    throw new Error("setSetting: scope=operator requires scopeId");
  }

  // Construimos el objeto candidato con el cambio aplicado y lo validamos
  // contra el schema completo. Si pasa, persistimos el valor "tal cual" en
  // la fila key=path. Si falla → error con mensajes claros.
  const candidate = _deepMerge(_cachedTenant.data, _setPath({}, path, value));
  const parsed = SettingsSchema.safeParse(candidate);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .filter((i) => i.path.join(".").startsWith(path))
      .map((i) => `${i.path.join(".")}: ${i.message}`);
    const err = new Error(
      `Invalid setting: ${messages.length ? messages.join("; ") : parsed.error.message}`,
    );
    err.status = 400;
    err.payload = { issues: parsed.error.issues };
    throw err;
  }

  // Leer estado actual para audit (before).
  const { rows: existing } = await _pool.query(
    "select value from wa_settings where key=$1 and scope=$2 and scope_id=$3",
    [path, scope, scopeId],
  );
  const before = existing[0]?.value ?? null;

  await _pool.query(
    `insert into wa_settings (key, scope, scope_id, value, updated_at, updated_by)
     values ($1, $2, $3, $4, now(), $5)
     on conflict (key, scope, scope_id) do update
       set value = excluded.value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`,
    [path, scope, scopeId, JSON.stringify(value), ctx.actor || null],
  );

  await _audit({
    operatorId: ctx.actor || null,
    action: "setting.update",
    target: `${scope}:${scopeId}:${path}`,
    before,
    after: value,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  // Refresh inmediato del cache (no esperar al NOTIFY round-trip).
  await _refreshTenant({ silent: true });
  return { ok: true, applied: getSetting(path) };
}

/** Borra un setting (vuelve al default del schema). */
export async function deleteSetting(path, ctx = {}) {
  if (!_pool) throw new Error("deleteSetting: waConfig not primed");
  const scope = ctx.scope || "tenant";
  const scopeId = ctx.scopeId || (scope === "tenant" ? "tenant" : null);
  const { rows } = await _pool.query(
    "delete from wa_settings where key=$1 and scope=$2 and scope_id=$3 returning value",
    [path, scope, scopeId],
  );
  if (rows.length) {
    await _audit({
      operatorId: ctx.actor || null,
      action: "setting.delete",
      target: `${scope}:${scopeId}:${path}`,
      before: rows[0].value,
      after: null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
  await _refreshTenant({ silent: true });
  return { ok: true, removed: rows.length > 0 };
}

/**
 * Toggle/update flag.
 * @param {string} key
 * @param {{ enabled?: boolean, rolloutPercent?: number, owner?: string, expiresAt?: Date|string|null, description?: string }} patch
 * @param {{ actor?: string, ip?: string, userAgent?: string }} ctx
 */
export async function setFlag(key, patch, ctx = {}) {
  if (!_pool) throw new Error("setFlag: waConfig not primed");
  if (!FLAG_KEYS.includes(key)) {
    const err = new Error(`Unknown flag: ${key}`);
    err.status = 400;
    throw err;
  }
  const before = _cachedTenant.flagsRaw?.[key] || null;
  const enabled = patch.enabled ?? before?.enabled ?? false;
  const rollout = Number(patch.rolloutPercent ?? before?.rollout_percent ?? 100);
  if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) {
    const err = new Error("rolloutPercent must be 0..100");
    err.status = 400;
    throw err;
  }
  const owner = patch.owner ?? before?.owner ?? null;
  const expiresAt = patch.expiresAt === undefined ? before?.expires_at : patch.expiresAt;
  const description = patch.description ?? before?.description ?? null;

  await _pool.query(
    `insert into wa_flags (key, enabled, rollout_percent, owner, expires_at, description, updated_at, updated_by)
     values ($1, $2, $3, $4, $5, $6, now(), $7)
     on conflict (key) do update
       set enabled = excluded.enabled,
           rollout_percent = excluded.rollout_percent,
           owner = excluded.owner,
           expires_at = excluded.expires_at,
           description = excluded.description,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`,
    [key, enabled, rollout, owner, expiresAt, description, ctx.actor || null],
  );
  await _audit({
    operatorId: ctx.actor || null,
    action: "flag.toggle",
    target: key,
    before,
    after: { enabled, rollout, owner, expiresAt, description },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  await _refreshTenant({ silent: true });
  return { ok: true, applied: { key, enabled, rolloutPercent: rollout } };
}

/** Lista todos los flags y settings con su valor efectivo + source. */
export function describeAll({ operatorId } = {}) {
  _ensureFresh();
  const desc = describeSchema();
  const cfg = getConfig({ operatorId });
  const settings = desc.settings.map((s) => {
    const value = _getPath(cfg, s.key);
    const source = _resolveSource(s.key, value, s.default, operatorId);
    return { ...s, value, source };
  });
  const flags = desc.flags.map((f) => {
    const raw = _cachedTenant.flagsRaw?.[f.key];
    return {
      ...f,
      enabled: raw?.enabled ?? f.default,
      rolloutPercent: raw?.rollout_percent ?? 100,
      owner: raw?.owner ?? null,
      expiresAt: raw?.expires_at ?? null,
      description: raw?.description ?? f.description,
      source: raw ? "db" : "default",
    };
  });
  return { flags, settings, drift: _cachedTenant.drift };
}

/** Para extension config endpoint — sólo namespace 'extension'. */
export function getExtensionConfig() {
  return getConfig().extension;
}

// ─── Internas ──────────────────────────────────────────────────────────

async function _refreshTenant({ silent }) {
  if (!_pool) return;
  try {
    const settingsRes = await _pool.query(
      "select key, value from wa_settings where scope='tenant' and scope_id='tenant'",
    );
    const dbValues = {};
    for (const row of settingsRes.rows) {
      dbValues[row.key] = row.value;
    }
    const envOverrides = _envBootstrapOverrides();
    const built = buildSettings(dbValues, envOverrides);
    if (built.drift.length && !silent) {
      logger().warn?.(
        { drift: built.drift },
        "[waConfig] settings drift — using fallback defaults",
      );
    }

    const flagsRes = await _pool.query(
      "select key, enabled, rollout_percent, owner, expires_at, description from wa_flags",
    );
    const flagsRaw = {};
    const flagsBool = {};
    for (const row of flagsRes.rows) {
      flagsRaw[row.key] = row;
      flagsBool[row.key] = row.enabled;
    }
    const flagsBuilt = buildFlags(flagsBool);
    _cachedTenant = {
      data: built.data,
      flags: flagsBuilt.data,
      flagsRaw,
      drift: [...built.drift, ...flagsBuilt.drift],
      fetchedAt: Date.now(),
    };

    // Operator overrides (cache global de overrides activos, refresh on demand).
    const opsRes = await _pool.query(
      "select key, scope_id, value from wa_settings where scope='operator'",
    );
    _cachedOperators.clear();
    for (const row of opsRes.rows) {
      const op = row.scope_id;
      if (!op) continue;
      const entry = _cachedOperators.get(op) || { overrides: {}, fetchedAt: Date.now() };
      _setPath(entry.overrides, row.key, row.value);
      _cachedOperators.set(op, entry);
    }
  } catch (e) {
    logger().error?.({ err: e }, "[waConfig] refresh failed");
    if (!_cachedTenant) {
      // Bootstrap fallback: schema defaults solos para no quebrar arranque.
      const built = buildSettings({}, _envBootstrapOverrides());
      const flagsBuilt = buildFlags({});
      _cachedTenant = {
        data: built.data,
        flags: flagsBuilt.data,
        flagsRaw: {},
        drift: [...built.drift, ...flagsBuilt.drift, `db_unreachable: ${e.message}`],
        fetchedAt: Date.now(),
      };
    }
  }
}

function _ensureFresh() {
  if (!_cachedTenant) {
    // Llamado antes de primeWaConfig: arrancar con defaults pelados.
    const built = buildSettings({}, _envBootstrapOverrides());
    const flagsBuilt = buildFlags({});
    _cachedTenant = {
      data: built.data,
      flags: flagsBuilt.data,
      flagsRaw: {},
      drift: [...built.drift, ...flagsBuilt.drift, "not_primed"],
      fetchedAt: Date.now(),
    };
    return;
  }
  if (Date.now() - _cachedTenant.fetchedAt > CACHE_TTL_MS) {
    // Stale-while-revalidate: devolvemos el cache actual y refresheamos en bg.
    _refreshTenant({ silent: true }).catch((e) =>
      logger().error?.({ err: e }, "[waConfig] bg refresh failed"),
    );
  }
}

async function _startListener() {
  if (!_pool) return;
  try {
    _listenerClient = await _pool.connect();
    _listenerClient.on("notification", (msg) => {
      if (msg.channel !== NOTIFY_CHANNEL) return;
      logger().debug?.({ payload: msg.payload }, "[waConfig] NOTIFY received");
      _refreshTenant({ silent: true }).catch((e) =>
        logger().error?.({ err: e }, "[waConfig] notify refresh failed"),
      );
    });
    _listenerClient.on("error", (err) => {
      logger().warn?.({ err }, "[waConfig] listener error, will reconnect");
      _restartListener();
    });
    await _listenerClient.query(`LISTEN ${NOTIFY_CHANNEL}`);
  } catch (e) {
    logger().warn?.({ err: e }, "[waConfig] could not start LISTEN, fallback to TTL polling");
  }
}

async function _restartListener() {
  try {
    if (_listenerClient) {
      _listenerClient.release(true);
      _listenerClient = null;
    }
  } catch { /* ignore */ }
  setTimeout(() => _startListener().catch(() => {}), 5000);
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
    logger().warn?.({ err: e }, "[waConfig] audit insert failed");
  }
}

/**
 * Bootstrap desde .env: leemos sólo las claves canónicas que ya existían
 * antes para retro-compat. Los nuevos valores van solo a wa_settings.
 */
function _envBootstrapOverrides() {
  const out = {};
  // Estas claves ya existían en .env antes del refactor — las honramos para
  // que un deploy fresh con DB vacía siga arrancando con la config esperada.
  if (process.env.WA_ENRICHER_ENABLED) {
    // No es un setting, pero ayuda al worker decisión inicial.
  }
  if (process.env.WA_ENRICHER_INTERVAL_MS) {
    out["enricher.intervalMs"] = Number(process.env.WA_ENRICHER_INTERVAL_MS);
  }
  if (process.env.WA_ENRICHER_BATCH_SIZE) {
    out["enricher.batchSize"] = Number(process.env.WA_ENRICHER_BATCH_SIZE);
  }
  if (process.env.WA_OUTBOUND_RATE_LIMIT) {
    out["outbound.ratePerMinPerChat"] = Number(process.env.WA_OUTBOUND_RATE_LIMIT);
  }
  if (process.env.WA_TTL_DAYS) {
    out["data.ttlDays"] = Number(process.env.WA_TTL_DAYS);
  }
  return out;
}

function _resolveSource(key, value, defaultValue, operatorId) {
  if (operatorId) {
    const op = _cachedOperators.get(operatorId);
    if (op && _hasPath(op.overrides, key)) return "operator";
  }
  // ¿el cache tiene esto distinto del default?
  if (JSON.stringify(value) !== JSON.stringify(defaultValue)) return "db_or_env";
  return "default";
}

function _getPath(obj, path) {
  if (!path) return obj;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function _setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

function _assertSettingWriteAllowed(path, ctx = {}) {
  const key = String(path || "").trim();
  const isAssistantControlPlaneSetting =
    key === "assistants" || key.startsWith("assistants.");
  if (!isAssistantControlPlaneSetting || ctx.allowAssistantControlPlane === true) {
    return;
  }
  const err = new Error(
    "assistants settings can only be changed through the admin assistants toggle endpoint",
  );
  err.status = 403;
  throw err;
}

function _hasPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}

function _deepMerge(a, b) {
  if (a === null || a === undefined) return b;
  if (b === null || b === undefined) return a;
  if (Array.isArray(a) || Array.isArray(b)) return b;
  if (typeof a !== "object" || typeof b !== "object") return b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = _deepMerge(a[k], v);
  }
  return out;
}

function _hash01(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 100);
}

// Para tests
export function _resetWaConfigForTests() {
  _pool = null;
  _logger = null;
  _cachedTenant = null;
  _cachedOperators.clear();
  if (_listenerClient) {
    try { _listenerClient.release(true); } catch { /* ignore */ }
    _listenerClient = null;
  }
}
