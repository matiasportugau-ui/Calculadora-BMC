# HANDOFF — WA Cockpit extension: security + reliability hardening

**Date:** 2026-09-10  
**Repo:** `~/calculadora-bmc-wa-extension` (branch `main`, commit `e57f301`, tree clean)  
**Backend pendiente:** `~/calculadora-bmc` (sin cambios — sólo review)

## Contexto

Review completo del stack WA-sin-API-oficial (extensión MV3 scrape WA Web → `/api/wa/*`).
Veredicto: arquitectura correcta (menor riesgo de ban que Baileys/wwebjs; híbrido Cloud API OK).
Se corrigieron los 6 hallazgos de la extensión. `npm run compile` limpio (TS 5.9) + `npm run build` OK.

## Commit `e57f301` (incluye WIP previo de magic-link/media + fixes)

| Fix | Archivos |
|-----|----------|
| 🔴 Exfiltración: quitado `https://*.run.app/*` de spaBridge matches + background valida sender origin (allowlist) para `applyConfig` | `spaBridge.content.ts`, `background.ts` |
| 🟠 Live sync: `liveTickle` pasa `sinceMs` (cursor `lastLiveSyncAt` persistido, overlap 60s, lookback 15min primer run); live con filtro ya no corta al primer batch | `background.ts`, `storage.ts`, `content.ts` |
| 🟠 wsHook: `removeEventListener` des-wrappea vía WeakMap; hook a setter `onmessage` | `wsHook.ts` |
| 🟡 IDB scrape: lectura paginada (500 filas/tx readonly) — memoria acotada | `idbScrape.ts` |
| 🟡 Media: verificación MAC (HMAC-SHA256 iv‖cipher, constant-time, 10B truncado) antes de descifrar | `mediaDecrypt.ts` |
| 🟡 Config refresh vía `chrome.alarms` (setInterval muere con el SW MV3) | `background.ts` |

También: 3 guards `string | undefined` en `api.ts`/`normalize.ts` (WIP previo) y `chrome-mv3/` al `.gitignore`.

## ⚠️ Sin remote

`git remote -v` está vacío. Para publicar:

```bash
cd ~/calculadora-bmc-wa-extension
gh repo create calculadora-bmc-wa-extension --private --source=. --push
# o: git remote add origin git@github.com:<org>/calculadora-bmc-wa-extension.git && git push -u origin main
```

## Verificación manual pendiente (humo)

1. `cd ~/calculadora-bmc-wa-extension && npm run build`
2. `chrome://extensions` → recargar unpacked desde `.output/chrome-mv3/` → recargar tab WA Web.
3. Popup → Probar `/api/wa/health` → 200.
4. Mandarse un mensaje de prueba → confirmar que el live tickle ingesta SOLO lo nuevo (mirar `inserted` vs `deduped`).
5. Imagen/nota de voz → confirmar upload a `/api/wa/media` (MAC verify no debe rechazar media legítima; si rechaza todo, revisar layout HKDF en `mediaDecrypt.ts`).

## Backend TODO (review hecho, fixes NO aplicados — `~/calculadora-bmc`)

1. 🔴 Token legacy: comparar timing-safe + plan de deprecación (`server/routes/wa.js:39-64,159-217`). La extensión aún hace fallback silencioso JWT→legacy.
2. 🔴 No devolver access/refresh tokens en query-string redirect (`server/routes/wa.js:441-451`).
3. 🟠 Outbox durable para webhooks + shadow-writes (`server/lib/waWebhooks.js`, `routes/wa.js:667-694`).
4. 🟠 Sacar llamadas LLM de la tx DB en enricher (`server/lib/waEnricherWorker.js:86-154`).
5. 🟡 Worker de purge/TTL (config `ttlDays` existe, no se aplica) + worker-liveness en `/wa/health`.
6. 🟡 Hard-fail en prod si falta `WHATSAPP_APP_SECRET` (`server/lib/whatsappSignature.js:9-14`).

## Next prompt

`Continuar backend WA hardening en ~/calculadora-bmc: items 1-2 del HANDOFF-2026-09-10-wa-extension-hardening.md (timing-safe legacy token + tokens fuera de query-string). Correr npm run gate:local antes de commitear.`
