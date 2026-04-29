# Cloud Run Deploy Mechanism — `panelin-calc`

> How code changes reach the Cloud Run service `panelin-calc` (project `chatbot-bmc-live`, region `us-central1`).
> Captured 2026-04-29 after the env/API/connections sweep made it clear the deploy path was undocumented.

---

## TL;DR

Three deploy paths exist. **Auto-deploy via Cloud Build trigger on `main`** is the canonical one. The other two are escape hatches.

| Path | When to use | Affects |
|------|-------------|---------|
| **A. Auto-deploy** (push to `main`) | Normal flow — every commit | Image + revision (full code refresh) |
| **B. Manual deploy** (`scripts/deploy-cloud-run.sh`) | When trigger is broken or you need to deploy a non-`main` branch | Image + revision (full code refresh) |
| **C. Env-only sync** (`run_ml_cloud_run_setup.sh`) | When secrets/env vars changed but code didn't | Revision only (same image, new env) |

---

## Path A — Auto-deploy (canonical)

**Trigger:** `rmgpgab-panelin-api-us-central1-matiasportugau-ui-GPT-PANELIitr` (Cloud Build)

| Field | Value |
|-------|-------|
| GitHub repo | `matiasportugau-ui/GPT-PANELIN-V3.3` (the canonical mirror; pushes to `Calculadora-BMC` propagate here) |
| Watched branch | `^main$` |
| Build worker | `gcr.io/cloud-builders/docker` |
| Image destination | `$_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$REPO_NAME/$_SERVICE_NAME:$COMMIT_SHA` |
| Concrete image | `us-central1-docker.pkg.dev/chatbot-bmc-live/cloud-run-repo/panelin-calc:<COMMIT_SHA>` |

**Flow:**

1. `git push origin main` lands the commit on GitHub.
2. Cloud Build trigger fires within seconds.
3. Build runs `docker build` (likely against `server/Dockerfile` — see `cloudbuild-api.yaml`) and pushes the image tagged with the commit SHA.
4. The trigger's deploy step (or a follow-up step) updates the Cloud Run service to use the new image.
5. Cloud Run creates a new revision (`panelin-calc-NNNNN-xxx`) and routes 100% traffic to it.

**Verifying it ran for a specific commit:**

```bash
SHA=$(git rev-parse HEAD)
gcloud run services describe panelin-calc --region=us-central1 \
  --format='value(spec.template.spec.containers[0].image)' \
  | grep "$SHA" && echo "✅ Cloud Run is on $SHA"
```

If the image tag matches HEAD, the deploy is current.

**Build logs:** `gcloud builds list --project=chatbot-bmc-live --limit=10` and follow `gcloud builds log <ID>` for the build of interest.

---

## Path B — Manual deploy (`scripts/deploy-cloud-run.sh`)

Use when: auto-deploy trigger is disabled/broken, you need to deploy a feature branch, or you want a hot-fix without waiting for the trigger.

```bash
# Default: Cloud Build (no local Docker needed)
./scripts/deploy-cloud-run.sh

# Local Docker variant
./scripts/deploy-cloud-run.sh --local-docker

# Skip build, just redeploy the existing image
./scripts/deploy-cloud-run.sh --no-build
```

**Important difference from Path A:** this script uses `cloudbuild.yaml` (which builds `Dockerfile.bmc-dashboard`) and pushes to `gcr.io/$PROJECT_ID/panelin-calc` — **not** the same image path as the auto-trigger. If you alternate between Path A and Path B, the Cloud Run service may flap between two image registries. Prefer Path A unless explicitly debugging.

The script then runs:

```bash
gcloud run deploy panelin-calc \
  --image gcr.io/chatbot-bmc-live/panelin-calc \
  --region us-central1 \
  --project chatbot-bmc-live \
  --platform managed \
  --allow-unauthenticated \
  --timeout=300
```

---

## Path C — Env-only sync (`run_ml_cloud_run_setup.sh`)

Use when: you rotated a secret, added an env var, or changed a Sheet ID. **Does not rebuild the image.**

```bash
./run_ml_cloud_run_setup.sh
# Or for a non-default service:
./run_ml_cloud_run_setup.sh staging-service-name
```

This calls `gcloud run services update --update-env-vars=… --update-secrets=…`, which produces a new revision **with the same image** but updated env. See `docs/procedimientos/CLOUD-RUN-SECRETS-SYNC.md` for the full procedure and what it syncs.

**Side effect:** revision counter increments. The new revision may show in `gcloud run services describe` with a recent timestamp even though the code didn't change. Don't be misled — check the image SHA to know whether code changed.

---

## Common diagnostic commands

```bash
# Active service summary
gcloud run services describe panelin-calc --region=us-central1 \
  --format="value(status.latestReadyRevisionName,status.url,spec.template.spec.containers[0].image)"

# All revisions, newest first (see image churn)
gcloud run revisions list --service=panelin-calc --region=us-central1 \
  --limit=10 --format="table(metadata.name,metadata.creationTimestamp,status.imageDigest)"

# Recent Cloud Build runs (auto-deploy + manual)
gcloud builds list --project=chatbot-bmc-live --limit=10 \
  --format="table(id,createTime,status,source.repoSource.commitSha,images[0])"

# All triggers
gcloud builds triggers list --project=chatbot-bmc-live \
  --format="table(name,filename,github.push.branch,disabled)"

# Recent images in Artifact Registry
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/chatbot-bmc-live/cloud-run-repo/panelin-calc \
  --limit=10 --sort-by=~CREATE_TIME \
  --format="table(IMAGE,CREATE_TIME,UPDATE_TIME,DIGEST)"
```

---

## Known oddities

1. **Two image registries in play.** Auto-deploy (Path A) pushes to `us-central1-docker.pkg.dev/.../cloud-run-repo/panelin-calc`. Manual deploy (Path B) pushes to `gcr.io/.../panelin-calc`. Cloud Run can use either, but cross-pollination causes confusion when reading `gcloud builds list` (filtered by region) vs Artifact Registry. **Stick with Path A** unless you have a specific reason.

2. **`gcloud builds list --region=us-central1` hides triggers from other regions.** The trigger system spans multiple regions (note `southamerica-east1` triggers in the list). If a build appears "missing" from the us-central1 list, check without the region filter.

3. **Tag may lag image bytes.** The image tag (`:<COMMIT_SHA>`) is set at push time. If a deploy script applies a tag retroactively to an existing image SHA, the bytes correspond to the original commit. Verify by image digest, not just tag, when correlating to source.

4. **Revisions outlive image deletes.** The active revision pins the image digest. Even if the tag is removed/overwritten in Artifact Registry, the revision keeps serving until it's replaced.

---

## Smoke checks after any deploy

```bash
# 1. Health (should be {ok:true, ...})
curl -s https://panelin-calc-q74zutv7dq-uc.a.run.app/health | jq

# 2. Image SHA matches HEAD?
gcloud run services describe panelin-calc --region=us-central1 \
  --format='value(spec.template.spec.containers[0].image)'
git log -1 --format="%H"

# 3. Recent fix probes (auth gates + pdf shape)
curl -s -o /dev/null -w "followups: %{http_code} (expect 401)\n" \
  -X POST -H "Content-Type: application/json" \
  https://panelin-calc-q74zutv7dq-uc.a.run.app/api/followups -d '{"title":"smoke"}'

curl -s -X POST -H "Content-Type: application/json" \
  https://panelin-calc-q74zutv7dq-uc.a.run.app/api/pdf/generate -d '{}' \
  | jq '.ok, .error'
```

---

## Related docs

- `docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md` — pre-deploy checklist (lint, tests, secrets sync).
- `docs/procedimientos/CLOUD-RUN-SECRETS-SYNC.md` — Path C details.
- `docs/procedimientos/PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md` — first-time bootstrap.
- `docs/EXTERNAL-CONNECTIONS.md` — what each env var actually controls.
- `docs/STATUS-REPORT-2026-04-29.md` — most recent state snapshot.
- `cloudbuild.yaml`, `cloudbuild-api.yaml`, `cloudbuild-frontend.yaml` — build configs.
- `scripts/deploy-cloud-run.sh` — manual deploy script.
- `run_ml_cloud_run_setup.sh` — env-only sync script.
