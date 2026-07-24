# Meta Ads Marketing API — Live Report setup (PR3)

Live Insights for Marketing Hub **Ads · Meta** (`GET /api/marketing/ads/meta/report?source=live`).

## Secrets (names only)

| Env var | Purpose |
|---------|---------|
| `META_ADS_ACCESS_TOKEN` | Long-lived **Marketing API** system-user token |
| `META_ADS_ACCOUNT_ID` | Ad account id (`act_123…` or numeric; client normalizes to `act_`) |

**Do not** reuse `FB_PAGE_TOKEN` / WhatsApp / Instagram page tokens — wrong product and scopes.

### Where to set

- **Local:** Doppler `bmc-backend` / config **`prd`** (not `production`)
- **Prod Cloud Run:** GCP Secret Manager mount (same names)
- Documented in `.env.example` for env-drift CI

### Account id

Supply via env only. Historical candidate `act_109433652503382` is an **assumption** until confirmed in Meta Business Manager — do not treat it as hard-coded default in code.

## Required Meta app / system user

1. Meta Business Manager → System user with access to the ad account  
2. Generate token with ads read scopes (typically `ads_read` / `ads_management` read as required by your app)  
3. Assign system user to the ad account with at least **View performance**  
4. Confirm account id in Ads Manager (account settings)

## Smoke

```bash
# Health (no secrets in body)
curl -sS -H "Authorization: Bearer $ADMIN_JWT" \
  "$API/api/marketing/ads/meta/health" | jq .

# Live report (only if token+account configured)
curl -sS -H "Authorization: Bearer $ADMIN_JWT" \
  "$API/api/marketing/ads/meta/report?range=30d&source=live" | jq '.meta.freshness, .kpis.spend, (.campaigns|length)'
```

Expected without secrets: `freshness` is **not** `live` (Snapshot/Demo fail-open).  
Expected with secrets + Graph OK: `freshness === "live"`.

## UI

`/hub/marketing` → **Ads · Meta** → Fuente **Live** or **Auto** (when secrets present) → **Actualizar**.

Badge **LIVE** only when the API returns `meta.freshness === "live"`.
