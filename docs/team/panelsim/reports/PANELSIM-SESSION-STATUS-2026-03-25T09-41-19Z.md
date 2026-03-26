# PANELSIM — Estado de sesión (full run)

**Generado (UTC):** 2026-03-25T09-41-19Z
**Repo Calculadora-BMC:** `/Users/matias/Panelin calc loca/Calculadora-BMC`

## Resumen ejecutivo

| Área | Estado |
|------|--------|
| `.env` (env:ensure si falta) | omitido (--quick) |
| Planillas / Google (ensure-panelsim-sheets-env) | omitido |
| Correo IMAP + reporte (panelsim-email-ready) | omitido |
| API local (http://127.0.0.1:3001) | HTTP health: **000** — curl no disponible o --no-start-api / API offline |
| MATRIZ vía API | GET /api/actualizar-precios-calculadora → **n/d** |
| ML → CRM sync (preguntas pendientes) | omitido (API no disponible) |
| ML OAuth verify (`ml:verify` / verify-ml-oauth) | omitido (--quick) |
| Programa + compass (`project:compass`) | omitido (--quick) |
| Canales + smoke prod + humanGate (`channels:automated`) | omitido (--quick) |
| UI Vite (:5173) | No se arranca en este script; usá `npm run dev` o `npm run dev:full` si necesitás la calculadora en navegador. |

## 0. Crear `.env` si falta (`npm run env:ensure`)

_omitido (--quick)._

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

## 4. ML → CRM sync

```text
(sin salida)
```

## 5. Bootstrap automático (Mercado Libre + programa + canales)

Modo **completo** (default): `ml:verify` (`scripts/verify-ml-oauth.sh` con `BMC_API_BASE=http://127.0.0.1:3001`), `project:compass`, `channels:automated` (incluye smoke a prod). Modo **--quick**: omitido.

### 5.1 ML OAuth verify

_omitido (--quick)._

### 5.2 project:compass (últimas ~120 líneas)

_omitido (--quick)._

### 5.3 channels:automated (JSON completo)

_omitido (--quick)._

## 6. Próximos pasos sugeridos

- **Calculadora en el navegador:** `npm run dev` (puerto 5173 típico) o `npm run dev:full` (API+Vite si preferís un solo comando y no usás el API ya levantado).
- **OAuth ML:** si `/auth/ml/status` indica sin token, abrí `/auth/ml/start` según `docs/ML-OAUTH-SETUP.md`.
- **Canales humanos (cm-0/1/2):** ver `humanGate` en el JSON de §5.3 y `docs/team/HUMAN-GATES-ONE-BY-ONE.md`.
- **Sesión más rápida:** `npm run panelsim:session -- --quick` (sin compass, sin smoke prod, sin env:ensure al inicio).
- **Detener API** iniciada por este script: `kill $(cat /tmp/panelsim-session-api.pid)` (solo si se creó PID en esta corrida).

