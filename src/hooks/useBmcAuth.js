// Sugar wrapper around BmcAuthProvider's context.
import { useBmcAuthContext } from "../contexts/bmcAuthContext.js";

export function useBmcAuth() {
  return useBmcAuthContext();
}

export default useBmcAuth;

/**
 * Hook variant that surfaces the module map for RBAC checks.
 * level ∈ {'none','read','write','admin'}.
 */
export function useModuleGrants() {
  const { modules, role, plan_tier } = useBmcAuthContext();
  return {
    modules,
    role,
    plan_tier,
    has(module, minLevel = "read") {
      const order = { admin: 3, write: 2, read: 1, none: 0 };
      const have = modules?.[module] || "none";
      return (order[have] || 0) >= (order[minLevel] || 0) || role === "superadmin";
    },
  };
}
