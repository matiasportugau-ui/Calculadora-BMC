# Release brief — Calculadora Panelin BMC (plantilla operativa)

Documento de salida para un **release oficial** de la Calculadora. Completar fechas y casillas al cerrar un hito; mantener alineado con [`CANONICAL-PRODUCTION.md`](./CANONICAL-PRODUCTION.md) y [`RELEASE-CHECKLIST-CALCULADORA.md`](./RELEASE-CHECKLIST-CALCULADORA.md).

---

## Identificación

| Campo | Valor |
|-------|--------|
| **Nombre release** | Calculadora v1 oficial (ajustar versión semver interna si aplica) |
| **Fecha target** | _YYYY-MM-DD_ |
| **Responsable** | _nombre_ |

---

## Entorno canónico

- **Stack oficial:** **Google Cloud Run unificado** — contenedor con SPA (`/calculadora/`) + API mismo origen (`Dockerfile.bmc-dashboard`, `VITE_SAME_ORIGIN_API=1`).
- **Secundario:** Vercel solo como alternativa documentada; no redefine la narrativa de producción.

---

## URL oficial (confirmar en deploy)

| Recurso | URL |
|---------|-----|
| **BASE Cloud Run** | `https://panelin-calc-q74zutv7dq-uc.a.run.app` _(verificar con `gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)'`)_ |
| **Calculadora** | `{BASE}/calculadora/` |
| **Health** | `{BASE}/health` |
| **MATRIZ CSV** | `{BASE}/api/actualizar-precios-calculadora` |

---

## Features incluidas en el release (marcar)

- [ ] Cotizador escenarios (techo / fachada / combinado / cámara / presupuesto libre)
- [ ] Lista de precios BMC vs Web + IVA en totales
- [ ] BOM agrupada, exclusiones, overrides donde aplique
- [ ] PDF cotización + vista previa
- [ ] Hoja visual cliente + hoja costeo (administración)
- [ ] Export WhatsApp
- [ ] Historial local (Budget Log)
- [ ] Config → Precios (MATRIZ vía API + import CSV + editor)
- [ ] Config → Fórmulas
- [ ] Google Drive (guardar/cargar proyectos) — _solo si build incluye `VITE_GOOGLE_CLIENT_ID` y OAuth_

---

## Features diferidas o fuera de alcance (marcar y explicar)

- [ ] **Logística** (`/logistica`) — producto relacionado pero no parte del “core cotizador” salvo decisión explícita
- [ ] **Drive** — _si no está en OAuth/build_
- [ ] **CRM cockpit / ML / correo** — mismo servicio; no bloquean “calculadora cotiza” si no están en contrato comercial del release
- [ ] _Otros:_

---

## Riesgos aceptados (registrar)

| Riesgo | Mitigación / nota |
|--------|-------------------|
| _ej. MATRIZ depende de planilla humana_ | Reconciliar con `npm run matriz:reconcile` cuando cambien SKUs |
| _ej. Drive no en v1_ | Usuarios usan historial local + export PDF/WA |
| _Vercel desalineado_ | Tráfico oficial apunta a Cloud Run |

---

## Comandos operativos (repo)

```bash
# Validación local estándar
npm run gate:local:full

# Smoke producción (MATRIZ crítico)
npm run smoke:prod

# Pre-deploy (checklist script)
npm run pre-deploy

# Deploy Cloud Run (ver procedimiento)
./scripts/deploy-cloud-run.sh
```

**Procedimientos:** [`PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md`](../procedimientos/PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md), [`CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`](../procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md).

---

## Rollback (resumen)

1. Cloud Console → Cloud Run → `panelin-calc` → **Revisiones** → tráfico a revisión anterior estable **o** redeploy de imagen conocida.
2. Verificar `{BASE}/health` y `{BASE}/api/actualizar-precios-calculadora`.
3. Comunicar a equipo el ID de revisión activa.

---

## Cierre

- [ ] Checklist [`RELEASE-CHECKLIST-CALCULADORA.md`](./RELEASE-CHECKLIST-CALCULADORA.md) completado
- [ ] Gaps [`CALCULADORA-LAUNCH-GAPS.md`](./CALCULADORA-LAUNCH-GAPS.md) cerrados o explícitamente diferidos arriba
- [ ] Entrada en [`docs/team/PROJECT-STATE.md`](../team/PROJECT-STATE.md) bajo “Cambios recientes”

---

*Plantilla actualizada: 2026-03-31.*
