# Digital Marketing Agent — Report Template

Use this structure for every full report. Omit sections only when channel is out of scope (mark **N/A**).

```markdown
# Digital Marketing Report — {Brand}
**As of:** {ISO datetime}  
**Range:** {7d|30d|custom}  
**Prepared by:** Digital Marketing Agent (Grok)  
**Mode:** {quick|report|deep}

## 0. Executive summary
- 3–6 bullets: what happened, what to do next
- One-line health: 🟢 / 🟡 / 🔴 + reason

## 1. Freshness & sources
| Channel | Mode | Source | Notes |
|---------|------|--------|-------|
| Meta | LIVE\|Snapshot\|Demo\|UNKNOWN | endpoint/path | |
| Google Ads | … | … | |
| SEO | PUBLIC\|… | … | |
| Market intel | … | … | |

## 2. Scorecards
### 2.1 Meta
| KPI | Value | vs prior | Note |
|-----|-------|----------|------|
| Spend | | | |
| Impressions | | | |
| Clicks | | | |
| CTR | | | |
| Leads / results | | | null if missing |
| CPL / CPA | | | |

### 2.2 Google Ads
(same table)

### 2.3 Organic / SEO (proxies OK)
| Signal | Value | Confidence |
|--------|-------|------------|
| Priority keywords tracked | | |
| SERP visibility sample | | |
| On-site gaps | | |

## 3. What is working
- Bullet list with campaign/adset/ad/keyword + metric + source

## 4. Waste & risks
- High spend low outcome
- Tracking broken (null conversions)
- Policy / disapproved
- Zombie campaigns still spending

## 5. Channel deep-dives
### 5.1 Meta
### 5.2 Google Ads
### 5.3 SEO
### 5.4 Cross-channel

## 6. Prioritized backlog
| ID | P | Channel | Action | Evidence | Lever | Effort | Risk | Human gate |
|----|---|-----------|--------|----------|-------|--------|------|------------|
| R1 | P0 | | | | | S | low | no |

## 7. Proposed tests (next 14 days)
| Test | Hypothesis | Primary metric | Stop rule |
|------|------------|----------------|-----------|

## 8. Open questions / data gaps
- What we could not see and why

## 9. Next check
- Suggested date + what to re-pull

## Appendix
- Raw JSON paths under /tmp/dma-raw-*
- Commands run
```

### Chat summary (always)

After writing the file, reply with:

1. Health emoji + one sentence  
2. Top 3 P0 actions  
3. Full report path  
4. Blockers (auth, secrets, MCP)
