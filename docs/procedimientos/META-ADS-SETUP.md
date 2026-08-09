# Meta Ads credentials — most automated setup (Live Report)

**Goal:** `META_ADS_ACCESS_TOKEN` + `META_ADS_ACCOUNT_ID` in Doppler **`bmc-backend/prd`** + GSM + Cloud Run so Hub **Ads · Meta → Live → Actualizar** returns `meta.freshness === "live"`.

**Do not re-implement PR1–PR3.** Code is already on `main` (#753 / #762 / #764 + range fix #767).

---

## 0. TL;DR (after you have a token)

```bash
cd ~/calculadora-bmc

# A) Only list accounts (pick act_ id) — no writes
export META_ADS_ACCESS_TOKEN='…'   # paste once; never commit
META_ADS_LIST_ACCOUNTS=1 bash scripts/meta-ads-bootstrap-auto.sh

# B) Full smoke only (no Doppler/GSM)
export META_ADS_ACCOUNT_ID='act_…'  # from list above
META_ADS_DRY_RUN=1 bash scripts/meta-ads-bootstrap-auto.sh

# C) Smoke OK → push Doppler + GSM + Cloud Run mount (5s Ctrl+C window)
bash scripts/meta-ads-bootstrap-auto.sh
```

Then smoke UI: **https://calculadora-bmc.vercel.app/hub/marketing** → **Ads · Meta** → Fuente **Live** → **Actualizar**.

---

## 1. Human-only part (Meta Business Manager) — ~10 min

Automation **cannot** create Meta system users for you. Do this once in the browser.

### 1.1 Confirm ad account id

1. Open [Meta Ads Manager](https://adsmanager.facebook.com/) logged in as the BMC business admin.  
2. Top-left account switcher → note the account name.  
3. **Account settings** (gear) or URL often contains `act=1234567890`.  
4. Canonical form for our env: **`act_1234567890`** (script accepts numeric too).

> Historical fixture value `act_109433652503382` is an **assumption** until you see it in BM. Prefer the id from the list returned by the bootstrap script (step 0A).

### 1.2 Create / use a System User (Marketing API)

1. [Meta Business Settings](https://business.facebook.com/settings) → **Users** → **System users**.  
2. **Add** (or open existing) system user — type **Admin** if you can.  
3. **Add assets** → **Ad accounts** → select the BMC ad account → permission **View performance** (or Manage campaigns if you prefer).  
4. **Generate new token**:
   - App: pick the BMC/Meta app that owns Marketing API access (same BM).  
   - Permissions / scopes (minimum):
     - `ads_read` (required)
     - If the UI offers: `ads_management` (read is enough for Insights; include only if your app requires it)
   - Generate → **copy once** → store in password manager.  
5. Token type must be **system user / never expires** (or long-lived). **Page** / **WhatsApp** tokens are **wrong**.

### 1.3 App checklist (if Insights returns permission errors)

- App is in **Live** (or Development with your admin user).  
- **Marketing API** product added.  
- System user assigned to the ad account (1.2 step 3).  
- If using Advanced Access for ads: complete Meta App Review when required for production apps outside testing.

---

## 2. Automated bootstrap (Doppler + GSM + Cloud Run)

Script: [`scripts/meta-ads-bootstrap-auto.sh`](../../scripts/meta-ads-bootstrap-auto.sh)  
Pattern twin: `~/google-ads-bootstrap-auto.sh`

| Step | What it does | Abort if fail |
|------|----------------|---------------|
| 1 | Check `curl`, `jq`, (`doppler`, `gcloud` if not dry-run) | yes |
| 2 | Load `META_ADS_ACCESS_TOKEN` (+ optional account) from env or silent prompt | yes if no token |
| 3 | Graph `/me` + `/me/adaccounts` | yes if bad token |
| 4 | Optional Insights 7d smoke on chosen `act_` | yes if Insights error |
| 5 | 5s countdown (Ctrl+C) | — |
| 6 | `doppler secrets set` → **bmc-backend / prd** | on error |
| 7 | GSM create/version `meta-ads-access-token`, `meta-ads-account-id` in **chatbot-bmc-live** | on error |
| 8 | `gcloud run services update panelin-calc --update-secrets=…` | on error |

**Env knobs:**

| Variable | Default | Meaning |
|----------|---------|---------|
| `META_ADS_DRY_RUN=1` | off | Smoke only |
| `META_ADS_LIST_ACCOUNTS=1` | off | Print accounts and exit |
| `DOPPLER_PROJECT` | `bmc-backend` | |
| `DOPPLER_CONFIG` | `prd` | **not** `production` |
| `GCP_PROJECT` | `chatbot-bmc-live` | |
| `CLOUD_RUN_SERVICE` | `panelin-calc` | legacy API name |
| `GRAPH_VERSION` | `v21.0` | match client |

**Security:** uses `printf` pipes (no `echo` with secrets); clears vars on exit; silent `read -s` if you type interactively.

---

## 3. Manual Doppler / GSM (if you skip the script)

```bash
# Doppler (local + ops source of truth)
printf '%s' "$META_ADS_ACCESS_TOKEN" | doppler secrets set META_ADS_ACCESS_TOKEN \
  --project bmc-backend --config prd --no-interactive
printf '%s' "$META_ADS_ACCOUNT_ID" | doppler secrets set META_ADS_ACCOUNT_ID \
  --project bmc-backend --config prd --no-interactive

# GSM names (lowercase-hyphen convention, same as Google Ads bootstrap)
# meta-ads-access-token  ← META_ADS_ACCESS_TOKEN
# meta-ads-account-id    ← META_ADS_ACCOUNT_ID
```

Cloud Run must map env names to secret versions (script step 8). If deploy CI uses a fixed `--set-secrets` list and **overwrites** mounts, add the two pairs to `.github/workflows/deploy-calc-api.yml` so the next full deploy does not drop them. [INFERRED: check current workflow `--set-secrets` / `--update-secrets` usage before relying only on one-shot CLI.]

---

## 4. Verify after deploy

```bash
# Health (no token in body)
curl -sS -H "Authorization: Bearer $ADMIN_JWT" \
  "$API/api/marketing/ads/meta/health" | jq '{token_configured,account_configured,live_implemented,account_id,mode}'

# Live report
curl -sS -H "Authorization: Bearer $ADMIN_JWT" \
  "$API/api/marketing/ads/meta/report?range=7d&source=live" \
  | jq '{freshness:.meta.freshness, spend:.kpis.spend, campaigns:(.campaigns|length), notes:.meta.notes}'
```

| Expect without secrets | Expect with secrets + Graph OK |
|------------------------|--------------------------------|
| `token_configured: false` | `token_configured: true` |
| `source=live` → freshness **snapshot** (fail-open) | freshness **`live`** |
| UI badge Demo/Snapshot | UI badge **LIVE** |

UI path: `/hub/marketing` → **Ads · Meta** → range 7d/30d → Fuente **Live** or **Auto** → **Actualizar**.

---

## 5. Local dev (optional)

```bash
cd ~/calculadora-bmc
# after Doppler has the keys:
doppler run --project bmc-backend --config prd -- npm run start:api
# or full stack
doppler run --project bmc-backend --config prd -- npm run dev
```

---

## 6. Anti-patterns

| Don't | Why |
|-------|-----|
| Use `FB_PAGE_TOKEN` / WA token | Wrong product; Insights will fail or leak messaging perms |
| Commit tokens / paste into git | Security |
| `echo $TOKEN \| doppler …` | Prefer `printf '%s'` |
| Assume fixture `act_109433652503382` is prod | Confirm via `/me/adaccounts` list |
| Expect LIVE before Cloud Run mounts secrets | Health shows flags; report stays Snapshot until mount + revision |

---

## 7. Related code (already shipped)

| Piece | Path |
|-------|------|
| Graph client | `server/lib/metaAdsClient.js` |
| Report orchestrator | `server/lib/marketIntel/metaAdsReport.js` |
| Routes | `GET /api/marketing/ads/meta/report`, `/health` |
| UI | `/hub/marketing` → Ads · Meta |
| Tests | `tests/market-intel/metaAdsLive.test.js` |
| SDD | `docs/sdd/meta-ads-live-report/SDD.md` |

---

## 8. Checklist

- [ ] Meta BM: system user + ads_read token  
- [ ] Meta BM: system user can see the ad account  
- [ ] `META_ADS_LIST_ACCOUNTS=1` → pick correct `act_`  
- [ ] `META_ADS_DRY_RUN=1` smoke green  
- [ ] Full bootstrap → Doppler + GSM + Cloud Run  
- [ ] Health `token_configured` / `account_configured` true in prod  
- [ ] UI Live + Actualizar → badge LIVE  
