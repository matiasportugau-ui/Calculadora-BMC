# Local ↔ prod loop

Improve on **local**. Ship only after the **same spoken script** works on prod. VoiceXia is useless if it only exists in one environment.

## Local

```bash
cd ~/calculadora-bmc
doppler run --project bmc-backend --config prd -- npm run dev:full
```

Open **`http://localhost:5173/`** — not `/calculadora` (stale hashed `dist`).

| Piece | Expect |
|-------|--------|
| Vite | `:5173` HMR on `PanelinVoicePanel`, pack, instructions |
| API | `:3001` with Doppler `bmc-backend/prd` |
| Mint | `POST /api/agent/voice/session` → Grok ephemeral |
| WS | `wss://api.x.ai/v1/realtime` (CSP already allows) |
| Tools | `/api/agent/voice/action` with `calcState` |

After changing `voiceBrainPack.js` / `panelinBmcInstructions.js`: **new Voice session** (stop/start mic). HMR of the SPA is not enough if the WS is already open.

`node tests/voiceBrainPack.test.js`, `grokRealtimeTransport.test.js`, `voiceConversationContract.test.js` before claiming a pack change is green.

## Prod

| Piece | Expect |
|-------|--------|
| SPA | `https://calculadora-bmc.vercel.app/` (Vercel, `deploy-vercel.yml` after CI) |
| API | Cloud Run `panelin-calc` (`deploy-calc-api.yml` after CI if `server/` changed) |
| Secrets | GCP Secret Manager, not Doppler |
| Smoke | `npm run smoke:prod` |

Hard refresh if the PWA service worker still serves old JS (seen after SPA deploys).

API tool changes: old in-browser WS keeps the **old** tool list until a new session.

## Script (both environments)

1. Flotante → Voice (Grok Live).
2. Cotizar techo (familia + medidas + lista) — form moves, spoken totals from tools.
3. “Dame el PDF” → URL GCS.
4. Optional: cargar planilla (ASR planilla/parrilla) + Drive.
5. **Apagar Voice** — text transcript of those turns still visible.
6. Follow-up **typed**.
7. Voice **on** again — continues from that context.

## Do not

- Mix console `agent_id` into the browser WS.
- Assume local Doppler flags (`VITE_FEATURE_BRAIN`) match prod.
- Declare a voice fix done after local-only or prod-only.
