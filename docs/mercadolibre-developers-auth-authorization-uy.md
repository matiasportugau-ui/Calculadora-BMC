# Mercado Libre Developers — Autenticación y autorización (Uruguay) + uso en Calculadora BMC

Documento para **agentes y humanos**: resume el modelo OAuth 2.0, enlaza la **fuente oficial**, y **mapea** este repositorio (`server/`, `.env`, scripts).

**Última revisión de fuente oficial:** 2026-03-24 (contenido de la página de autenticación alineado con snapshot en [developers.mercadolibre.com.uy — Autenticación y autorización](https://developers.mercadolibre.com.uy/es_ar/autenticacion-y-autorizacion); la doc indica “Última actualización 29/12/2025”).

---

## 1. Validación de la información (resumen que compartiste)

Lo siguiente es **correcto** en líneas generales y coincide con la documentación oficial:

| Tema | Veredicto |
|------|-----------|
| OAuth 2.0, **Authorization Code** (server-side) | Correcto |
| `authorization_code` → intercambio por `access_token` vía **POST** `https://api.mercadolibre.com/oauth/token` con **body** `application/x-www-form-urlencoded` | Correcto |
| Uso del token: header `Authorization: Bearer …` en llamadas a `https://api.mercadolibre.com/...` | Correcto |
| **Refresh token**: `grant_type=refresh_token`; el refresh es de **uso único** y devuelve uno nuevo; access ~**6 horas** | Correcto (la doc oficial detalla reglas del refresh) |
| **redirect_uri** debe coincidir **exactamente** con lo registrado; URL **sin información variable** en el redirect (datos dinámicos → usar `state`) | Correcto |
| **Dominio de autorización depende del país** (ej. Uruguay ≠ Argentina) | Correcto |
| Riesgos: **state** (CSRF), **no exponer** `client_secret`, reutilizar `code`/refresh inválido | Correcto |
| Usuario que autoriza debe ser **administrador** (no operador) → error `invalid_operator_user_id` si es colaborador | Correcto (doc oficial) |

**Ajuste importante:** en ejemplos de la documentación a veces aparece `https://auth.mercadolibre.com.ar/authorization` porque el ejemplo es **Argentina**. Para **Uruguay** el host de autorización debe ser **`https://auth.mercadolibre.com.uy`** (este repo usa por defecto `ML_AUTH_BASE` en [server/config.js](../server/config.js)).

**Lo que este archivo NO es:** una transcripción literal “página por página” de *todo* el portal (Primeros pasos, Permisos, Validador de publicaciones, IPs, Error 403, etc.). Para eso están las URLs oficiales en la sección 7. Sí incluye el **contenido sustancial** de la página **Autenticación y autorización** según la fuente enlazada.

---

## 2. Pasos operativos en **este** repo (confirmados)

Estos son los pasos que venimos usando; **siguen siendo válidos** si el stack es el del conector en `server/index.js`:

1. **App en Developers (UY):** [developers.mercadolibre.com.uy](https://developers.mercadolibre.com.uy) → Mis aplicaciones → **URLs de redirección** = misma cadena que usará el servidor (incluido `https://` y path `/auth/ml/callback` si usás ngrok).
2. **`.env`** en la raíz del repo: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`; si el redirect no es el default localhost: `ML_REDIRECT_URI_DEV=https://TU_HOST/auth/ml/callback`.
3. **Levantar API** (y ngrok si hace falta HTTPS): `npm run ml:local` o `npm run start:api` (puerto **3001** por defecto).
4. **OAuth en navegador:** `GET /auth/ml/start` (o la misma ruta bajo tu URL https de ngrok). El backend ya usa **state** y el intercambio **authorization_code** → token.
5. **Verificar:** `npm run ml:verify` con la API en marcha.
6. **Probar API ML:** `GET /ml/users/me`, `GET /ml/questions` (el servidor completa `seller_id` / `api_version` según implementación actual).

Guía detallada y troubleshooting: [ML-OAUTH-SETUP.md](ML-OAUTH-SETUP.md).

---

## 3. Mapeo técnico — Calculadora BMC

| Concepto ML | En este repo |
|-------------|----------------|
| Authorization URL | `ml.buildAuthUrl(state)` → `GET /auth/ml/start` redirige a `config.mlAuthBase` + query ([server/mercadoLibreClient.js](../server/mercadoLibreClient.js)) |
| Uruguay auth host por defecto | `ML_AUTH_BASE` default `https://auth.mercadolibre.com.uy` ([server/config.js](../server/config.js)) |
| Token endpoint | `POST https://api.mercadolibre.com/oauth/token` (misma base API global) |
| Callback | `GET /auth/ml/callback` ([server/index.js](../server/index.js)) |
| Almacenamiento de tokens | Archivo `.ml-tokens.enc` o GCS según `ML_TOKEN_STORAGE` ([server/tokenStore.js](../server/tokenStore.js)) |
| Refresh automático | [server/mercadoLibreClient.js](../server/mercadoLibreClient.js) `ensureValidToken` / `refreshTokens`; al guardar se **fusionan** campos que ML no reenvía en el refresh |

---

## 4. Dominios de autorización por país (multi-sitio)

La **API** suele ser la misma base: `https://api.mercadolibre.com`. Lo que **cambia** es el host de **login/autorización**:

| País | Host típico (authorization) |
|------|-------------------------------|
| Uruguay | `https://auth.mercadolibre.com.uy` |
| Argentina | `https://auth.mercadolibre.com.ar` |
| Brasil | `https://auth.mercadolivre.com.br` |

Listado de sitios: [API sites](https://api.mercadolibre.com/sites).

---

## 5. Contenido oficial — Autenticación y autorización (síntesis fiel)

*Fuente: [Autenticación y autorización (UY)](https://developers.mercadolibre.com.uy/es_ar/autenticacion-y-autorizacion).*

### 5.1 Enviar access token por header

En cada llamada a la API, enviar:

`Authorization: Bearer <ACCESS_TOKEN>`

Ejemplo:

```bash
curl -H 'Authorization: Bearer APP_USR-…' \
  https://api.mercadolibre.com/users/me
```

### 5.2 Autenticación y autorización (definiciones)

- **Autenticación:** verificar identidad (en ML, método basado en contraseñas en el flujo del usuario).
- **Autorización:** definir qué recursos y operaciones están permitidas (lectura / lectura y escritura).
- Mecanismo: **OAuth 2.0**, grant type **Authorization Code (server side)**.

### 5.3 Server side — Flujo resumido

1. Redirigir a Mercado Libre.
2. La plataforma autentica al usuario.
3. Página de autorización.
4. **POST** para intercambiar el código por access token.
5. Uso del access token para llamadas a la API.

### 5.4 Realizando la autorización

**Conectar usuario**

- Se puede usar **usuario de test** (ver doc de pruebas enlazada desde el portal).
- El usuario que otorga permisos debe ser **administrador**; si es operador/colaborador → `invalid_operator_user_id`.
- Eventos que pueden invalidar tokens antes de tiempo: cambio de contraseña, actualización del Client Secret, revocación de permisos, **inactividad ~4 meses** sin llamadas a `https://api.mercadolibre.com/`.

**Importante:** `redirect_uri` debe coincidir **exactamente** con lo registrado; **no** puede contener información variable. Para datos extra usar **`state`**.

**URL de autorización (ejemplo en doc con dominio AR; sustituir por el país correcto):**

`https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=$APP_ID&redirect_uri=$YOUR_URL&code_challenge=…&code_challenge_method=…`

**Parámetros:** `response_type=code`, `redirect_uri` (exacto), `client_id` (APP ID). Opcional: `state`. Opcional/obligatorio según app: **PKCE** (`code_challenge`, `code_challenge_method`, y en el token exchange `code_verifier`).

**Callback:** `https://YOUR_REDIRECT_URI?code=$SERVER_GENERATED_AUTHORIZATION_CODE` (y `state` si se envió).

**Error “Lo sentimos, la aplicación no puede conectarse a tu cuenta”:** revisar `redirect_uri`, validez de tokens/grants, que el seller sea cuenta principal, datos pendientes de validación o bloqueos (ver enlaces en la doc oficial).

### 5.5 Cambiar code por token

`POST https://api.mercadolibre.com/oauth/token`  
`Content-Type: application/x-www-form-urlencoded`

Parámetros típicos: `grant_type=authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri`; si aplica PKCE: `code_verifier`.

Respuesta incluye entre otros: `access_token`, `token_type`, `expires_in`, `scope`, `user_id`, `refresh_token`.

### 5.6 Refresh token

- Access token ~**6 horas**.
- `grant_type=refresh_token` con `client_id`, `client_secret`, `refresh_token`.
- Solo válido el **último** refresh token; **un solo uso** por refresh; al usarlo se obtiene un **nuevo** par access/refresh.

### 5.7 Referencia de códigos de error (lista oficial resumida)

Incluye entre otros: `invalid_client`, `invalid_grant`, `invalid_scope`, `invalid_request`, `unsupported_grant_type`, `forbidden` (403), `local_rate_limited` (429), `unauthorized_client`, `unauthorized_application`. Detalle y causas en la [página oficial](https://developers.mercadolibre.com.uy/es_ar/autenticacion-y-autorizacion).

### 5.8 Error `invalid_grant`

Mensaje típico: authorization code o refresh token expirado, ya usado, revocado, flujo incorrecto, etc. Ver sección “Error Invalid Grant” en la doc oficial.

---

## 6. Otras secciones del portal (no transcritas aquí)

Para **transcripción o lectura completa** de cada área, abrí la documentación oficial y navegá el menú:

- Primeros pasos / Crear aplicación  
- Permisos funcionales  
- Gestiona tus aplicaciones  
- Realiza pruebas  
- Validador de publicaciones  
- Buenas prácticas  
- Consideraciones de diseño  
- Gestionar IPs  
- Error 403  

Índice general: [Developers Uruguay — documentación](https://developers.mercadolibre.com.uy).

---

## 7. Referencias rápidas

| Recurso | URL |
|---------|-----|
| Autenticación y autorización (UY) | https://developers.mercadolibre.com.uy/es_ar/autenticacion-y-autorizacion |
| Recomendaciones de autorización y token (seguridad) | https://developers.mercadolibre.com.uy/es_ar/recomendaciones-de-autorizacion-y-token |
| Error 403 | https://developers.mercadolibre.com.uy/es_ar/error-403 |
| Guía OAuth en este repo | [ML-OAUTH-SETUP.md](ML-OAUTH-SETUP.md) |

---

## 8. Nota para indexación (agentes)

- **Keywords:** OAuth 2.0, Authorization Code, Uruguay, `auth.mercadolibre.com.uy`, `api.mercadolibre.com`, refresh token, redirect_uri, state, PKCE, invalid_grant, Calculadora BMC, `/auth/ml/start`, `/auth/ml/callback`.
