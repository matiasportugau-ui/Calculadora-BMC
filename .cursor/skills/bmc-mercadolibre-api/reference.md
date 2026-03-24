# Referencia rápida — Mercado Libre en Calculadora-BMC

## Comandos npm (raíz del repo)

| Script | Descripción |
|--------|-------------|
| `npm run start:api` | API Node (`server/index.js`), puerto 3001 por defecto |
| `npm run env:ensure` | `cp .env.example .env` si no existe `.env` |
| `npm run ml:local` | `concurrently`: ngrok → 3001 + API |
| `npm run ml:local:api` | Solo API, sin ngrok |
| `npm run ml:verify` | `scripts/verify-ml-oauth.sh` contra `http://localhost:3001` |

## Variables de entorno (ML)

Ver [.env.example](../../.env.example): `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI_DEV`, `ML_AUTH_BASE` (default UY), `ML_API_BASE`, `ML_SITE_ID` (default MLU), `TOKEN_ENCRYPTION_KEY`, almacenamiento de tokens.

## URLs útiles

- Panel Developers UY: https://developers.mercadolibre.com.uy  
- Panel ngrok local: http://127.0.0.1:4040  
- Guía repo: [docs/ML-OAUTH-SETUP.md](../../docs/ML-OAUTH-SETUP.md)

## Errores frecuentes (recordatorio)

- **redirect_uri mismatch:** cadena idéntica en portal ML, `.env` y `authUrl` (`/auth/ml/start?mode=json`).
- **Puerto ocupado:** un solo proceso en 3001; `lsof -i :3001` y reiniciar.
- **403 órdenes / caller.id:** permisos de la aplicación en Developers + OAuth de nuevo tras cambiar scopes.
- **invalid_query_string (preguntas):** servidor actualizado; parámetros `seller_id`, `api_version=4`, `site_id` (ver `server/index.js`).
