/** Paid white-label entitlement. ADR-001: plan_tier === 'paid'. plus ≠ white-label. */

export const PLAN_TIERS = Object.freeze(["base", "plus", "paid"]);

export function isPaidTier(user) {
  return String(user?.plan_tier || "") === "paid";
}

export function canUseWhiteLabel(user) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  return isPaidTier(user);
}

/** After requireUser. 403 plan_required if not paid (superadmin bypass). */
export function assertPaid(req, res) {
  if (canUseWhiteLabel(req.user)) return true;
  res.status(403).json({ ok: false, error: "plan_required" });
  return false;
}

export function requirePaid(requireUserFn) {
  return (req, res, next) => {
    requireUserFn()(req, res, () => {
      if (!assertPaid(req, res)) return;
      next();
    });
  };
}
