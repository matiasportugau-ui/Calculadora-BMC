# Panelin Web — next

SoT for `/panelin-web`. Keep this short. Update after each useful hop.

**Última:** 2026-08-28 (ship: hide orb when credits dead)  
**Branch:** `feat/storefront-voice-cost`  
**Local:** http://127.0.0.1:3001/storefront-voice/  
**Shop:** widget from Cloud Run after this `deploy-calc-api`.

## Estado

- Helper `storefrontVoiceCredits.js` + `GET /status` `{ bubble: false }`. Widget **no monta** el globo. Mint/chat 403 `code=credits` lo saca.
- Texto primero: solo Hablar mintea voz. PCM silencio no se manda. Corte 10s. Sin `web_search` en voz.

## Próximo prompt

```
/panelin-web shop
```

Hard-refresh tienda. Sin créditos xAI → no hay globo. Con créditos → chat texto; mic para voz.

## No hacer ahora

- Mezclar Driver QR / keywords / logística.
- Mostrar error de créditos al comprador.
