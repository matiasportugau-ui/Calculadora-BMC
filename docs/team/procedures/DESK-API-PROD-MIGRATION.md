# Desk API — Production Migration Runbook (Hito 1 · D1/D6/D10/D11)

**Status:** ready to execute when the owner approves. Nothing here runs automatically.
**Owner gate:** Matías. Prod traffic for `panelin-calc` is currently **pinned** to a named revision
(see §0) — merging to `main` does not make the desk live by itself.

## What ships

| Piece | Path |
|-------|------|
| Schema (idempotent, `IF NOT EXISTS`) | `server/migrations/desk/001_desk.sql` → `matriz_snapshots`, `desk_reviews` |
| Queue logic | `server/lib/deskQueue.js` |
| Frozen Matriz (D6) | `server/lib/matrizSnapshot.js` — content-addressed version `MATRIZ-<sha256[0:16]>` |
| Router (mounted `app.use("/api", deskRouter)`) | `server/routes/desk.js` |

Routes (all under `/api`):

| Method | Path | Auth |
|--------|------|------|
| GET | `/desk/health` | none |
| GET | `/desk/queue`, `/desk/:id` | `canales:read` |
| POST | `/desk/reviews` | `canales:write` |
| POST | `/desk/:id/edit-cause`, `/desk/:id/approve-send` | `canales:write` |
| PATCH | `/desk/:id/status` | `canales:write` |

Auth is the identity JWT (`requireGrant`), **not** `API_AUTH_TOKEN`. Writes need `canales:write`,
the same grant Omni uses to send replies — grant it per operator in `/hub/admin/users`.

Without the tables, `/api/desk/*` returns 503/500; the rest of the API is unaffected (pool is lazy,
nothing runs at boot).

## 0. Pre-checks

```bash
# Which revision serves traffic? (pinned vs latest)
gcloud run services describe panelin-calc --region us-central1 --project chatbot-bmc-live \
  --format='value(status.traffic,status.latestCreatedRevisionName)'

# Omni tables must exist (desk_reviews has FKs to omni_conversations / omni_contacts)
doppler run --project bmc-backend --config prd -- \
  sh -c 'psql "$DATABASE_URL" -Atc "select to_regclass('\''omni_conversations'\''), to_regclass('\''omni_contacts'\'')"'
```

Both regclass values must be non-empty. If not, run `npm run omni:migrate` first.

## 1. Apply the schema

```bash
cd ~/calculadora-bmc   # on an up-to-date main
doppler run --project bmc-backend --config prd -- \
  sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f server/migrations/desk/001_desk.sql'

doppler run --project bmc-backend --config prd -- \
  sh -c 'psql "$DATABASE_URL" -Atc "select count(*) from matriz_snapshots; select count(*) from desk_reviews;"'
```

`-1` wraps the file in one transaction; re-running is a no-op.

## 2. Deploy

Deploys go through CI only: a green **CI — Panelin Calculadora BMC** run on `main` triggers
`.github/workflows/deploy-calc-api.yml` (Docker image → Cloud Run `panelin-calc`). Do not use
`gcloud run deploy --source .` — the root Dockerfile builds the SPA, not the API.

If traffic is pinned (§0), the new revision gets no traffic until you move it:

```bash
gcloud run services update-traffic panelin-calc --region us-central1 --project chatbot-bmc-live --to-latest
```

## 3. Smoke

```bash
API=https://panelin-calc-q74zutv7dq-uc.a.run.app
curl -s "$API/health" | jq .ok                       # true
curl -s "$API/api/desk/health"                        # {"ok":true,"source":"postgres",...}
```

Authenticated create (needs an operator Bearer JWT with `canales:write`; get one from a logged-in
session via `POST /auth/refresh`):

```bash
TOKEN=...   # identity JWT
curl -s "$API/api/actualizar-precios-calculadora" -o /tmp/matriz.csv
jq -n --rawfile csv /tmp/matriz.csv '{channel:"manual", matrizCsv:$csv, payload:{smoke:true}}' \
  | curl -s -X POST "$API/api/desk/reviews" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @- | jq .
# Expect 201: review.matriz_version = "MATRIZ-<16 hex>", status "pending"
```

`jq --rawfile` keeps newlines/quotes in the CSV intact. Posting the same CSV again reuses the same
`matriz_version` (no duplicate snapshot). Mark the smoke row discarded afterwards:

```bash
curl -s -X PATCH "$API/api/desk/<id>/status" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"discarded"}'
```

## 4. Monitor (first 24 h)

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="panelin-calc"
  AND httpRequest.requestUrl:"/api/desk/" AND httpRequest.status>=500' \
  --project chatbot-bmc-live --freshness=24h --limit=50

doppler run --project bmc-backend --config prd -- sh -c 'psql "$DATABASE_URL" <<SQL
select status, count(*) from desk_reviews where created_at > now() - interval '"'"'24 hours'"'"' group by 1;
select count(*) as orphans from desk_reviews r
  left join matriz_snapshots s on s.version = r.matriz_version
  where r.matriz_version is not null and s.version is null;
SQL'
```

`orphans` must be 0.

## 5. Rollback

**App rollback (default — keeps all data):** route traffic back to the previous revision.

```bash
gcloud run revisions list --service panelin-calc --region us-central1 --project chatbot-bmc-live --limit 5
gcloud run services update-traffic panelin-calc --region us-central1 --project chatbot-bmc-live \
  --to-revisions <previous-revision>=100
```

The desk tables stay; the old revision simply doesn't use them.

**Schema removal (destructive, only if no real reviews exist):** dropping the tables deletes every
review and snapshot. Export first and get explicit owner approval:

```bash
doppler run --project bmc-backend --config prd -- sh -c '
  psql "$DATABASE_URL" -c "\copy desk_reviews to /tmp/desk_reviews.csv csv header" &&
  psql "$DATABASE_URL" -c "\copy matriz_snapshots to /tmp/matriz_snapshots.csv csv header"'
# then, only with approval:
# psql "$DATABASE_URL" -1 -c "drop table desk_reviews; drop table matriz_snapshots;"
```

## Post-migration

- [ ] `/api/desk/health` → `ok:true`
- [ ] Smoke review created and discarded
- [ ] 0 orphans, no 5xx on `/api/desk/*` after 24 h
- [ ] PROJECT-STATE "Cambios recientes" updated
