# ChatGPT Agent Mode Prompt — Google Drive API Setup for Panelin BMC

> Copy everything below this line and paste it into ChatGPT agent mode.

---

You are a DevOps setup assistant. Guide me step-by-step through configuring Google Drive API OAuth credentials for a web application called **Panelin BMC Calculadora**. I already have a Google Cloud project. Be extremely precise: tell me exactly what to click, what to type, what to select, and what value to copy. No filler. No alternatives. One path, exact steps.

## Context you need to know

| Key | Value |
|---|---|
| GCP Project ID | `chatbot-bmc-live` |
| Application type | Client-side JavaScript (SPA, Vite + React) |
| OAuth scope needed | `https://www.googleapis.com/auth/drive.file` |
| API to enable | Google Drive API |
| Auth library | Google Identity Services (GIS) — already loaded via `<script src="https://accounts.google.com/gsi/client">` |
| Dev origin (Vite) | `http://localhost:5173` |
| Production origin | The Cloud Run service URL (I will provide it, or we find it with `gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)'`) |
| Env var to set | `VITE_GOOGLE_CLIENT_ID=<the-client-id>` in a `.env` file at project root |
| Purpose | Users sign in with Google, app creates a folder "Panelin BMC Cotizaciones" in their Drive, saves PDF + .bmc.json files per quotation |

## What I need you to walk me through (in this exact order)

### PHASE 1 — Enable the Google Drive API

1. Navigate to the API Library for my project.
   - Direct URL: `https://console.cloud.google.com/apis/library?project=chatbot-bmc-live`
2. Search for "Google Drive API" in the search bar.
3. Click the **Google Drive API** card.
4. If it says "ENABLE", click it. If it already says "MANAGE", skip — it's already enabled.
5. Confirm I see a green checkmark or "API enabled" confirmation.

### PHASE 2 — Configure the OAuth Consent Screen

Before creating credentials, the consent screen must be configured. This is what users see when they click "Iniciar sesión con Google" in the app.

1. Navigate to: `https://console.cloud.google.com/apis/credentials/consent?project=chatbot-bmc-live`
2. If prompted to choose User Type:
   - Select **External** (allows any Google account to sign in).
   - Click **CREATE**.
3. Fill the "OAuth consent screen" form with these exact values:

| Field | Value |
|---|---|
| App name | `Panelin BMC Calculadora` |
| User support email | *(my Google account email — the dropdown)* |
| App logo | *(skip — leave empty)* |
| App domain — Application home page | *(leave empty for now)* |
| App domain — Privacy policy | *(leave empty for now)* |
| App domain — Terms of service | *(leave empty for now)* |
| Authorized domains | *(leave empty for now)* |
| Developer contact email | *(my Google account email)* |

4. Click **SAVE AND CONTINUE**.
5. On the **Scopes** screen:
   - Click **ADD OR REMOVE SCOPES**.
   - In the filter/search box, type: `drive.file`
   - Check the box next to `https://www.googleapis.com/auth/drive.file` — description: "See, edit, create, and delete only the specific Google Drive files you use with this app".
   - **DO NOT** select `drive` (full access) or `drive.readonly`. Only `drive.file`.
   - Click **UPDATE** at the bottom of the scope panel.
   - Click **SAVE AND CONTINUE**.
6. On the **Test users** screen:
   - Click **+ ADD USERS**.
   - Add my email address (the one I'll test with).
   - Click **ADD**.
   - Click **SAVE AND CONTINUE**.
7. On the **Summary** screen, click **BACK TO DASHBOARD**.

**Important**: While the app is in "Testing" status, only the test users added above can sign in. This is fine for development. To allow any Google user, publish the app later (Phase 5).

### PHASE 3 — Create the OAuth 2.0 Client ID

1. Navigate to: `https://console.cloud.google.com/apis/credentials?project=chatbot-bmc-live`
2. Click the blue **+ CREATE CREDENTIALS** button at the top.
3. Select **OAuth client ID** from the dropdown.
4. Fill the form with these exact values:

| Field | Value |
|---|---|
| Application type | **Web application** |
| Name | `Panelin BMC Frontend` |

5. Under **Authorized JavaScript origins**, click **+ ADD URI** and add these two URIs (one at a time):
   - `http://localhost:5173`
   - *(If I have a production URL, add it too. Otherwise skip for now.)*

6. **Authorized redirect URIs** — **leave empty**. GIS token model does not use redirect URIs.

7. Click **CREATE**.

8. A modal appears with:
   - **Your Client ID**: a string like `123456789-abcdefg.apps.googleusercontent.com`
   - **Your Client Secret**: (not needed — ignore it)

9. **Copy the Client ID** — this is the only value I need.

10. Click **OK** to close the modal.

### PHASE 4 — Configure the environment variable

1. In my project root (`Calculadora-BMC/`), create or edit the `.env` file:

```
VITE_GOOGLE_CLIENT_ID=paste-the-client-id-here
```

2. If the dev server is running (`npm run dev`), stop it and restart. Vite only reads `.env` on startup.

3. Verify it works:
   - Open `http://localhost:5173` in the browser.
   - Click the **Drive** button in the header bar.
   - Click **Iniciar sesión con Google**.
   - The Google sign-in popup should appear showing "Panelin BMC Calculadora" wants to access "See, edit, create, and delete only the specific Google Drive files you use with this app".
   - Sign in with the test user email added in Phase 2.
   - The panel should show "Conectado" status.

### PHASE 5 — Publish for production (when ready)

When I want real users (not just test users) to use Google Drive:

1. Go to: `https://console.cloud.google.com/apis/credentials/consent?project=chatbot-bmc-live`
2. Click **PUBLISH APP**.
3. Since the scope `drive.file` is not a sensitive/restricted scope, Google may approve automatically or require a brief review.
4. Add the production Cloud Run URL to the OAuth client's Authorized JavaScript origins:
   - Go to `https://console.cloud.google.com/apis/credentials?project=chatbot-bmc-live`
   - Click on **Panelin BMC Frontend** in the OAuth 2.0 Client IDs list.
   - Under Authorized JavaScript origins, click **+ ADD URI**.
   - Add the Cloud Run URL (e.g., `https://panelin-calc-xxxxxxxx-uc.a.run.app`).
   - Click **SAVE**.

## Troubleshooting checklist

If the sign-in popup doesn't appear:
- Open browser DevTools Console → look for `[GDrive] No VITE_GOOGLE_CLIENT_ID configured` → means the env var is missing or dev server wasn't restarted.
- Look for `[GDrive] Google Identity Services not loaded` → the GIS script in index.html failed to load (ad blocker? network issue?).

If sign-in fails with "Access blocked":
- The user is not in the test users list (Phase 2 step 6).
- Or the consent screen wasn't configured (Phase 2).

If sign-in succeeds but saving fails with 403:
- Google Drive API not enabled (Phase 1).
- Wrong scope configured in consent screen.

If sign-in succeeds but saving fails with 401:
- Token expired — the app handles refresh automatically, but check browser console for errors.

## Summary of what this achieves

After completing Phases 1–4:
- Users click "Drive" → sign in with Google → click "Guardar cotización actual en Drive"
- The app creates a folder `Panelin BMC Cotizaciones` in the user's Google Drive
- Each quotation gets a subfolder containing:
  - `Cotización BMC-2026-XXXX — ClientName.pdf` (the visual PDF)
  - `BMC-2026-XXXX.bmc.json` (the recoverable project file)
- Users can browse saved quotations, click "Cargar" to reload into the calculator, modify, and re-save
- All files are in the user's own Google Drive — no server storage needed

---

**Start with Phase 1. After each phase, confirm what you see on screen so I can verify before moving to the next phase.**
