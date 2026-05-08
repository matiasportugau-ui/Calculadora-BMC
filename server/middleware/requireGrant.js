// ═══════════════════════════════════════════════════════════════════════════
// requireGrant — thin wrapper for module-scoped RBAC.
// ───────────────────────────────────────────────────────────────────────────
// Wraps `requireUser({ module, minLevel })` from identityAuth.js with two
// ergonomic shortcuts the Clientes 360 routers (and future modules) rely on:
//
//   1) `requireGrant('clientes', 'read'|'write'|'admin')` — single call.
//   2) `requireGrant.read('clientes')` etc. — curried form for readability.
//
// Levels follow identityAuth.js LEVEL_RANK: admin > write > read > none.
// Roles follow ROLE_RANK: superadmin > admin > operator > comprador.
// superadmin always passes regardless of module/level (superadmin bypass).
//
// This file intentionally exposes NO new auth surface — it forwards to
// identityAuth.requireUser. The reason it exists is to keep router code
// concise and to give CODEOWNERS a single hook point if module-specific
// rules (row-level ownership, etc.) need to be added later.
// ═══════════════════════════════════════════════════════════════════════════

import { requireUser } from "../lib/identityAuth.js";

const LEVELS = new Set(["read", "write", "admin"]);

/**
 * @param {string} module       Module key: 'clientes', 'wa', 'ml', ...
 * @param {'read'|'write'|'admin'} [minLevel='read']
 * @param {{ optional?: boolean }} [opts]
 * @returns {import('express').RequestHandler}
 */
export function requireGrant(module, minLevel = "read", opts = {}) {
  if (!module || typeof module !== "string") {
    throw new TypeError("requireGrant: module is required");
  }
  if (!LEVELS.has(minLevel)) {
    throw new TypeError(
      `requireGrant: minLevel must be one of read|write|admin (got '${minLevel}')`,
    );
  }
  return requireUser({ module, minLevel, optional: !!opts.optional });
}

requireGrant.read   = (module, opts) => requireGrant(module, "read",  opts);
requireGrant.write  = (module, opts) => requireGrant(module, "write", opts);
requireGrant.admin  = (module, opts) => requireGrant(module, "admin", opts);

export default requireGrant;
