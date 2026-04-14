# Mercado Libre — snapshot operativo (API producción)

**Fecha del snapshot:** 2026-04-12  
**Fuente de datos:** respuestas HTTP públicas del servicio **`https://panelin-calc-642127786762.us-central1.run.app`** (`GET /health`, `/auth/ml/status`, `/ml/users/me`, `/ml/users/:id`, `/ml/questions`, `/ml/listings`, `/ml/orders`, `/ml/items/:id`). **Sin** tokens ni secretos en este documento.

**Revalidar estado técnico:** seguir [`ML-ACCOUNT-REVIEW-2026-04-08.md`](./ML-ACCOUNT-REVIEW-2026-04-08.md) **§0.3** tras deploys o cambios de credenciales.

---

## 1. Conexión y backend

| Comprobación | Resultado (snapshot) |
|----------------|----------------------|
| `GET /health` | `ok: true`, `hasTokens: true`, `mlTokenStoreOk: true`, `hasSheets: true`, `missingConfig: []` |
| `GET /auth/ml/status` | HTTP **200**, `ok: true`, OAuth activo para `userId` **179969104** |
| Lectura API ML | Respuestas JSON coherentes en rutas `/ml/*` usadas abajo |

---

## 2. Cuenta vendedor (resumen API)

| Campo | Valor (snapshot) |
|--------|------------------|
| Tienda / nickname | **BMC URUGUAY** |
| Razón social (API) | **METALOG SAS** |
| País | **UY** |
| Tags API (extracto) | `normal`, `eshop`, `messages_as_seller`, `user_product_seller` |
| Reputación (`seller_reputation.level_id`) | **`5_green`** |
| Experiencia (`seller_experience`) | **`ADVANCED`** |
| Métricas **365 días** (objeto `metrics` del usuario) | Ventas completadas **21**; reclamos **0**; tiempo de manejo demorado **0**; cancelaciones **0** (según payload devuelto) |
| Objeto `transactions` (histórico agregado en respuesta) | Total **22**; completadas **21**; canceladas **1**; bloque de calificaciones numérico acotado en el JSON (no sustituye el panel completo de ML) |

**Nota:** métricas de **visitas por publicación**, **Mercado Ads** y **detalle fino de reputación** no se extrajeron aquí; conviene cruzar con **Seller Center** cuando haga falta marketing fino.

---

## 3. Preguntas sin responder

`GET /ml/questions?status=UNANSWERED&limit=50` → **`total: 2`**.

| ID pregunta | Ítem | Tema (resumen) |
|-------------|------|----------------|
| 13561044239 | MLU880882776 | Babeta adosar: **dobleces / altura ~25 cm** y **material** (requisito de arquitecto). |
| 13562386880 | MLU445615830 | Cobertura **8 m lineales × 3 m**; **Lomas de Solymar**; coordinación de **traída**. |

**Acción recomendada:** responder con SLA corto; revisar sync a **CRM_Operativo** / webhook si el flujo operativo depende de planilla.

---

## 4. Catálogo (activas)

- `GET /ml/listings?status=active&limit=20&offset=0` → **`paging.total`: 41** publicaciones activas (primera página = 20 IDs listados).

**Muestra de publicación** (`GET /ml/items/MLU880882776`): título *Babeta Adosar - Isodec Isopanel*; `listing_type_id`: **gold_special**; moneda **USD**; `sold_quantity` **0** en el payload (revisar conversión y ficha en ML si sigue sin ventas).

---

## 5. Órdenes (muestra)

`GET /ml/orders?limit=5` devolvió resultados (orden de ejemplo con cierre **2025-04-14**, feedback de compra positivo). Sirve para confirmar que **búsqueda de órdenes** vía proxy responde; **no** es un informe de facturación ni de últimos 30 días.

---

## 6. Próximos pasos sugeridos

1. Responder las **2** preguntas `UNANSWERED`.  
2. En Seller Center: tiempo de respuesta, publicaciones con baja conversión, campañas si aplica.  
3. Tras cambios de infra ML: actualizar **§0** en [`ML-ACCOUNT-REVIEW-2026-04-08.md`](./ML-ACCOUNT-REVIEW-2026-04-08.md) y, si este snapshot queda obsoleto, generar uno nuevo con fecha **`ML-OPERATIVO-SNAPSHOT-YYYY-MM-DD.md`**.

---

*Documento de trabajo operativo; no contiene datos personales de compradores ni contenido de pagos más allá de lo estrictamente necesario para la muestra de órdenes.*
