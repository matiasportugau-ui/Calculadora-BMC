# Commit 6af2db3

- Fecha: 2026-04-27
- Hora: 02:44:14
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: ml-oauth
- Commit: fix(ml-oauth): add PKCE (S256) support to MercadoLibre OAuth flow

## Resumen
add PKCE (S256) support to MercadoLibre OAuth flow

## Descripción
Este cambio registra el commit `fix(ml-oauth): add PKCE (S256) support to MercadoLibre OAuth flow` dentro del sistema de trazabilidad del proyecto. Se modificaron 2 archivos: server/index.js, server/mercadoLibreClient.js.

Contexto del commit:
ML app has PKCE required. buildAuthUrl now generates code_verifier/
code_challenge pair; exchangeCodeForTokens passes code_verifier.
oauthStates map stores { createdAt, codeVerifier } per state token.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server

## Archivos modificados
- server/index.js
- server/mercadoLibreClient.js

## Diff summary
```text
server/index.js              | 19 +++++++++++--------
 server/mercadoLibreClient.js | 14 ++++++++++----
 2 files changed, 21 insertions(+), 12 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
