// Artifact stub for src/hooks/useBmcAuth.js
// Returns a fixed authenticated identity so the calculator can mount
// without a real <BmcAuthProvider>. No network calls.

const ARTIFACT_IDENTITY = Object.freeze({
  status: "authenticated",
  loading: false,
  user: Object.freeze({
    id: "artifact-design",
    email: "design@bmc.local",
    name: "Diseño BMC",
  }),
  role: "superadmin",
  plan_tier: "design",
  modules: Object.freeze({}),
  isAuthenticated: true,
  signIn: async () => ARTIFACT_IDENTITY,
  signOut: async () => {},
  refresh: async () => ARTIFACT_IDENTITY,
});

export function useBmcAuth() {
  return ARTIFACT_IDENTITY;
}

export default useBmcAuth;

export function useModuleGrants() {
  return {
    modules: ARTIFACT_IDENTITY.modules,
    role: ARTIFACT_IDENTITY.role,
    plan_tier: ARTIFACT_IDENTITY.plan_tier,
    has: () => true,
  };
}
