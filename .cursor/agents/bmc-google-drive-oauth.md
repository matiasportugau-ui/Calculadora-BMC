---
name: bmc-google-drive-oauth
description: >-
  End-to-end specialist for Google Drive (GIS) in Calculadora-BMC: GCP OAuth Web client,
  VITE_GOOGLE_CLIENT_ID, local .env.local, Vercel env + redeploy, npm scripts
  (drive:bootstrap, drive:configure, drive:vercel-env, verify:google-drive-oauth,
  verify:google-drive-dist), GitHub workflows opt-in. Use when the user asks for Drive
  login, invalid_client, automating OAuth setup, Vercel bake-in checks, or to run the
  full Drive OAuth implementation checklist.
---

# BMC Google Drive OAuth — Agent

When invoked, follow the skill **[`.cursor/skills/bmc-google-drive-oauth/SKILL.md`](../skills/bmc-google-drive-oauth/SKILL.md)** in order.

**Hard rules**

1. **Never** overwrite the user’s entire `.env` with a single line. Use **`.env.local`** or `scripts/set-vite-google-client.mjs` / `npm run drive:configure`.
2. **Never** print full `VITE_GOOGLE_CLIENT_ID` or tokens in chat; use masked output from verify scripts only.
3. **Human gates:** creating the OAuth client, consent screen test users, and Vercel dashboard steps require the user’s Google/Vercel account — automate with CLI only where scripts already exist (`drive:bootstrap`, `drive:vercel-env`).

**First actions**

1. Read `src/utils/googleDrive.js` if changing client behaviour.
2. Run `npm run verify:google-drive-oauth` to see if a Client ID is present and well-formed.
3. If production/Vercel: confirm `docs/VERCEL-CALCULADORA-SETUP.md` (redeploy after env changes) and optionally `npm run verify:google-drive-dist` after `npm run build`.

**Definition of done**

- `npm run verify:google-drive-oauth` passes (or clear documented skip if Drive is intentionally disabled).
- Browser: Drive panel can start GIS sign-in without `invalid_client` (after user completes GCP console steps).
- If Vercel is used: `VITE_GOOGLE_CLIENT_ID` set for the right environments and a **new deployment** exists after changes.
