# Recreation Checklist — Digital Marketing Agent

Use this to reinstall or validate the terminal analyst environment. Mark `[x]` when verified.

## A. Artifacts present

- [x] Project skill: `.grok/skills/digital-marketing-agent/SKILL.md`
- [x] Project agent: `.grok/agents/digital-marketing.md`
- [x] Claude agent: `.claude/agents/bmc-digital-marketing.md`
- [x] Playbooks under `references/playbooks/` (meta, google-ads, seo, cross-channel)
- [x] Report template: `references/report-template.md`
- [x] Health script: `scripts/health-probe.sh` (executable)
- [x] SDD: `docs/sdd/digital-marketing-agent/SDD.md`
- [x] Optional user mirrors: `~/.grok/skills/digital-marketing-agent`, `~/.grok/agents/digital-marketing.md`

## B. Discovery in Grok

- [ ] Skill appears in `/skills` or auto-invoke description matches digital marketing / Meta / AdWords / SEO
- [ ] Slash: `/digital-marketing-agent`
- [x] Agent type `digital-marketing` visible in `/config-agents` (or project agents)

## C. BMC API prerequisites

- [x] API reachable: local `http://127.0.0.1:3001` **or** Cloud Run panelin-calc base URL
- [x] Admin auth available: Bearer JWT or service token accepted by `requireServiceOrUser({ role: 'admin' })`
- [x] Env names known (values in Doppler/GSM only):
  - Meta: `META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID`
  - Google: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_OAUTH_CLIENT_ID`, `GOOGLE_ADS_OAUTH_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
  - Optional intel: `DATABASE_URL`

## D. Health probe

```bash
chmod +x .grok/skills/digital-marketing-agent/scripts/health-probe.sh
# or ~/.grok/.../scripts/health-probe.sh
BMC_API_TOKEN='…' bash .grok/skills/digital-marketing-agent/scripts/health-probe.sh \
  "${BMC_API_BASE:-http://127.0.0.1:3001}"
```

- [x] Script writes `/tmp/dma-health-*.txt` (or `DMA_RAW_DIR`)
- [x] Operator records per-channel mode: LIVE / Snapshot / Demo / HTTP 401 / UNKNOWN

## E. First report (acceptance)

- [x] Invoke skill: weekly review, range 7d, channels `all` (or subset) (Phase 1 agent-authored report from APIs; slash UI not re-tested this session)
- [x] Report includes freshness table
- [x] No invented LIVE metrics
- [x] P0 backlog ≤5 items with evidence fields
- [x] Report path printed (default `/tmp/dma-report-*.md`)

## F. Mutations (optional)

- [ ] Dry-run only unless user explicitly confirms apply
- [ ] Google mutate routes use `{ apply: true }` only after confirm (`server/routes/ads.js` pause/enable/budget/name)

## G. Sibling skills

- [ ] SEO deep work can load `market-keyword-research` and/or `site-spider-analyze`

## Done when

Sections A–E complete (F–G as needed). Time budget: **&lt;1 hour** with repo + API auth.
