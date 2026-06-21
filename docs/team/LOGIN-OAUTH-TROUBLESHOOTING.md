# Google OAuth Login Troubleshooting

## Current Issue (2026-06-19)

**Error:** "El popup de Google se cerró sin completar el login. Si no lo cerraste vos, suele ser que el origen actual no está autorizado en el cliente OAuth..."

**Root Cause:** The production origin `https://calculadora-bmc.vercel.app` is **NOT authorized** in Google Cloud Console's OAuth 2.0 Client credentials.

## Quick Fix (Production)

To enable login on `https://calculadora-bmc.vercel.app`:

1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Find the OAuth 2.0 Client ID (Web application) matching `VITE_GOOGLE_CLIENT_ID` in Vercel
3. Click **Edit**
4. Add to **"Authorized JavaScript origins"**:
   - `https://calculadora-bmc.vercel.app`
   - `http://localhost:5173` (local dev)
   - `http://localhost:3001` (local API)
5. **Save**
6. Wait 2-5 minutes for Google's cache to refresh
7. Test login at https://calculadora-bmc.vercel.app

## Immediate Workaround (Development)

While waiting for Google Cloud Console configuration, use **Dev Mode**:

1. Open the login page at https://calculadora-bmc.vercel.app
2. Click the **"Dev Mode: OFF"** button at the bottom
3. Button turns green: **"🔧 Dev Mode: ON"**
4. Landing page disappears → access calculator immediately
5. Dev mode persists in browser localStorage

**Dev Mode disables OAuth authentication requirement** for testing and development purposes.

**To disable:** Click the green "Dev Mode: ON" button again.

## Technical Details

### Code Changes

**File:** `src/components/LandingPage.jsx`

- Added `devMode` state persisted to localStorage key `bmc.devmode.bypass`
- Modified auth check: `if (isAuthenticated || devMode) return null;`
- Added toggle button to UI for easy dev mode control
- Dev mode has no effect on production behavior once Google OAuth is configured

### Authentication Flow

1. **Normal Flow (Production):**
   - User lands on `/` → sees LandingPage
   - Clicks "Iniciar con Google"
   - Google OAuth popup opens (requires authorized origin)
   - On success: user logged in, calculator shows

2. **Dev Mode Flow (Testing):**
   - User lands on `/` → sees LandingPage + "Dev Mode: OFF" button
   - Clicks Dev Mode button
   - Dev mode stored in localStorage
   - Landing page hidden → calculator shows immediately
   - No Google OAuth popup needed

### Frontend Environment Variables

- `VITE_GOOGLE_CLIENT_ID` — OAuth Client ID (public, configured in Vercel env)
- `FRONTEND_BASE_URL` — Bounce target for OAuth callbacks (default: https://calculadora-bmc.vercel.app)

**Configured in Vercel:**
```
VITE_GOOGLE_CLIENT_ID=<real-client-id>.apps.googleusercontent.com
```

### Related Files

- `src/contexts/BmcAuthProvider.jsx` — Authentication context
- `src/utils/googleDrive.js` — GIS (Google Identity Services) client
- `server/routes/authGoogle.js` — Backend OAuth endpoint

## When to Remove Dev Mode

Once Google Cloud Console is configured with authorized origins:

1. Users won't need Dev Mode anymore
2. Normal "Iniciar con Google" button will work
3. Dev Mode button can stay in code (no impact when Google OAuth works)
4. Or remove it entirely once confirmed working in production

## Next Steps

1. **Configure Google Cloud Console** (required for production)
   - Add authorized JavaScript origins
   - Wait for cache refresh
   - Test login

2. **Push changes** to production
   - Commit includes radio widget + dev mode bypass
   - Vercel auto-deploys on push to main

3. **Verify** login works on production
   - Test with real Google login
   - Disable Dev Mode in browser
   - Confirm normal OAuth flow works

## References

- [Google Cloud Console](https://console.cloud.google.com)
- [Google Identity Services Documentation](https://developers.google.com/identity/gis/web)
- `docs/team/runbooks/google-oauth-troubleshooting.md` (if exists)
