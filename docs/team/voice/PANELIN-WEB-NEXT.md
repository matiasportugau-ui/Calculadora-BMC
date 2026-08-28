# Panelin Web — next

SoT for `/panelin-web`. Keep this short. Update after each useful hop.

**Última:** 2026-08-28 (Cloud Run boot — drop missing credits import)  
**Branch:** `fix/storefront-credits-import`  
**Local:** http://127.0.0.1:3001/storefront-voice/  
**Shop:** still `01090-dx9` / widget Last-Modified Fri, 28 Aug 2026 08:17:43 GMT (#1163). `#1166` image never listened on 8080.

## Estado

- `#1166` merged (`e85e1f3d`) but revision `panelin-calc-01091-cjm` crashed: `Cannot find module storefrontVoiceCredits.js` imported from `publicVoice.js` (hide-orb WIP leaked into the squash).
- Fix: strip that import + GET `/status`. Keep KB JSONL / identify 502 / loopback. Restore `web_search` + 30s idle to match the shop widget. Test: every `publicVoice.js` relative import must exist on disk.
- Do not mix `feat/storefront-voice-cost` or hub-nav into this PR.

## Próximo prompt

```
/panelin-web shop
```

Tras merge + Cloud Run ready: hard-refresh bmcuruguay.com.uy. Identify must create Admin VW row. Pack has product facts, no USD 240.

## No hacer ahora

- Mezclar Driver QR / keywords / logística / hide-orb / hub-nav.
- Mostrar error de créditos al comprador.
