# Banco — libro de movimientos bancarios METALOG

**Propósito:** columna C del modelo de tres columnas de conciliación DGI ↔ facturación ↔ banco
(ver [`DGI-CLAUDE-INGESTA.md`](./DGI-CLAUDE-INGESTA.md), Paso 2). Capa de validación de
trazabilidad cobros/pagos — **nunca** sustituto de CFE.

**UI:** [`/hub/finanzas`](/hub/finanzas) → pestaña **Banco** (`/hub/finanzas/banco`). La ruta
legacy `/hub/banco` redirige al mismo lugar. Grant módulo `banco`, nivel `read`; en producción
también requiere desbloqueo con contraseña de módulo (12h por sesión).

**Cash Flow:** pestaña hermana en `/hub/finanzas/cash-flow` — KPIs, cola de clasificación y
agregados mensuales/por categoría (moneda nativa por cuenta; sin FX unificado en Calculadora).

**API:** `/api/banco/*` ([`server/routes/banco.js`](../../../server/routes/banco.js)).
**Datos:** Postgres (`DATABASE_URL`), migraciones en `banco-package/migrations/` →
`npm run banco:migrate` (ledger `banco_schema_migrations`, mismo patrón que traktime/wa).

**Taxonomía fija:** claves en [`cashFlowTaxonomy.js`](../../../src/components/hub/finanzas/cashFlowTaxonomy.js)
(`ingreso_venta`, `egreso_operativo`, `transferencia_interna`, …). La UI usa `<select>`, no texto libre.
Valores legacy se muestran como opción `(legacy)` hasta remapear.

---

## Formatos de import soportados

| Formato | Origen | Notas |
|---------|--------|-------|
| **XLS/XLSX «Saldos y Movimientos»** | e-BROU → exportar movimientos | **Camino recomendado.** Fechas como seriales Excel, preámbulo con Nº de Cuenta y Moneda → la cuenta se auto-detecta/auto-crea. |
| **CSV** | export legado «Consulta de Movimientos» o re-export de Sheets | Fechas texto **D/M/YYYY** (es-UY); importes EU (`1.185,08`) y US (`2,000.00`). Decimales partidos sin comillas se reparan; filas irreparables se reportan en `errors`, nunca se descartan en silencio. |
| PDF | e-BROU | **Fuera de alcance** — exportar el mismo rango como XLS. |

Parser: [`server/lib/bancoStatementParser.js`](../../../server/lib/bancoStatementParser.js)
(validado contra un export real de e-BROU: 464 movimientos, 0 errores).

## Dedup (idempotencia)

Hash sha256 por movimiento sobre la tupla normalizada
(`fecha|descripción|documento|asunto|dependencia|débito|crédito`) **+ índice de ocurrencia**
dentro del archivo. Consecuencias:

- Re-importar el mismo extracto → 0 duplicados insertados.
- Extractos con **rangos de fechas solapados** → la intersección se omite sola.
- Dos movimientos idénticos legítimos el mismo día (p. ej. dos retiros iguales) → se conservan ambos.

Unique en DB: `(account_id, dedup_hash)`.

## Clasificación

Cada movimiento acepta **`categoria`** (clave de taxonomía fija — ver SDD
[`SDD-finanzas-hub.md`](../SDD-finanzas-hub.md) §6) y **`entidad`** ∈
`bmc | expreso_este | personal | mixta`.

**Reglas automáticas** (`banco_rules`): substring case/acentos-insensible sobre
descripción + asunto, por prioridad ascendente. Se aplican al importar (solo a filas nuevas)
y bajo demanda con `POST /api/banco/rules/apply` (solo a movimientos con `categoria IS NULL`).

Semilla operativa: [`scripts/seed-banco-rules-from-taxonomy.mjs`](../../../scripts/seed-banco-rules-from-taxonomy.mjs)
(porta patrones alineados al ledger local metalog — sin acoplamiento runtime).

## Endpoints

| Método/Ruta | Auth | Descripción |
|-------------|------|-------------|
| `GET /api/banco/health` | — | 200 / 503 (sin DB) |
| `GET /api/banco/accounts` | user | Cuentas + conteo/rango de movimientos |
| `POST /api/banco/accounts` · `PATCH /:id` | admin | Alta / renombrar / archivar |
| `POST /api/banco/import` | admin | `{ file_base64 \| csv, filename?, account_id?, dry_run? }` → `{ imported, duplicates, rules_applied, errors, warnings }`. Sin `account_id` usa la cuenta detectada en el extracto (la crea si no existe). `dry_run` devuelve preview sin insertar. Límite 2 MB (body JSON global 1 MB — para un año de movimientos, partir el rango). |
| `GET /api/banco/movements` | user | Filtros: `account_id, from, to, q, categoria, entidad, tipo=debito\|credito, sin_clasificar=1, limit≤500, offset`. Devuelve `movements + total + sums{debito,credito}` |
| `PATCH /api/banco/movements/:id` | admin | `categoria / entidad / notas` |
| `GET /api/banco/summary` | user | Agregados `group=mes\|categoria\|entidad` (+ mismos filtros de cuenta/fechas) — insumo directo de conciliación mensual |
| `GET /api/banco/cash-flow` | user + unlock | KPIs + monthly + by_category (`account_id` requerido si hay monedas mixtas) |
| `GET /api/banco/unlock-status` | user | Estado de desbloqueo del módulo (sin middleware `finLocked`) |
| `POST /api/banco/unlock` | user | `{ password }` → desbloqueo 12h en `identity.sessions` |
| `POST /api/banco/lock` | user | Cierra desbloqueo de la sesión actual |
| `GET/POST /api/banco/rules` · `PATCH /:id` · `POST /rules/apply` | user lee / admin muta | Reglas de clasificación |

Semántica de errores (convención del proyecto): 400/401/403/404, **503 si DB no disponible, nunca 500** por infra.

## Tests

- [`tests/banco-parser.test.js`](../../../tests/banco-parser.test.js) — parser offline.
- [`tests/banco-routes.test.js`](../../../tests/banco-routes.test.js) — contrato sin DB (503/401).
- [`tests/banco-cash-flow.test.js`](../../../tests/banco-cash-flow.test.js) — agregados cash-flow (PR #693).

Ambos en `npm run test:api` (cubiertos por `gate:local`).
