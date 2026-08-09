# Phantom 404: `/vad/silero_vad_legacy.onnx`

## Symptom

Production / Cloud Run logs show recurring requests like:

```
GET /vad/silero_vad_legacy.onnx HTTP/1.1 -> 404 Not Found
GET /vad/ort-wasm-simd-threaded.mjs HTTP/1.1 -> 404 Not Found
```

## Root cause — it is a phantom, not a missing asset

`silero_vad_legacy.onnx` is the default asset name fetched by the
**`@ricky0123/vad-web`** library (on-device Voice Activity Detection via ONNX runtime).

**This repository has never depended on it.** Verified by:

- No `@ricky0123/vad-web`, `onnxruntime*`, or `ort-wasm` in `package.json`,
  `package-lock.json`, `node_modules`, or **any commit in git history**.
- No `.onnx` file anywhere in the repo, and no `/public/vad/` directory.
- The only `vad` substrings in `src/` are Spanish words (`desactivado`, `Activada`).

The actual voice / "animated agent" stack does **not** use a local model:

- `src/hooks/useVoiceSession.js` → **OpenAI Realtime API**, `turn_detection: server_vad`
  (VAD runs server-side in OpenAI's infra). Used by `/panelin/live`. See `server/routes/agentVoice.js`.
- `src/hooks/useHandsFreeVoice.js` → browser **Web Speech API** wake-word ("Panelín").
- `src/components/PanelinVoicePanel.jsx` → UI wrapper for **Hands-free only** (not Realtime).

So nothing this app serves or ships requests `/vad/...`. The request originates from a
**stale client**: an old service worker, a cached build, or a browser extension on a
device that once pointed at a different/experimental build. It is harmless — just log noise.

## What we did

`server/index.js` answers any `/vad/...` request with **`204 No Content`** instead of a
noisy error-level `404` (mirrors the existing `/favicon.ico` 204 guard). It is scoped to
`/vad/` only; every real route and the normal catch-all `404` are unaffected. No model
binary is shipped, no dependency added.

## If you still see it on a specific device

It is the client's stale cache/service worker. To clear:

1. DevTools → **Application** → **Service Workers** → **Unregister**.
2. DevTools → **Application** → **Storage** → **Clear site data**, then hard reload.

The PWA service worker (`vite.config.js`) already uses `registerType: 'autoUpdate'`,
`skipWaiting`, `clientsClaim`, and `cleanupOutdatedCaches`, so fresh clients self-heal on
the next deploy.

## If on-device VAD is ever actually wanted

That is a separate feature, not a bugfix: add `@ricky0123/vad-web` (+ `onnxruntime-web`),
host `silero_vad_legacy.onnx` and the `ort-wasm-*` files under `public/vad/`, and wire
`MicVAD` with `baseAssetPath: '/vad/'` into the voice UI. Do not add the model binary
without the consuming code.
