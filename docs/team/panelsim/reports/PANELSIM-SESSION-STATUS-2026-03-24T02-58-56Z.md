# PANELSIM — Estado de sesión (full run)

**Generado (UTC):** 2026-03-24T02-58-56Z
**Repo Calculadora-BMC:** `/Users/matias/Panelin calc loca/Calculadora-BMC`

## Resumen ejecutivo

| Área | Estado |
|------|--------|
| Planillas / Google (ensure-panelsim-sheets-env) | omitido |
| Correo IMAP + reporte (panelsim-email-ready) | omitido |
| API local (http://127.0.0.1:3001) | HTTP health: **000** — curl no disponible o --no-start-api / API offline |
| MATRIZ vía API | GET /api/actualizar-precios-calculadora → **n/d** |
| UI Vite (:5173) | No se arranca en este script; usá `npm run dev` o `npm run dev:full` si necesitás la calculadora en navegador. |

## 1. Planillas y credenciales

_Omitido (--skip-sheets)._

## 2. Correo

_Omitido (--skip-email)._

## 3. API y Mercado Libre

- **Health:** `000`
- **GET /auth/ml/status** (extracto):

```json
(vacío o API no disponible)
```

- **GET /capabilities** (primeros caracteres):

```
(vacío o API no disponible)
```

## 4. Próximos pasos sugeridos

- **Calculadora en el navegador:** `npm run dev` (puerto 5173 típico) o `npm run dev:full` (API+Vite si preferís un solo comando y no usás el API ya levantado).
- **OAuth ML:** si `/auth/ml/status` indica sin token, abrí `/auth/ml/start` según `docs/ML-OAUTH-SETUP.md`.
- **Detener API** iniciada por este script: `kill $(cat /tmp/panelsim-session-api.pid)` (solo si se creó PID en esta corrida).

