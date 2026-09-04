# Panelin Web — next

SoT for `/panelin-web`. Keep this short. Update after each useful hop.

**Última:** 2026-09-04 (SHIP to live — Matias OK)  
**Branch:** `feat/storefront-voice-modes-demo`  
**Local:** http://127.0.0.1:3001/storefront-voice/  
**Shop:** shipping Cloud Run `panelin-calc`; theme script already points at prod `widget.js`.

## Estado

Each shop chat is a row in Admin 2.0 (`WOLFB_ADMIN_SHEET_ID` = planilla 1Ie0KCpg… gid 0, tab `Admin.`, origen `VW`). Identify creates the row; every `/chat` turn + `/log` writes the transcript to col J.

## Próximo prompt

```
chatear en http://127.0.0.1:3001/storefront-voice/ y abrir la planilla Admin 2.0: fila VW nueva + col J con el chat
```

## No hacer ahora

- Pegar el pipeline a la tienda.
- Mezclar Driver QR / keywords / logística.
- `git stash pop` del wip mixed 2026-09-04 encima de esta branch.
