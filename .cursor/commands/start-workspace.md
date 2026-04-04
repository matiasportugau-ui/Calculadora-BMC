---
description: Start Workspace — install npm deps, ensure .env, print local/prod links (Calculadora BMC)
---

You are in the **Calculadora-BMC** repo for [Calculadora BMC](https://calculadora-bmc.vercel.app).

1. **Run** from the repository root (terminal):

   ```bash
   npm run workspace:start
   ```

2. **After it finishes**, summarize for the user:
   - Production app: `https://calculadora-bmc.vercel.app`
   - Full local stack: `npm run dev:full` or `./run_full_stack.sh` → API `http://localhost:3001`, Vite `http://localhost:5173`, health `http://localhost:3001/health`
   - If `.env` was just created from `.env.example`, remind them to fill credentials (Google/ML/API tokens as needed for their task).

3. **Optional** (only if they need Sheets/MATRIZ or channel checks): mention `npm run panelsim:env`, `npm run smoke:prod`, and `npm run ml:verify` (with API running).

Do not delete or overwrite an existing `.env`; `env:ensure` only creates one when missing.
