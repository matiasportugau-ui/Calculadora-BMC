# Handoff — 2026-10-01 WhatsApp Cloud API register

**Current branch**: `feat/panelin-front-idle-closeout` (ahead 1, behind origin/main 2)

**Uncommitted changes**: pre-existing dirty tree (storefront voice, admin cotizaciones, `waValidate.js`, PROJECT-STATE, and others). This session did not edit them. New file: this handoff only.

**Blockers**:
- Human: log into Meta in the Chrome window already open on the Facebook login page. Session cookies exist in the Default profile but developers.facebook.com redirected to login. Do not paste the password into chat.
- Machine: `WHATSAPP_ACCESS_TOKEN` in Doppler `bmc-backend/prd` and GSM `chatbot-bmc-live` is 25 characters. Graph `v22.0` returns OAuth 190 "Malformed access token". Phone number ID on file: `857133467479731`. App `chatbo2` / `4144439239205293`. Webhook target remains `https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp`.
- Numbers (user, 2026-10-01): company WhatsApp on the API is **092663245** (`+598 92 663 245`, same as storefront `59892663245`). **091667611** (`+598 91 667 611`) is only the registration contact, not the customer line.
- Human after login: verification for the company line goes to **092663245**. Use **091667611** only if Meta asks for a registration / admin phone. Then the 6-digit WhatsApp two-step PIN. Agent stops at the code screen.

**Next prompt to resume exactly**:
"Continue from HANDOFF-2026-10-01-wa-api-register.md. I am logged into Meta. Connect company WhatsApp 092663245 (+598 92 663 245) to app 4144439239205293. Use 091667611 only as the registration contact. Store the new token only in Doppler/GSM, never in chat."

**Key files touched**:
- `docs/team/HANDOFF-2026-10-01-wa-api-register.md` (this file)
- Read only: `docs/team/WHATSAPP-META-E2E.md`, `docs/team/HUMAN-GATES-ONE-BY-ONE.md` (cm-0)

**Current state reference**:
- Chrome front tab is Facebook login, next hop was WhatsApp settings for app `4144439239205293`.
- Playwright MCP browser profile is locked by another process (`mcp-chrome-dcb4bdd`); use the user's Google Chrome.
- Do not retry Graph with the 25-character token.
