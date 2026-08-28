# Panelin Web — next

SoT for `/panelin-web`. Keep this short. Update after each useful hop.

**Última:** 2026-08-28 (cost stack + hide orb when xAI credits dead)  
**Branch:** `feat/storefront-voice-cost`  
**Local:** http://127.0.0.1:3001/storefront-voice/  
**Shop:** still old widget until this ships (`deploy-calc-api`).

## Estado

- Sin crédito xAI: `GET /api/public/voice/status` → `{ bubble: false }`. El widget **no monta** el globo. Mint 403 `code=credits` también lo saca.
- Texto primero: abrir / identificar no mintea voz. Solo el mic (`aria-label="Hablar"`). Resume post-navigate sí.
- PCM peak &lt; 0.008 no se manda. Corte de silencio 10s (cliente + VAD). Sin `web_search` en el pack de voz.
- KB + JSONL turns quedó en stash `wip: storefront kb+turns — do not mix with voice-cost`.

## Próximo prompt

```
/panelin-web ship
```

Tras merge + Cloud Run: hard-refresh tienda. Sin créditos → no hay globo. Con créditos → chat texto, Hablar para voz.

## No hacer ahora

- Mezclar Driver QR / keywords / logística / KB injection.
- Mostrar error de créditos al comprador.
