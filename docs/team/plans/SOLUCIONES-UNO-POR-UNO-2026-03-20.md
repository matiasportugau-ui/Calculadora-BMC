# Plan por solución — avance uno por uno

**Fecha:** 2026-03-20  
**Regla:** No pasar a la siguiente pista hasta cerrar **criterio de hecho** de la actual (o documentar explícitamente “bloqueado: …”).

**Orden propuesto:** Pista **1 → 2 → 3** son base técnica/validación; **4** es planilla (humano); **5** seguridad (riesgo); **6–8** negocio/sync.

---

## Pista 1 — Línea base Git (repo limpio y trazable)

**Objetivo:** Un commit de aplicación/docs que refleje el estado real del trabajo; evitar mezclar cambios no revisados con fixes de deps.

| Paso | Acción | Criterio de hecho |
|------|--------|-------------------|
| 1.1 | `git status` — listar grupos (src, docs, server, tests). | Lista clara de qué va en el commit. |
| 1.2 | Revisar diff crítico (calculadora, API, `.env.example` si aplica). | Sin secretos; sin `.env` commiteado. |
| 1.3 | `npm run lint` + `npm test` en el estado actual. | 0 errores lint; tests en verde. |
| 1.4 | Commit(s) lógicos (uno o pocos mensajes claros) + `git push` a remoto. | Rama remota al día con local. |

**Riesgos:** Commits gigantes difíciles de revertir → preferir 2–3 commits temáticos si el diff es grande.

**Estado:** ✅ **Hecho** (2026-03-20) — `npm run lint` (0 errores), `npm test` 115 passed; commits `e44e2bd` fix projectFile, `20e61d0` feat+docs, `fc5eba6` calc presupuesto libre; push `sheets-verify-config-b29b9` → origin.

---

## Pista 2 — Smoke producción (API + Vercel)

**Objetivo:** Confirmar que Cloud Run y (si aplica) Vercel responden sin sorpresas antes de invertir tiempo en Sheets.

| Paso | Acción | Criterio de hecho |
|------|--------|-------------------|
| 2.1 | Anotar URL base Cloud Run actual (service-map / gcloud). | URL escrita en nota o checklist. |
| 2.2 | `curl` a `/health` o `/api/kpi-report` (o doc E2E). | 200 o 503 coherente con Sheets; **no** 404 por ruta inexistente. |
| 2.3 | Abrir calculadora en Vercel; flujo mínimo (cargar pantalla / un cálculo). | UI carga; si falla API, anotar error de red/CORS. |
| 2.4 | Marcar ítems en [E2E-VALIDATION-CHECKLIST.md](../E2E-VALIDATION-CHECKLIST.md). | Al menos D1.2–D1.4 o equivalente prod documentado. |

**Riesgos:** 503 por credenciales/Sheet ID — es esperable; documentar “config OK en servidor X”.

**Depende de:** Pista 1 opcional (pero recomendable tener código alineado al deploy).

**Estado:** ⬜ Pendiente

---

## Pista 3 — Google Sheets: tabs y triggers (manual)

**Objetivo:** Desbloquear automatizaciones documentadas en IMPLEMENTATION-PLAN-POST-GO-LIVE / AUTOMATIONS-BY-WORKBOOK.

| Paso | Acción | Criterio de hecho |
|------|--------|-------------------|
| 3.1 | Leer checklist en AUTOMATIONS-BY-WORKBOOK (tabs CONTACTOS, Ventas_Consolidado, etc.). | Checklist impresa o abierta. |
| 3.2 | Crear tabs faltantes en el workbook correcto. | Tabs existen y nombres coinciden con docs. |
| 3.3 | Configurar triggers Apps Script según guía. | Triggers visibles en editor; sin errores al ejecutar prueba. |
| 3.4 | Actualizar PROJECT-STATE “Pendientes” o Log si cambia schema. | Equipo alineado. |

**Riesgos:** Nombres de tab distintos → roturas en rutas API; coordinar con Mapping.

**Estado:** ⬜ Pendiente (solo Matias + verificación)

---

## Pista 4 — `npm audit fix --force` (seguridad, breaking)

**Objetivo:** Reducir vulns restantes aceptando posible bump mayor de Vite / storage.

| Paso | Acción | Criterio de hecho |
|------|--------|-------------------|
| 4.1 | Rama nueva `chore/audit-fix-force-YYYY-MM-DD`. | Rama creada desde main limpio. |
| 4.2 | `npm audit fix --force` (revisar diff package.json/lock). | Diff revisado; notas de breaking. |
| 4.3 | `npm run lint` + `npm test` + `npm run build`. | Todo verde. |
| 4.4 | PR + merge o descartar si rompe. | Decisión documentada en PROJECT-STATE o CHANGELOG. |

**Riesgos:** Vite 8 / downgrades de Google libs — puede romper build o runtime; **no** en main sin pruebas.

**Estado:** ⬜ Pendiente

---

## Pista 5 — MATRIZ: SKUs col.D vs `matrizPreciosMapping.js`

**Objetivo:** Sustituir placeholders por SKUs reales o marcar explícitamente “no en MATRIZ”.

| Paso | Acción | Criterio de hecho |
|------|--------|-------------------|
| 5.1 | Export o vista col.D + descripción de ítems dudosos. | Lista en issue o tabla. |
| 5.2 | Ajustar `matrizPreciosMapping.js` y/o `constants.js` según negocio. | Precios coherentes con MATRIZ. |
| 5.3 | `npm test` + prueba manual “Cargar desde MATRIZ” si aplica. | Sin regresiones. |

**Estado:** ⬜ Pendiente

---

## Pista 6 — Billing / cierre mensual

**Objetivo:** Cierre contable en workbook Pagos Pendientes / proceso interno BMC.

| Paso | Acción | Criterio de hecho |
|------|--------|-------------------|
| 6.1 | Checklist interno de cierre (fechas, IVA, duplicados). | Documento o fila en PROJECT-STATE. |
| 6.2 | Revisión billing-error-review si hay exports. | Sin bloqueos críticos sin nota. |

**Estado:** ⬜ Pendiente

---

## Pista 7 — Repo Sync (bmc-dashboard-2.0 + bmc-development-team)

**Objetivo:** Misma verdad documental en repos hermanos.

| Paso | Acción | Criterio de hecho |
|------|--------|-------------------|
| 7.1 | Seguir [REPO-SYNC-REPORT-2026-03-20-run22.md](../reports/REPO-SYNC-REPORT-2026-03-20-run22.md). | Lista de archivos copiados o mergeados. |
| 7.2 | Push a ambos remotos (credenciales locales). | Git remoto actualizado. |

**Depende de:** Pista 1 (contenido estable para copiar).

**Estado:** ⬜ Pendiente

---

## Pista 8 — OAuth / origen JS Vercel (solo si falla)

**Objetivo:** Corregir `redirect_uri_mismatch` u orígenes en Google Cloud Console.

| Paso | Acción | Criterio de hecho |
|------|--------|-------------------|
| 8.1 | Reproducir error desde Vercel (Drive, login, etc.). | Captura o mensaje exacto. |
| 8.2 | Añadir origen JS `https://calculadora-bmc.vercel.app` (y redirect si aplica). | Flujo OAuth OK. |

**Estado:** ⬜ Pendiente (condicional)

---

## Cómo usar este documento

1. Trabajar **solo la pista marcada “en curso”**.
2. Al terminar: marcar **Estado** (✅ Hecho / ⏸ Bloqueado) y una línea en `PROJECT-STATE.md` → Cambios recientes.
3. Pasar a la siguiente pista con el mismo rigor.

---

## En curso

| Pista | Nombre | Estado |
|-------|--------|--------|
| **1** | Línea base Git | ✅ Hecho |
| **2** | Smoke producción | **← siguiente** |
