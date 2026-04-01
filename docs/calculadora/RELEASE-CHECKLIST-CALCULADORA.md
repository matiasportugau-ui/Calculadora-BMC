# Checklist de release — Calculadora (producción canónica)

Checklist **específico de la Calculadora** para un go-live sobre **Cloud Run unificado**. Complementa (no reemplaza) el deploy general en [`docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`](../procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md) y [`npm run pre-deploy`](../../package.json).

**URL base de ejemplo (confirmar con `gcloud`):** `https://panelin-calc-q74zutv7dq-uc.a.run.app`  
**Calculadora:** `{BASE}/calculadora/`

---

## 1. Automático (CI / local antes de merge o deploy)

- [ ] `npm run lint` (cambios en `src/`)
- [ ] `npm test`
- [ ] `npm run build` (antes de commit con cambios de frontend)
- [ ] Opcional: `npm run gate:local:full` (= lint → test → build)

---

## 2. Smoke contra producción

Desde la raíz del repo (requiere red):

```bash
npm run smoke:prod
```

Variables: `BMC_API_BASE` o `SMOKE_BASE_URL` si probás otra base que la canónica del script.

- [ ] **Health / capabilities** según script
- [ ] **`GET /api/actualizar-precios-calculadora`** — CSV MATRIZ (crítico)
- [ ] Resto de checks del script (ML/CRM si aplica a tu entorno)

Omitir solo MATRIZ en entornos sin Sheets: `SMOKE_SKIP_MATRIZ=1` o `-- --skip-matriz` (no usar para release oficial completo).

---

## 3. Pre-deploy (repo)

```bash
npm run pre-deploy
```

- [ ] Paso de contrato/API si el script lo ejecuta contra API local o `BMC_API_BASE`
- [ ] Variables críticas presentes en `.env` local según checklist del script (sin commitear secretos)

---

## 4. QA manual en navegador

Usar **[`BROWSER-QA-CHECKLIST.md`](./BROWSER-QA-CHECKLIST.md)** contra `{BASE}/calculadora/`.

Prioridad mínima para release:

- [ ] Carga shell + Config (secciones A, A4–A5)
- [ ] Al menos un escenario completo (B o C) + PDF preview
- [ ] **Costeo** y **Hoja cliente** si están en alcance comercial
- [ ] **Config → Precios → Cargar desde MATRIZ** (requiere API + `BMC_MATRIZ_SHEET_ID` en Cloud Run)
- [ ] **Responsive:** móvil o ancho estrecho (ver [`CALCULADORA-LAUNCH-GAPS.md`](./CALCULADORA-LAUNCH-GAPS.md))

---

## 5. Drive (si está en alcance)

- [ ] Login Google desde la URL **base Cloud Run** (origen en OAuth Console)
- [ ] Sin `VITE_GOOGLE_CLIENT_ID` en build → Drive no es “launch-ready”; documentar como diferido en el brief

---

## 6. Rollback (Cloud Run)

- [ ] Conocer la **revisión actual** y la anterior en Cloud Console → Cloud Run → `panelin-calc` → Revisiones
- [ ] **Rollback:** asignar tráfico 100% a una revisión anterior estable, o redeploy de imagen etiquetada conocida
- [ ] Tras rollback: repetir smoke mínimo (`/health`, `/calculadora/`, MATRIZ CSV)

**Imagen de referencia en repo:** `gcr.io/chatbot-bmc-live/panelin-calc` (ver checklist deploy).

---

## 7. Criterio Go / No-Go

### Go

- Smoke prod verde (incl. MATRIZ en prod oficial)
- QA manual de calculadora cerrada o con fallos menores documentados
- MATRIZ validada desde UI y coherente con expectativas de negocio
- PDF y WhatsApp validados en la ruta oficial
- Documentación de launch alineada ([`CANONICAL-PRODUCTION.md`](./CANONICAL-PRODUCTION.md), [`RELEASE-BRIEF-OFFICIAL.md`](./RELEASE-BRIEF-OFFICIAL.md))
- Working tree del repo consolidado o **release freeze** explícito antes de tag

### Launch con advertencias

- Todo lo anterior excepto **Drive**, si se excluye explícitamente del alcance v1

### No-Go

- MATRIZ inestable o CSV incorrecto en prod
- PDF o mobile sin validación manual cuando son parte del contrato comercial
- Ambigüedad entre “oficial Vercel” vs “oficial Cloud Run” sin actualizar docs
- Regresión grave en routing (`App.jsx`) sin revisión

---

*Última actualización: 2026-03-31.*
