# Run 1 — owner handoff

PR: https://github.com/matiasportugau-ui/Calculadora-BMC/pull/1229 (draft).
Live notify needs **your** personal WhatsApp E.164 in `OWNER_WHATSAPP` — **not** 092 663 245.

## 1. Merge after CI green

Do not squash-merge until `config.js` keys, `.env.example`, `deploy-calc-api.yml` vars, and `package.json` `test:core` are on the PR if CI env-drift/tests require them.

```bash
gh pr merge 1229 --squash
gh workflow run deploy-calc-api.yml
```

## 2. GitHub vars (Cloud Run reads these)

```bash
gh variable set OMNI_IG_ENABLED --body 1
gh variable set OMNI_FB_ENABLED --body 1
gh variable set META_COMMENTS_ENABLED --body 0
gh variable set OWNER_WHATSAPP --body '<personal E.164 digits>'
gh variable set META_PAGE_ID --body '<page id>'
gh variable set META_IG_ACCOUNT_ID --body '<ig account id>'
```

Then redeploy. Doppler flags are for local `doppler run` only unless you also sync them.

## 3. Meta console

- Page: `messages`, `messaging_postbacks` → `/webhooks/messenger`
- Instagram: `messages` → `/webhooks/instagram`
- System User token (not 60-day user token)

## 4. Live proof

One IG DM + one Messenger DM → one Omni row each + WA on the personal phone in < 30s.
Then Run 1b (comments). Not before.
