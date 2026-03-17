# Cloud Run `panelin-calc` — Review & Suggestions

## Current config (from REST v2 describe)

| Setting | Value | Note |
|--------|--------|------|
| **Scaling** | min: not set, max: 20 | Scale-to-zero enabled |
| **Timeout** | 30s | Request timeout |
| **Service account** | `642127786762-compute@developer.gserviceaccount.com` | Default compute SA |
| **Execution env** | (default) | Gen 2 |
| **Traffic** | 100% latest | Single revision |
| **URI** | `https://panelin-calc-q74zutv7dq-uc.a.run.app` | Live URL |

---

## Suggestions

### 1. Use the bypass script (no gcloud describe)

- **In Cloud Shell:** use the one-liner or the script you saved as `~/cloudrun-describe.sh`.
- **From repo:** run `./scripts/cloudrun-describe-via-api.sh` (needs `gcloud` in PATH or `CLOUDRUN_ACCESS_TOKEN`). It also prints containers cpu/memory, ingress, and conditions.

### 2. Optional: set min instances (reduce cold starts)

If the first request after idle is too slow:

```bash
gcloud run services update panelin-calc --region=us-central1 --min-instances=1 --project=chatbot-bmc-live
```

Revert to scale-to-zero:

```bash
gcloud run services update panelin-calc --region=us-central1 --min-instances=0 --project=chatbot-bmc-live
```

### 3. Optional: increase timeout

If some requests need more than 30s (e.g. long calc or external APIs):

```bash
gcloud run services update panelin-calc --region=us-central1 --timeout=60 --project=chatbot-bmc-live
```

### 4. Run full describe in Cloud Shell (containers + conditions)

To see CPU, memory, image, and readiness in one go, run the repo script. In Cloud Shell, either clone the repo or paste this (same logic as `scripts/cloudrun-describe-via-api.sh`):

```bash
~/cloudrun-describe.sh
# Or with args: ~/cloudrun-describe.sh panelin-calc us-central1 chatbot-bmc-live
```

To add containers and conditions to your saved script, use the full script from the repo or the extended one-liner below.

### 5. Keep gcloud updated

The `gcloud run services describe` crash may be fixed in a newer SDK:

```bash
gcloud components update
```

---

## Extended one-liner (containers + conditions)

Paste in Cloud Shell for a fuller summary:

```bash
SERVICE=panelin-calc REGION=us-central1 PROJECT=chatbot-bmc-live
URL="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/${SERVICE}"
JSON="$(curl -sS -H "Authorization: Bearer $(gcloud auth print-access-token)" "${URL}")"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
t=d.get('template') or {}
s=d.get('scaling') or {}
print('=== Scaling ==='); print('min:', s.get('minInstanceCount'), 'max:', s.get('maxInstanceCount'))
print('=== Template ==='); print('timeout:', t.get('timeout'), 'serviceAccount:', t.get('serviceAccount'), 'executionEnv:', t.get('executionEnvironment'))
for i,c in enumerate(t.get('containers') or []):
  r=c.get('resources') or {}
  print('=== Container', i, '==='); print('  image:', c.get('image')); print('  cpu:', r.get('cpu'), 'memory:', r.get('memoryLimit'))
print('=== Traffic ==='); [print('  ', x.get('revision'), x.get('percent'), '%') for x in (d.get('traffic') or [])]
print('=== URI ===', d.get('uri'))
tc=d.get('terminalCondition') or {}
print('=== Ready ===', tc.get('state'), tc.get('message','')[:100])
"
```

---

## Summary

- **Describe:** Use REST bypass (script or one-liner); avoid `gcloud run services describe` until the SDK bug is fixed.
- **Config:** Current values are fine for a typical calc API; tune min instances and timeout only if you see cold-start or long-request issues.
- **Script:** `~/cloudrun-describe.sh` in Cloud Shell and `scripts/cloudrun-describe-via-api.sh` in the repo stay in sync by reusing the same URL + Python parsing.
