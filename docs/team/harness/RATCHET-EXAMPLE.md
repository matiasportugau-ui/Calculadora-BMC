# Ratchet example — failure becomes permanent

## Incident (synthetic, pattern from live history)

**Symptom:** Agent (or human) merged code that reintroduced a hardcoded sheet-ish ID near sheet keywords, or skipped release goldens, and prod smoke mis-blamed API keys when `ASSISTANTS_ACTIVE` omitted `ml`.

## Flywheel steps

1. **Trace** — note the failure mode (deploy without flag / silent golden skip).  
2. **Feedback** — classify: sensor miss (no hard release golden) + control plane miss.  
3. **Eval / sensor** — add:
   - `pre-release` with `GOLDEN_REQUIRED=1`
   - `test:fitness` human-gate + hardcode checks  
4. **Guide** — one line in AGENTS + row in RULE-PROVENANCE.  
5. **Harness PR** — land sensors first; prose second.  
6. **Score** — `npm run harness:score:report` must show behaviour_goldens + enforcement_hooks up.

## Template for next ratchet

```
Failure:
Classification: guide | sensor | tool | model-limit
Sensor added:
Guide added (optional):
Provenance row:
Score before/after:
```
