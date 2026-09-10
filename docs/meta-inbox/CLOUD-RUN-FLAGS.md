# Cloud Run flags for Meta inbox Run 1

After merge, set GitHub Actions variables (never paste tokens in chat):

- `OMNI_IG_ENABLED=1`
- `OMNI_FB_ENABLED=1`
- `META_COMMENTS_ENABLED=0`
- `OWNER_WHATSAPP` = personal E.164 digits (not 092 663 245)
- optional: `META_PAGE_ID`, `META_IG_ACCOUNT_ID`

Then `gh workflow run deploy-calc-api.yml --ref main`.

Empty `OWNER_WHATSAPP` = ingest can run, notify stays off.
24/7 webhook host is Cloud Run `panelin-calc`, not BMC02.
