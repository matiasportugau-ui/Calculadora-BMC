-- Seed: Add "workspace" module to identity.modules
-- Panelin Workspace platform store (customers/quotes/sessions/files).
-- Code gate: ALL_MODULES + requireUser({ module: "workspace" }) in server/routes/workspace.js
-- Role defaults: operator+ get write; comprador does not.
INSERT INTO identity.modules (module, display_name, category, created_at)
VALUES ('workspace', 'Panelin Workspace', 'platform', now())
ON CONFLICT (module) DO NOTHING;
