# RECREATION-CHECKLIST — As-built Meta audit path

Goal: rebuild **today’s** static Meta ads intelligence in Marketing Hub (not Live Report).

## Can a team recreate?

- [x] Know SPA route `/hub/marketing` admin-only  
- [x] Know three tabs and where Meta UI lives (`IntelPanel` Ads)  
- [x] Load static JSON via `getAdsIntelligence`  
- [x] Expose via `GET /api/marketing/intel`  
- [x] Inject into brief (`formatAdsIntel`) and chat context  
- [x] Know Google live is `/api/ads` separate, no Hub UI  
- [x] Know Meta Marketing API is **not** integrated  
- [x] Env names for Google only (`GOOGLE_ADS_*`)  
- [ ] **UNKNOWN:** exact production Cloud Run service name for API  
- [ ] **UNKNOWN:** who last updated adsIntelligence.json and process to refresh  

## Falsifiable checks

```bash
# File exists
test -f server/lib/marketIntel/data/adsIntelligence.json

# No Meta live modules
! rg -q 'ads/meta|metaAdsClient|MetaAdsLiveReport' src server --glob '*.{js,jsx}'

# Mount present
rg -n 'api/marketing|api/ads' server/index.js
```

## Refresh audit data (manual ops — INFERRED)

1. Export/update campaign narrative from Meta Ads Manager.  
2. Edit `adsIntelligence.json` fields.  
3. Redeploy or restart API process (cache is process-level).  

---

For **Live Report** recreation, use `RECREATION-CHECKLIST.md` (design/PR1) instead.
