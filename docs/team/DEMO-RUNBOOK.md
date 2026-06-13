# DEMO RUNBOOK — Calculadora BMC / Panelin

Guía práctica para **levantar la demo**, con **respaldo restaurable** y **fallback offline** por si el sistema en vivo falla durante una presentación.

> Estado verificado **2026-06-11** en este repo: lint ✅, build ✅, **27/27 rutas cargan sin crash** contra el build de producción. Ver "Resultado del smoke" abajo.

---

## 1. Levantar la demo (local)

Requisitos: Node (el repo pide `24.x`; con 22.x corre igual, solo warning `EBADENGINE`).

```bash
# 1. Dependencias — IMPORTANTE: incluir devDependencies.
#    Este entorno tiene NODE_ENV=production, que hace que `npm install` OMITA
#    Vite/ESLint/etc. Forzar dev:
export BMC_DISK_PRECHECK_SKIP=1
npm install --include=dev
# (Linux: si el addon nativo `easymidi` falla, instalar ALSA: apt-get install -y libasound2-dev)

# 2a. Opción DEV (hot reload):  API :3001 + Vite :5173
npm run dev:full

# 2b. Opción DEMO ESTABLE (recomendada para presentar): build + preview
npm run build
npm run start:api &              # API en :3001 (o el PORT del entorno)
npx vite preview --port 4173     # SPA de producción en :4173
```

**Para presentar usá la opción 2b (el build), no `vite dev`.** Ver caveat §4.

Verificación rápida de las 27 rutas:
```bash
npm run smoke:routes                       # contra :5173 (dev)
node scripts/demo-route-smoke.mjs --base=http://localhost:4173   # contra el build
```

---

## 2. Respaldo restaurable (red de seguridad) 🪢

| Punto de restauración | Dónde | Cómo volver |
|---|---|---|
| **Tag local** `demo-backup-2026-06-11` | local (esta sesión/clon) | `git checkout demo-backup-2026-06-11` |
| **Baseline producción** | `origin/main` | `git checkout main && git reset --hard origin/main` |
| **Rama de trabajo estable** `@ bff358b` | `origin/claude/goal-prompt-gate-secrets-redeploy-6pwuk9` | `git checkout <rama> && git reset --hard <sha>` |

> Nota: el proxy git de este entorno **solo permite pushear la rama designada** (push de tags/otras ramas devuelve 403), por eso el tag de respaldo es local. Los puntos durables remotos son `origin/main` y la rama de trabajo ya pusheada.

---

## 3. Fallback offline (si la API/red caen en la demo) 🛟

El build es un **PWA con precache** (`dist/`, 92 entradas). La **calculadora** (geometría, BOM, precios, PDF cliente) corre **100% en el navegador** sin API:

```bash
npm run build
npx vite preview --port 4173    # abrir http://localhost:4173/calculadora
# o servir dist/ con cualquier static server; funciona sin backend.
```

Lo que **sí** necesita backend (degrada con gracia, devuelve 503/vacío, no crashea): CRM/Sheets, IA (chat/sugerencias), WhatsApp, ML, TraKtiMe, Transportista (Postgres).

---

## 4. Caveats conocidos (no bugs)

- **`vite dev` + service worker:** navegando directo a `/calculadora` (el `start_url` del PWA) en **modo dev**, el SW puede servir chunks que 404 → pantalla en blanco. **No ocurre en el build/producción** (chunks hasheados y precacheados). → Para demo, usar el build (§1 opción 2b).
- **Sin Postgres local (`:5432`):** rutas WA/TraKtiMe/Transportista loguean `ECONNREFUSED` y devuelven **503 por diseño** (nunca 500). La UI muestra "sin datos", no crashea.
- **Sin credenciales (`hasSheets:false`, `hasTokens:false`):** CRM/Finanzas/ML/IA no traen datos reales; el resto de la app funciona.
- **Suite offline local:** `npm test` / `test:api` fallan ~3 casos en este sandbox (OpenAI sin key válida; 2 RBAC de `identityAuth` con Node 22 vs `engines` 24.x). La **misma suite está verde en CI** (job "Validate Calculations" de la PR #324). No demo-blocking.

---

## 5. Checklist de presentación

- [ ] `npm install --include=dev` corrió sin error (ALSA si hace falta).
- [ ] `npm run build` verde.
- [ ] `node scripts/demo-route-smoke.mjs --base=http://localhost:4173` → 27/27 sin crash.
- [ ] Abrir `/calculadora` en el build y hacer una cotización techo + pared de prueba.
- [ ] Tener a mano el comando de restauración (§2) por si algo se rompe en vivo.

---

## Resultado del smoke (2026-06-11, build de producción)

`27/27 rutas sin crash`. Único "ruido": en `vite preview` un CORS a `:3001/capabilities` (preview no proxea `/api`; en prod la API es same-origin/proxy) — no afecta el render.
