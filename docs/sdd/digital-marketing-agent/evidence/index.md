# Evidence Index — Digital Marketing Agent

Tags: **CONFIRMED** (path exists / line cited) · **INFERRED** (reasonable from code) · **UNKNOWN** (not verified)

| ID | Claim | Tag | Evidence |
|----|-------|-----|----------|
| E-01 | Marketing router mounted at `/api/marketing` | CONFIRMED | `server/index.js:1117` `app.use("/api/marketing", marketingRouter)` |
| E-02 | Ads router mounted at `/api/ads` | CONFIRMED | `server/index.js:1119` `app.use("/api/ads", adsRouter)` |
| E-03 | Meta health route | CONFIRMED | `server/routes/marketing.js:483` `GET /ads/meta/health` |
| E-04 | Meta report route | CONFIRMED | `server/routes/marketing.js:467` `GET /ads/meta/report` |
| E-05 | Meta ads insights AI | CONFIRMED | `server/routes/marketing.js:494` `POST /ai/ads-insights` |
| E-06 | Marketing keywords GET | CONFIRMED | `server/routes/marketing.js:292` |
| E-07 | Dashboard summary | CONFIRMED | `server/routes/marketing.js:59` |
| E-08 | Google Ads list accounts | CONFIRMED | `server/routes/ads.js:56` `GET /accounts` |
| E-09 | Google Ads campaigns | CONFIRMED | `server/routes/ads.js:69` |
| E-10 | Google Ads report | CONFIRMED | `server/routes/ads.js:91` |
| E-11 | Google pause mutate (dry-run default) | CONFIRMED | `server/routes/ads.js:183–189` + `googleAdsClient.js:12–15` |
| E-12 | Meta env: META_ADS_ACCESS_TOKEN, META_ADS_ACCOUNT_ID | CONFIRMED | `server/config.js:188–189` |
| E-13 | Google env: DEVELOPER_TOKEN, OAUTH_*, REFRESH_TOKEN, LOGIN_CUSTOMER_ID | CONFIRMED | `server/config.js:177–181` |
| E-14 | Dry-run requires apply:true for mutates | CONFIRMED | `server/lib/googleAdsClient.js:12–15` |
| E-15 | Grok skill on disk (project) | CONFIRMED | `.grok/skills/digital-marketing-agent/SKILL.md` |
| E-16 | Grok agent definition (project) | CONFIRMED | `.grok/agents/digital-marketing.md` |
| E-17 | Claude agent | CONFIRMED | `.claude/agents/bmc-digital-marketing.md` |
| E-18 | Health probe script | CONFIRMED | `.grok/skills/digital-marketing-agent/scripts/health-probe.sh` |
| E-19 | Channel playbooks | CONFIRMED | `.grok/skills/digital-marketing-agent/references/playbooks/*.md` |
| E-20 | Meta setup procedure | CONFIRMED | `docs/procedimientos/META-ADS-SETUP.md` |
| E-21 | Google Ads setup procedure | CONFIRMED | `docs/procedimientos/GOOGLE-ADS-SETUP.md` (referenced by client header) |
| E-22 | requireServiceOrUser admin on marketing/ads | CONFIRMED | `marketing.js:12`, `ads.js:23` `requireServiceOrUser({ role: 'admin' })` |
| E-23 | Sibling skill market-keyword-research | CONFIRMED | `~/.grok/skills/market-keyword-research/SKILL.md` (user) |
| E-24 | Sibling skill site-spider-analyze | CONFIRMED | `~/.grok/skills/site-spider-analyze/SKILL.md` |
| E-25 | Meta Graph client GRAPH v21.0 | CONFIRMED | `server/lib/metaAdsClient.js:5–6` |
| E-26 | Parent Meta Live Report SDD | CONFIRMED | `docs/sdd/meta-ads-live-report/SDD.md` |
| E-27 | MCP meta-ads / google-ads session-dependent | INFERRED | User session MCP list; auth may fail |
| E-28 | User-level skill mirror `~/.grok/skills/digital-marketing-agent` | CONFIRMED | Installed 2026-08-01 (same content as project) |

## File inventory (agent environment)

```
.grok/skills/digital-marketing-agent/
  SKILL.md
  scripts/health-probe.sh
  references/data-sources.md
  references/report-template.md
  references/playbooks/{meta-ads,google-ads,seo,cross-channel}.md
.grok/agents/digital-marketing.md
.claude/agents/bmc-digital-marketing.md
docs/sdd/digital-marketing-agent/{SDD,TARGET,RECREATION-CHECKLIST,evidence/,audit/}
```
