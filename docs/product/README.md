# docs/product — documentación del producto (auto-actualizable)

Dos documentos complementarios + sus PDF:

| Archivo | Qué es | Cómo se genera |
|---|---|---|
| `PRODUCT-OVERVIEW.md` | Recorrido **visual** de la UI (10 módulos + calculadora 11 pasos), con capturas. | `scripts/product-tour.spec.ts` (Playwright) |
| `SYSTEM-REFERENCE.md` | Referencia **técnica fiel**: rutas de API/SPA, integraciones, datos, auth, CI, agentes. **Derivado del código.** | `scripts/generate-system-reference.mjs` |
| `*.pdf` | Versión imprimible de cada uno. | `scripts/build-product-pdf.mjs` |

## Regenerar a mano

```bash
npm run docs:reference   # SYSTEM-REFERENCE.md (no requiere red ni login)
npm run docs:tour        # capturas + PRODUCT-OVERVIEW (requiere TOUR_SESSION_COOKIE para módulos con login)
npm run docs:pdf         # ambos PDF
npm run docs:product     # los tres pasos
```

## Actualización automática (diaria)

El workflow [`.github/workflows/product-docs.yml`](../../.github/workflows/product-docs.yml)
corre **todos los días (06:00 UTC)** y con *Run workflow* manual:

1. Regenera `SYSTEM-REFERENCE.md` desde el código (siempre, sin secrets).
2. Si hay credenciales (abajo), hace login no interactivo y corre el **tour completo**;
   si no, corre solo la **Calculadora** (pública) y deja los módulos con login como
   `[NOT OBSERVED — requiere auth]`.
3. Construye los PDF.
4. Abre/actualiza un **PR borrador** (`automation/product-docs`) con los cambios.

Las capturas con **datos reales de clientes** se guardan en `docs-private/`
(gitignored) y **nunca** se commitean ni entran al PDF.

## Privacidad (repo público)

- `docs-private/` y `docs/product/tour-metadata.json` están en `.gitignore`.
- Los endpoints registrados se **sanitizan** (teléfonos/emails/ids → `:id`).
- El tour **no** dispara envíos de WhatsApp/ML ni toca toggles de automatización.

## Credenciales para el tour autenticado en CI (one-time)

El login de la app es **Google OAuth** con cookie rotativa (no se puede guardar un
`bmc_sess` fijo). Para automatizarlo se guarda un **refresh-token de Google** de una
**cuenta de prueba** que sea usuaria BMC (idealmente con MFA desactivado).

`scripts/mint-tour-session.mjs` cambia ese refresh-token por un access-token de Google
y lo canjea en `POST /api/auth/google`, obteniendo un `bmc_sess` fresco por corrida.

### Cómo obtener el refresh-token (vía Google OAuth Playground)

1. En Google Cloud Console, en el OAuth Client de la app, agregá
   `https://developers.google.com/oauthplayground` como **Authorized redirect URI**.
2. Entrá a <https://developers.google.com/oauthplayground>, engranaje ⚙️ → *Use your own
   OAuth credentials* → pegá **Client ID** y **Client secret**.
3. En *Step 1*, autorizá los scopes `openid email profile` (los que usa la app).
4. Logueate con la **cuenta de prueba**.
5. En *Step 2*, *Exchange authorization code for tokens* → copiá el **Refresh token**.

### Secrets a cargar en GitHub (Settings → Secrets → Actions)

| Secret | Valor |
|---|---|
| `TOUR_GOOGLE_CLIENT_ID` | Client ID del OAuth de la app |
| `TOUR_GOOGLE_CLIENT_SECRET` | Client secret |
| `TOUR_GOOGLE_REFRESH_TOKEN` | Refresh token de la cuenta de prueba |

Sin estos secrets el workflow sigue corriendo, pero solo documenta la parte pública.
