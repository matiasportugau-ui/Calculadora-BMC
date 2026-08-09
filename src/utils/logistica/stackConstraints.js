/**
 * Physical stacking constraints for BMC truck load.
 *
 * Hard rule: never place panels on top of profiles / accessory bultos.
 * Profiles may sit on panels, on other accessories, or on the other row —
 * and may be separated from the same stop's panels.
 */

/**
 * @param {object} [pkg]
 * @returns {boolean}
 */
export function isPanelPkg(pkg) {
  if (!pkg) return false;
  if (pkg.kind === "panel") return true;
  if (pkg.kind === "accessory") return false;
  const tipo = String(pkg.tipo || "").toUpperCase();
  if (tipo === "ACCESORIOS") return false;
  // Default built panel packages have kind "panel"; treat unknown non-acc as panel
  return pkg.kind == null || pkg.kind === "panel";
}

/**
 * @param {object} [pkg]
 * @returns {boolean}
 */
export function isAccessoryPkg(pkg) {
  if (!pkg) return false;
  if (pkg.kind === "accessory") return true;
  return String(pkg.tipo || "").toUpperCase() === "ACCESORIOS";
}

/**
 * Bultos that cannot support a panel above them (perfiles / soft accessory loads).
 * Conservative: all accessory packages until subtypes exist.
 * @param {object} [pkg]
 * @returns {boolean}
 */
export function isProfileSupportPkg(pkg) {
  return isAccessoryPkg(pkg);
}

/**
 * Can `upper` be stacked directly on top of `lower` (same stack)?
 * Length/height checks are separate (cargoPacking).
 * @param {object} [upper]
 * @param {object} [lower]
 * @returns {boolean}
 */
export function canPlaceOnTop(upper, lower) {
  if (!upper) return false;
  if (!lower) return true; // empty stack / ground
  if (isPanelPkg(upper) && isProfileSupportPkg(lower)) return false;
  return true;
}

/**
 * Whether package may be stacked on this stack's current top item.
 * @param {object} pkg
 * @param {{ items?: object[] }} [stack]
 * @returns {boolean}
 */
export function canPlaceOnStack(pkg, stack) {
  const items = stack?.items;
  if (!Array.isArray(items) || !items.length) return true;
  const top = items[items.length - 1];
  return canPlaceOnTop(pkg, top);
}

/**
 * Human message for the hard rule (UI).
 */
export const PANEL_ON_PROFILE_RULE_ES =
  "Regla: paneles nunca sobre perfiles. Los perfiles van arriba de la carga o en la otra fila.";

export const PANEL_ON_PROFILE_REJECT_ES =
  "No se puede poner paneles sobre perfiles. Mové el bulto de perfil arriba o a la otra fila.";

/**
 * @typedef {{ code: string, message: string, upperKey?: string, lowerKey?: string, stackId?: string, row?: number }} StackViolation
 */

/**
 * Audit placed packages: panel must not sit on accessory in the same stack.
 * Uses stackId + layerIndex / zBase when available; falls back to row+x overlap.
 *
 * @param {object[]} [placed]
 * @returns {{ ok: boolean, violations: StackViolation[] }}
 */
export function validatePlacedStacks(placed = []) {
  const list = Array.isArray(placed) ? placed.filter(Boolean) : [];
  /** @type {StackViolation[]} */
  const violations = [];

  /** @type {Map<string, object[]>} */
  const byStack = new Map();
  for (const p of list) {
    const sid = p.stackId || `R${Number(p.row) + 1}-x${Number(p.xStart).toFixed(2)}`;
    if (!byStack.has(sid)) byStack.set(sid, []);
    byStack.get(sid).push(p);
  }

  for (const [stackId, items] of byStack) {
    const ordered = [...items].sort((a, b) => {
      const la = a.layerIndex != null ? Number(a.layerIndex) : Number(a.zBase) || 0;
      const lb = b.layerIndex != null ? Number(b.layerIndex) : Number(b.zBase) || 0;
      if (la !== lb) return la - lb;
      return (Number(a.zBase) || 0) - (Number(b.zBase) || 0);
    });
    for (let i = 1; i < ordered.length; i += 1) {
      const lower = ordered[i - 1];
      const upper = ordered[i];
      if (!canPlaceOnTop(upper, lower)) {
        violations.push({
          code: "panel_on_profile",
          message: PANEL_ON_PROFILE_REJECT_ES,
          upperKey: upper.stableKey || upper.id,
          lowerKey: lower.stableKey || lower.id,
          stackId,
          row: upper.row ?? lower.row,
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Soft score bias: accessories prefer taller existing stacks (top of load).
 * Lower is better (same convention as pickCandidateScore).
 * @param {object} candidate
 * @param {object} pkg
 * @returns {number[]}
 */
export function accessoryPlacementBias(candidate, pkg) {
  if (!isAccessoryPkg(pkg)) return [0];
  if (candidate?.type === "existing") {
    // Prefer higher stacks (more negative → better when prepended as lower-is-better... we use 0/1)
    // Return single component: 0 for tall, 1 for short — caller sorts ascending
    const h = Number(candidate.stackHeightAfter) || 0;
    // Invert: taller after place is better → smaller score
    return [-(h * 1000) | 0];
  }
  // New stack is OK (other side / separate pile) but slightly worse than topping panels
  return [1];
}
