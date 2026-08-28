# Panelin Web — next

SoT for `/panelin-web`. Keep this short. Update after each useful hop.

**Última:** 2026-08-28  
**Branch:** `feat/panelin-front` (`541b8b08`)  
**Local:** http://127.0.0.1:3001/storefront-voice/  
**Shop:** still old widget until Cloud Run picks up this branch

## Estado

- Rama aislada de Driver QR. Commit local: saludo abierto, captions `grok-transcribe`, corte de mic+WS a 30 s.
- Matias verificó en local: saludo abierto + silencio ~30 s corta el mic.
- Shop (bmcuruguay.com.uy) **no** tiene este widget todavía.

## Próximo prompt

```
/panelin-web ship
```

Abrir PR a `main` (HITL: esperar `ship` / `sí`). Merge → `deploy-calc-api` → el script de Shopify toma el widget nuevo. Luego `/panelin-web shop` en la tienda real.

## No hacer ahora

- Más features de voz antes de shippear el corte de silencio.
- Mezclar Driver QR / keywords / logística en esta rama.
