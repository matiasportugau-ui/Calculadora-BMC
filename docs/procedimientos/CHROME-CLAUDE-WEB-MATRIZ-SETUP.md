# Chrome + Claude (web extension) — MATRIZ / Cloud Run credentials playbook

Use this when you want **Claude in the browser** to walk you through (or semi-automate clicks on) **Google Cloud Console** to fix:

`GET /api/actualizar-precios-calculadora` → needs **`GOOGLE_APPLICATION_CREDENTIALS`** pointing to a **mounted JSON file** + MATRIZ shared with that service account.

**Project:** `chatbot-bmc-live`  
**Region:** `us-central1`  
**Cloud Run service:** `panelin-calc`  
**MATRIZ sheet ID (default in repo):** `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`

---

## Part A — Tabs to open (order + arrange)

Open these in **one Chrome window**, left-to-right (or use tab groups **“MATRIZ setup”**):

| # | Tab | URL (open exactly) |
|---|-----|---------------------|
| 1 | **Cloud Run service** | `https://console.cloud.google.com/run/detail/us-central1/panelin-calc?project=chatbot-bmc-live` |
| 2 | **Secret Manager** | `https://console.cloud.google.com/security/secret-manager?project=chatbot-bmc-live` |
| 3 | **IAM — Service accounts** | `https://console.cloud.google.com/iam-admin/serviceaccounts?project=chatbot-bmc-live` |
| 4 | **Google Sheet MATRIZ** | `https://docs.google.com/spreadsheets/d/1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo` |
| 5 | **Verify endpoint (optional)** | After deploy: your Cloud Run base URL + `/api/actualizar-precios-calculadora` (open only after Claude says to test) |

**Window layout tip:** Pin tabs 1–4. Keep **Claude extension** side panel open on the **right** so the console stays visible.

---

## Part B — Screenshots *you* take before chatting (so Claude doesn’t guess UI)

Take **full-page or wide screenshots** (PNG). **Redact** any API keys, tokens, or JSON private keys if visible.

**Naming:** `gcp-01-run-service-top.png`, `gcp-02-run-variables.png`, …

| Shot ID | Where to capture | What Claude needs to see |
|---------|------------------|---------------------------|
| S1 | Cloud Run → `panelin-calc` → **top of service page** | Service name, region, URL |
| S2 | Same → **Revisions** tab | Latest revision, traffic |
| S3 | **Edit & deploy new revision** → scroll **Variables & secrets** | Existing env var *names* only ok; blur values |
| S4 | Same screen → **Volumes** section (or empty state) | Whether a secret volume already exists |
| S5 | Secret Manager **list** | Existing secret names (no values) |
| S6 | IAM → **Service accounts** list | Which SA you use for Sheets (email visible) |
| S7 | Google Sheet → **Share** dialog | Shows SA email has access (blur unrelated emails if you want) |

Upload **S1–S7** into the **same Claude conversation** (or the extension’s image upload) **before** running the big prompt below.

---

## Part C — Full prompt to paste into Claude (Chrome extension)

Copy everything in the fenced block **verbatim**, then attach your screenshots.

```
You are helping me configure Google Cloud Run so my API endpoint returns CSV from Google Sheets.

CONTEXT (facts — do not invent URLs):
- GCP project: chatbot-bmc-live
- Cloud Run service: panelin-calc
- Region: us-central1
- The Express route GET /api/actualizar-precios-calculadora requires:
  (1) BMC_MATRIZ_SHEET_ID (optional default exists in code; I will set explicitly)
  (2) GOOGLE_APPLICATION_CREDENTIALS = absolute path to a JSON key file INSIDE the container
  (3) The JSON file must exist on disk (mounted from Secret Manager)
- MATRIZ spreadsheet ID to use: 1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo
- The service account in the JSON must have at least Viewer on that spreadsheet.

GOAL:
1) Create OR reuse a Secret Manager secret holding the service account JSON key (full JSON text as secret payload).
2) Mount that secret as a volume on Cloud Run service panelin-calc.
3) Set env var GOOGLE_APPLICATION_CREDENTIALS to the exact mount path of the file inside the container (as shown in Cloud Console after mounting).
4) Set env var BMC_MATRIZ_SHEET_ID to 1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo
5) Deploy new revision.
6) Tell me the exact curl command to verify (using gcloud run services describe to get BASE) and what success looks like (CSV vs JSON error).

CONSTRAINTS:
- Never ask me to paste private keys or full JSON into chat. I will only paste into Secret Manager UI or upload via secure UI.
- If multiple UI paths exist, prefer: Cloud Run → Edit & deploy new revision → Volumes (secret) + Environment variables.
- If something is ambiguous, ask ONE clarifying question, then continue.
- After each major step, state what I should see on screen (1 sentence).

I have attached screenshots S1–S7 of my current console/Sheets state. Use them to avoid wrong menus.

Start by confirming from the screenshots: whether a secret volume already exists, whether GOOGLE_APPLICATION_CREDENTIALS is already set, and the next single action I should click.
```

---

## Part D — After Claude finishes — your verification (terminal)

```bash
gcloud config set project chatbot-bmc-live
BASE="$(gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)')"
curl -sS "$BASE/api/actualizar-precios-calculadora" | head -c 500
```

Success: response looks like **CSV** (comma-separated header with `path`, etc.).  
Failure: JSON error → send Claude **only** the error **type/text** (not secrets), plus a fresh screenshot of **Variables & secrets** + **Volumes**.

---

## Part E — If Claude “gets lost”

Short nudge you can paste:

```
Stay in project chatbot-bmc-live only. Service panelin-calc, region us-central1.
Do not use generic Google docs—use the exact Cloud Run “Edit & deploy new revision” flow.
Next click only: [Volumes → Add volume → Secret] OR [Variables → Add variable], one at a time.
```

---

## Security

- Rotate credentials if they were ever exposed in logs or chat.
- Prefer Secret Manager over pasting JSON into environment variables.
