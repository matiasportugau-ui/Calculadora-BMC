# Runbook — Paid White-Label MVP

**SDD:** `docs/sdd/paid-white-label-presupuestos/SDD.md`  
**Branch:** `feat/paid-white-label-presupuestos`  
**Date:** 2026-08-15

## P0 gap list (Turn 1)

1. **Complete path (hecho confirmado):** `POST /api/me/quotes` coerces status to `draft`. Server `completed` only on `server/routes/calc.js` agent/PDF path (`upsertQuote({ status: "completed" })`). Wizard needs `POST /api/me/quotes/:id/complete`.
2. **GCS (hecho confirmado):** `server/lib/gcsUpload.js` is public `quotes/` + `quotes/pdf/`. Private pattern is `server/lib/waMedia.js` (`wa-media/` + signed GET). Logos use private prefix `identity-branding/{user_id}/`; if GCS unset, persist data-URL in `users.branding` (MVP).
3. **`plus` usage (duda abierta):** no prod query this turn (avoid Doppler unless needed). ADR-001: do not remap `plus` → `paid`.
4. **`feat/pdf-customer-brand-identity`:** inspect later; no blind merge.
5. **list/get quotes:** already omit `bmc_snapshot` columns — keep it that way.
6. **Admin plan_tier:** filter exists; PATCH missing → add.
7. **Identity live:** do not re-run `identity_init`.
8. **TTS stash:** local WIP on `feat/panelin-argentina-tts` stashed as `wip feat/panelin-argentina-tts before paid-white-label`.
9. **Public calc:** stays ungated.
10. **Sheets:** enqueue only if `SHEETS_CLIENT_QUOTES_ENABLED`; tab not auto-created.

## Activate a paid user (emergency SQL)

```sql
UPDATE identity.users
   SET plan_tier = 'paid', updated_at = now()
 WHERE email = 'usuario@example.com'
   AND status = 'active';
```

Or Admin UI `/hub/admin/users` → Detalle → Plan.

## Rollback

```sql
UPDATE identity.users SET plan_tier = 'base', updated_at = now()
 WHERE email = 'usuario@example.com';
```

Existing `bmc_snapshot` rows stay (audit).

## UAT

1. Anónimo en `/calculadora` → PDF BMC.
2. Login `base` → branding POST 403.
3. Admin pone `paid` → upload logo → complete quote → client PDF sin “BMC Uruguay”.
4. Admin `audience=bmc` ve logo BMC + margen.
5. Soft-delete: snapshot sigue en DB.

## Flags

- `SHEETS_CLIENT_QUOTES_ENABLED` default false.
- Tab human: `Base de datos cotis de clientes`.
