# Modo Transportista — instrucciones de proyecto

## Objetivo

PWA conductor + API por eventos append-only, evidencia (POD), outbox WhatsApp, integrado en Calculadora-BMC (`server/routes/transportista.js`).

## Reglas de oro

- Todo cambio operativo relevante se registra en `trip_events` (append-only).
- No editar historia: compensar con nuevos eventos.
- Idempotencia por `(trip_id, idempotency_key)`.
- Evidencia: bucket privado + URLs firmadas en prod; en dev ver `upload-b64`.
- Tokens de conductor: expiran, revocables, solo hash en DB.

## Estándares

- Nuevos módulos servidor en JS ESM (alineado al repo).
- JSON con `idempotency_key` en mutaciones.
- Tests: `server/lib/transportistaFsm.js`, firma webhook, token hash (`tests/validation.js`).
