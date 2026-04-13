# Revisión Mercado Libre — integración BMC + cuenta vendedor + roadmap

**Nombre de archivo:** fecha del primer informe (`2026-04-08`). **Estado de producción y evidencias HTTP:** seguir **§0** (canónico); no usar párrafos viejos sin fecha como verdad.

---

## §0. Estado canónico Cloud Run (Mercado Libre OAuth) — actualizar tras cada cambio relevante

**Regla anti-deriva:** cualquier agente o humano que cite “si ML está conectado en prod” debe **ejecutar primero** los comandos de §0.3 (o `npm run smoke:prod` si incluye la base deseada) y, si el resultado difiere de la tabla inferior, **actualizar esta sección** y una línea en [`PROJECT-STATE.md`](./PROJECT-STATE.md) bajo “Cambios recientes”. Objetivo: **no volver a documentar como actual** un snapshot obsoleto (p. ej. `hasTokens: false` de un día puntual).

### 0.1 Última verificación escrita (editar fecha + resultado)

| Campo | Valor |
|--------|--------|
| **Fecha verificación** | 2026-04-12 |
| **Base URL API** | `https://panelin-calc-642127786762.us-central1.run.app` |
| **`GET /health` → `hasTokens`** | `true` |
| **`GET /auth/ml/status`** | HTTP **200** (`ok: true`, `userId` presente; no pegar tokens ni refresh en docs) |
| **Notas** | La instantánea del **2026-04-08** (`hasTokens: false`, `/auth/ml/status` 404) fue **histórica**; el servicio puede cambiar tras OAuth + GCS (`docs/ML-OAUTH-SETUP.md` §7) y `npm run ml:cloud-run`. |

### 0.2 Triggers obligatorios de re-verificación (volver a §0.1)

- Deploy de Cloud Run que toque env vars (`--set-env-vars`, sustitución de servicio).
- Cambio de `TOKEN_ENCRYPTION_KEY`, bucket GCS, objeto `ml-tokens.enc`, o rotación de `ML_CLIENT_SECRET`.
- Incidente: `/ml/*` empieza a responder 401, CRM deja de recibir preguntas ML, o `/health` muestra `hasTokens: false`.

### 0.3 Comandos de comprobación (sin secretos en salida)

```bash
export BMC_API_BASE="${BMC_API_BASE:-https://panelin-calc-642127786762.us-central1.run.app}"
curl -sS "$BMC_API_BASE/health"
echo ""
curl -sS -o /dev/null -w "auth/ml/status HTTP %{http_code}\n" "$BMC_API_BASE/auth/ml/status"
```

Interpretación rápida: `hasTokens: true` y `auth/ml/status` **200** ⇒ token persistido accesible para el runtime. **404** en status ⇒ completar OAuth en navegador: `$BMC_API_BASE/auth/ml/start` (y callback registrado en Developers ML).

---

## 1. Resumen ejecutivo

El backend expone OAuth (`/auth/ml/*`), proxy a la API oficial (`/ml/*`), webhooks (`POST /webhooks/ml`) y sincronización de preguntas sin responder hacia `CRM_Operativo` ([`server/ml-crm-sync.js`](../../server/ml-crm-sync.js)). **Producción:** ver **§0** para el estado actual de tokens; no repetir aquí cifras que envejecen sin fecha.

La **cuenta vendedor** (Seller Center, reputación, conversiones) sigue requiriendo datos propios; la matriz de negocio en §3 queda para completar cuando haya exportes o capturas.

---

## 2. Capa técnica — integración en el repo (RAG)

| Área | Estado | Notas breves |
|------|--------|----------------|
| OAuth | Verde | [`server/index.js`](../../server/index.js) `/auth/ml/start`, callback, status. |
| Config | Ámbar | [`server/config.js`](../../server/config.js): revisar fallback de `ML_CLIENT_ID` vs solo env. |
| Token store | Verde | Archivo local o GCS + `TOKEN_ENCRYPTION_KEY` — ver [`docs/ML-OAUTH-SETUP.md`](../../docs/ML-OAUTH-SETUP.md) §7. |
| Cliente ML | Verde | [`server/mercadoLibreClient.js`](../../server/mercadoLibreClient.js): refresh, retries 429/5xx. |
| Webhook | Ámbar | Solo topic `questions` dispara sync CRM; token opcional pero recomendado en prod. |
| CRM sync | Ámbar | Alinear si hace falta `site_id`/`api_version` en `syncUnansweredQuestions` con `GET /ml/questions` (validar vs API ML). |

---

## 3. Capa cuenta vendedor (negocio)

Completar cuando haya datos: reputación, catálogo, conversión, postventa, cumplimiento. Lista de evidencias sugeridas: export reputación, muestra de publicaciones, SLA interno de respuesta a preguntas.

---

## 4. Roadmap (tres oleadas)

1. **Fundamentos (0–2 semanas):** OAuth estable, GCS, webhook verificado, `ml:verify` en checklist post-deploy (§0.2).
2. **Operación (2–6 semanas):** SLA preguntas, fichas y precios vs matriz, plantillas alineadas con [`ml-crm-sync.js`](../../server/ml-crm-sync.js).
3. **Crecimiento (6–12 semanas):** experimentos de catálogo; coordinar con canal Shopify para no duplicar esfuerzo.

---

## 5. Anexos

- Guía OAuth y persistencia: [`docs/ML-OAUTH-SETUP.md`](../../docs/ML-OAUTH-SETUP.md).
- Código: [`server/index.js`](../../server/index.js), [`server/mercadoLibreClient.js`](../../server/mercadoLibreClient.js), [`server/ml-crm-sync.js`](../../server/ml-crm-sync.js).
- **Snapshot histórico 2026-04-08 (solo contexto):** en esa fecha, `GET /health` reportó `hasTokens: false` y `/auth/ml/status` → 404; **no** usar como estado actual — usar **§0**.
