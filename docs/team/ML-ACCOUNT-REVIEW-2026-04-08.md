# Revisión Mercado Libre — integración BMC + cuenta vendedor + roadmap

**Fecha:** 2026-04-08  
**Alcance:** Capa técnica (repo `Calculadora-BMC` + muestra runtime), capa negocio (checklist y datos pendientes), roadmap en tres oleadas.

---

## 1. Resumen ejecutivo

El backend expone OAuth (`/auth/ml/*`), un proxy a la API oficial (`/ml/*`), webhooks (`POST /webhooks/ml`) y sincronización de preguntas sin responder hacia la pestaña `CRM_Operativo` en Google Sheets (`server/ml-crm-sync.js`). El cliente HTTP reintenta en 429/5xx, refresca token ante 401 y persiste tokens en archivo local o GCS según entorno.

**Runtime (muestra 2026-04-08):** la API local no respondió en `:3001` (`npm run ml:verify` falló en `GET /health`). En producción (`https://panelin-calc-642127786762.us-central1.run.app`) `GET /health` devolvió `hasTokens: false`, `missingConfig: []`, `hasSheets: true`; `GET /auth/ml/status` respondió **404** (sin token OAuth persistido en el almacén del servicio). Es decir: configuración mínima de ML parece cargada en Cloud Run, pero **no hay sesión OAuth activa** en ese entorno para llamadas autenticadas a `/ml/*` ni para que el webhook dispare sync con credenciales válidas.

**Cuenta vendedor (Seller Center):** no se dispuso de capturas, exportes ni acceso en vivo para esta corrida. La sección 3 deja una matriz vacía para completar y lista explícita de evidencias a aportar.

---

## 2. Capa técnica — integración en el repo (RAG)

Leyenda: **Verde** = alineado con buenas prácticas o suficiente para el alcance actual; **Ámbar** = mejorable o riesgo operativo; **Rojo** = bloqueante si el objetivo es ML end-to-end en prod.

| Área | Estado | Notas y acciones |
|------|--------|------------------|
| OAuth (`/auth/ml/start`, `/auth/ml/callback`, `/auth/ml/status`) | Verde | Estado CSRF en memoria (`stateTtlMs` 10 min). Callback intercambia código y persiste tokens. |
| Config ML (`server/config.js`) | Ámbar | `ML_CLIENT_ID` tiene **fallback hardcodeado** si falta env (`742811153438318`). Conviene depender solo de `.env`/Secret Manager para evitar drift entre entornos. Redirect prod/dev y `ML_SITE_ID` (default `MLU`) documentados en `docs/ML-OAUTH-SETUP.md`. |
| Almacén de tokens (`server/tokenStore.js`) | Verde | Cifrado AES-256-GCM con `TOKEN_ENCRYPTION_KEY` (64 hex). GCS en Cloud Run si bucket configurado; advertencias si falta clave válida. |
| Cliente API (`server/mercadoLibreClient.js`) | Verde | Refresh con mutex (`refreshInFlight`), retry exponencial hasta 5s, timeout `ML_HTTP_TIMEOUT_MS` (default 15s), `resolveSellerId` vía JWT o `GET /users/me`. |
| Proxy `/ml/questions` | Verde | Filtra query a claves permitidas; inyecta `seller_id`, `api_version=4`, `site_id` desde config. |
| Proxy `/ml/orders` | Verde | Similar; alinea `seller` con vendedor del token. |
| Listados y edición | Verde | `GET /ml/listings`, `GET/PATCH /ml/items/:id`, `POST /ml/items/:id/description` (POST/PUT según error de descripción). |
| Respuestas a preguntas | Verde | `POST /ml/questions/:id/answer` normaliza moneda vía `normalizeMlAnswerCurrencyText` (`server/lib/mlAnswerText.js`) por restricciones de ML. |
| Webhook `POST /webhooks/ml` | Ámbar | Token opcional vía `verify_token` query, `x-webhook-token` o `Authorization`. Buffer en memoria (`maxWebhookEvents` 250). **Solo** si `topic === "questions"` y hay `BMC_SHEET_ID` se llama `syncUnansweredQuestions` (fire-and-forget). Otros topics no disparan lógica adicional en código. |
| ML → CRM (`server/ml-crm-sync.js`) | Ámbar | Dedup por `Q:<id>` en Observaciones; categoría automática; alerta desajuste precio ML vs matriz local; `generateResponse` + `analyzeQuotationGaps`. **Posible alineación:** `GET /questions/search` aquí no envía `site_id` ni `api_version` mientras que el proxy en `server/index.js` sí — validar con API ML si en algún sitio falla búsqueda sin `site_id`. |
| Manifiesto `/capabilities` | Ámbar | `server/agentCapabilitiesManifest.js` no enumera rutas `/ml/*` ni `/auth/ml/*`; los agentes descubren ML por documentación. Opcional: añadir bloque `mercadolibre` al manifiesto. |
| Seguridad operativa | Ámbar | Webhook sin token configurado acepta POST (si `WEBHOOK_VERIFY_TOKEN` vacío). En prod, definir token y URL en Developers ML. |

### Brechas técnicas deseadas (backlog corto)

1. OAuth completado en Cloud Run con tokens en GCS (`ML_TOKEN_GCS_BUCKET`, `TOKEN_ENCRYPTION_KEY`) y callback URL registrada en [developers.mercadolibre.com.uy](https://developers.mercadolibre.com.uy).
2. Alinear query de `syncUnansweredQuestions` con la misma forma que `/ml/questions` (`site_id`, `api_version`) tras verificación contra documentación ML actual.
3. Extender webhooks a topics útiles (p. ej. mensajes postventa, órdenes) solo si el negocio lo prioriza; hoy solo `questions` sincroniza CRM.
4. Quitar o documentar explícitamente el default de `ML_CLIENT_ID` en código.

---

## 3. Capa cuenta vendedor (negocio)

### 3.1 Matriz por bloque (completar con datos de Seller Center)

| Bloque | Qué está bien | Qué falta / riesgo | Prioridad |
|--------|----------------|-------------------|-----------|
| Identidad y confianza | *Pendiente datos* | *Pendiente datos* | — |
| Catálogo (títulos, atributos, fotos, envío) | *Pendiente datos* | *Pendiente datos* | — |
| Conversión y tráfico | *Pendiente datos* | *Pendiente datos* | — |
| Postventa (mensajes, devoluciones, reclamos) | *Pendiente datos* | *Pendiente datos* | — |
| Cumplimiento y moderaciones | *Pendiente datos* | *Pendiente datos* | — |

### 3.2 Evidencias a aportar para cerrar esta capa

- Captura o export: **reputación**, tiempo de respuesta, cancelaciones, reclamos (últimos 90 días si existe).
- Lista o export de **publicaciones activas** con visitas/ventas si ML lo ofrece en tu nivel de cuenta.
- Muestra de **5 publicaciones** (URL) para revisión manual de ficha, precio y envío.
- Regla interna actual de **SLA de respuesta** a preguntas (objetivo en horas).

### 3.3 Quick wins propuestos (genéricos, hasta validar con datos)

1. Completar OAuth en el backend de producción y un smoke manual: `GET /auth/ml/status` → 200.
2. Fijar `WEBHOOK_VERIFY_TOKEN` y URL de notificación en la app de Developers; verificar un evento en `GET /webhooks/ml/events`.
3. Responder **todas** las preguntas `UNANSWERED` en menos de 24 h (impacto directo en métricas de cuenta).
4. Revisar títulos de publicaciones de panel: espesor, familia de producto y “m²” donde aplique (SEO interno ML).
5. Verificar que precios publicados coincidan con matriz interna (el CRM ya marca desajuste en Observaciones cuando aplica).

### 3.4 Iniciativas medianas (6 semanas horizonte)

1. Pasada de **atributos obligatorios** en todas las fichas (evitar moderaciones y mejorar calidad de visita).
2. **Kit de respuestas** alineado con `generateResponse` + KB [`panelsim/knowledge/ML-RESPUESTAS-KB-BMC.md`](./panelsim/knowledge/ML-RESPUESTAS-KB-BMC.md) y [`ML-PLATAFORMA-BUENAS-PRACTICAS-BMC.md`](./panelsim/knowledge/ML-PLATAFORMA-BUENAS-PRACTICAS-BMC.md).
3. Revisión de **envíos y tiempos** (Mercado Envíos / logística propia) vs competencia en categorías clave.

---

## 4. Roadmap de mejora y optimización

| Oleada | Plazo | Objetivo | Dueño sugerido | Criterio de hecho |
|--------|--------|----------|----------------|-------------------|
| Fundamentos | 0–2 semanas | OAuth + tokens persistentes en prod; webhook verificado; `npm run ml:verify` en checklist de deploy | DevOps / quien gestione Cloud Run + Developers ML | `/health` → `hasTokens: true` tras login; al menos un webhook `questions` recibido y sync sin error en logs |
| Operación | 2–6 semanas | SLA preguntas; fichas y precios alineados; uso sistemático del CRM ML | Comercial + operaciones | Reducción de `UNANSWERED` antiguas; menos filas “Pendiente revisión precio” |
| Crecimiento | 6–12 semanas | Optimización de catálogo y experimentos; evaluar endpoints ML adicionales; coordinar con canal **Shopify** para no duplicar esfuerzo | Producto / marketing | Experimentos documentados; decisión explícita ML vs Shopify por tipo de SKU |

---

## 5. Anexos

### 5.1 Comandos y URLs útiles

```bash
# API local (desde la raíz del repo)
npm run start:api
npm run ml:verify
```

- OAuth (navegador): `http://localhost:3001/auth/ml/start` (o base pública + `/auth/ml/start`).
- Salud: `GET /health`
- Estado token: `GET /auth/ml/status`
- Listados: `GET /ml/listings?limit=10&offset=0` (requiere token válido).

Variables: ver [`.env.example`](../../.env.example) y guía canónica [`docs/ML-OAUTH-SETUP.md`](../../docs/ML-OAUTH-SETUP.md).

### 5.2 Archivos de código relevantes

- [`server/index.js`](../../server/index.js) — rutas `/auth/ml/*`, `/ml/*`, `/webhooks/ml`
- [`server/mercadoLibreClient.js`](../../server/mercadoLibreClient.js) — OAuth y `requestWithRetries`
- [`server/ml-crm-sync.js`](../../server/ml-crm-sync.js) — sync a `CRM_Operativo`
- [`server/config.js`](../../server/config.js) — variables `ML_*`, Sheets, webhook

### 5.3 Evidencia runtime (2026-04-08)

- Local: `npm run ml:verify` → `FAIL: GET /health → HTTP 000` (API no levantada en el momento de la corrida).
- Prod: `GET .../health` → `ok: true`, `hasTokens: false`, `missingConfig: []`, `hasSheets: true`.
- Prod: `GET .../auth/ml/status` → HTTP **404** (sin token almacenado).

---

*Documento generado según plan de revisión ML; actualizar la sección 3 cuando haya datos de Seller Center o exportes.*
