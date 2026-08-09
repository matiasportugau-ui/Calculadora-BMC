# OMFT intake inbox

Drop the operator’s complete UI experience report here (or attach in chat and tell the agent the path).

## Naming

| Kind | Suggested name |
|------|----------------|
| Full written report | `OMFT-REPORT-YYYY-MM-DD-<slug>.md` |
| Photo pack folder | `OMFT-REPORT-YYYY-MM-DD-<slug>-figs/` (Fig-01.png …) |
| Voice transcript | `OMFT-REPORT-YYYY-MM-DD-<slug>-transcript.txt` |

## Next agent command

When files land (or are pasted in chat):

```text
OMFT intake
slug: <slug>
prep: docs/team/ux-feedback/runs/OMFT-PREP-YYYY-MM-DD-<slug>.md
report: docs/team/ux-feedback/runs/inbox/<file>
url: https://calculadora-bmc.vercel.app/...
env: prod
```

Follow skill: `.cursor/skills/operator-module-final-test/SKILL.md`  
Output: `docs/team/ux-feedback/USER-NAV-REPORT-YYYY-MM-DD-<slug>-omft.md`  
Implement **only** after operator approves NAV-IDs.

## Do not

- Commit secrets, passwords, or full private order payloads
- Implement product code during intake without approved NAV-IDs
