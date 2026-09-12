# Run 1 — Status & Next Steps

**Date:** 2026-09-10  
**Branch:** `feat/meta-omni-run1`  
**PR:** [#1229](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/1229) (draft — code in flight; live flip is owner-gated)

---

## COMPLETED (local + PR slices)

- `server/lib/meta/notify.js` — owner WhatsApp notify, 60s burst (5 immediate, then digest)
- `server/lib/omni/metaWebhookHandler.js` — persist hook; skip duplicate and echo (`metadata.is_echo` before persist; pin `tests/metaEchoPersistSkip.test.js`)
- Tests: `tests/metaNotify.test.js`, `tests/omniMetaChannels.test.js`
- `docs/meta-inbox/RUN1-CHECKLIST.md`
- Local extra (may still be unpushed from bmc02): `tests/run1-e2e-local.test.js`, `docs/meta-inbox/RUN1-DEPLOY-VALIDATION.sh`

Flags stay **default OFF**. `OWNER_WHATSAPP` empty = notify disabled.

## PENDING — owner

1. Finish remaining PR files if CI is incomplete: `server/config.js` keys, `.env.example`, `deploy-calc-api.yml` GitHub vars, `package.json` `test:core`.
2. Merge #1229 after CI green.
3. Set GitHub vars (Cloud Run reads these):
   `OMNI_IG_ENABLED=1` `OMNI_FB_ENABLED=1` `META_COMMENTS_ENABLED=0` `OWNER_WHATSAPP` (personal E.164, **not** 092 663 245).
4. Meta console: subscribe Page `messages` + `messaging_postbacks`, IG `messages`. Callbacks on `panelin-calc-q74zutv7dq-uc.a.run.app`.
5. Live test: IG DM + Messenger DM → one Omni row each + WA on personal phone in < 30s.

Do **not** start Run 1b until that live proof holds.
