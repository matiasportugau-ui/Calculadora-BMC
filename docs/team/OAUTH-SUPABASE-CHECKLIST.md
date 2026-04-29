# Checklist OAuth / `redirect_uri_mismatch` / `origin_mismatch`

Errores comunes antes de tener **Google / Facebook Login** vía **Supabase Auth**:

- **`redirect_uri_mismatch`** (OAuth 2): la URL enviada al proveedor **no coincide** con la whitelist del **client OAuth** en Google Cloud o Meta.
- **`Error 400: origin_mismatch` / relacionado**: origen del navegador no permitido en la **Web application** de Google, o **Site URL** en Supabase no coincide con el front desplegado.

## 1. Supabase Dashboard

**Authentication → URL Configuration**

- **Site URL:** producción (ej. `https://calculadora-bmc.vercel.app`)
- **Redirect URLs:** incluir **todas** las URLs de retorno que usará el cliente:
  - `http://localhost:5173/**` (Vite dev)
  - `https://calculadora-bmc.vercel.app/**`
  - Previews si se prueba login ahí: `https://*.vercel.app/**` (syntax según docs Supabase actuales)

**Authentication → Providers**

- Habilitar **Google** / **Facebook** copiando **Client ID / Secret** desde las consolas de proveedor.
- Los redirect URIs que **Supabase muestra** al configurar OAuth (p. ej. `https://<project-ref>.supabase.co/auth/v1/callback`) deben estar **añadidos** en:

## 2. Google Cloud Console

**APIs & Services → Credentials → OAuth 2.0 Client ID (tipo Web)**

- **Authorized JavaScript origins:** origins de tu SPA (localhost:5173, dominio Vercel, sin path).
- **Authorized redirect URIs:** debe incluir el callback **`https://<project-ref>.supabase.co/auth/v1/callback`** (exacto como indica Supabase para Google provider).

Sin esto Gmail login falla antes de llegar al callback de tu app.

## 3. Meta (Facebook) para desarrolladores

- **Facebook Login → Settings:** Valid OAuth Redirect URIs debe incluir el mismo callback Supabase `.supabase.co/auth/v1/callback`.
- App en modo **Live** con permisos aprobados según uso.

## 4. Variables de entorno en Vercel

Cuando exista cliente Supabase en el frontend:

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Los secretos **`service_role`** solo en Cloud Run / server, **nunca** en `VITE_*`.

## 5. Verificación manual

1. Abrir SPA en cada origen soportado e iniciar OAuth de prueba.
2. Tras éxito, sesión visible en Supabase **Authentication → Users**.
3. Si falla, capturar URL completa de error en barra de direcciones del proveedor (contiene `redirect_uri=`).

## Referencias

- [Supabase: Social Login](https://supabase.com/docs/guides/auth/social-login)
- [Google OAuth 2 Web client](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
