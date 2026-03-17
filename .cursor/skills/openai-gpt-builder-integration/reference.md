# Reference Guide

## Expected Builder Mapping

Map repository artifacts to GPT Builder sections:

- Name/Description -> identity fields in Builder
- `gpt/instructions/*.md` -> main Instructions
- `gpt/actions/*.yaml` -> Actions import
- `gpt/examples/*.md` -> smoke test sources and starter drafting
- `docs/builder-setup-checklist.md` -> operational completion checklist

## Action Validation Requirements

For each imported OpenAPI spec:

- Operations are visible and callable from Builder.
- Auth scheme matches backend expectation.
- Error responses are valid JSON and parse correctly.
- Required params are correctly typed and documented.

## Smoke Test Evidence Format

Capture each test with:

- Scenario name
- Input prompt
- Action invoked
- Output summary
- PASS/FAIL
- Notes (if failure)

## Common Failure Modes

- `Failed to Parse JSON`: API returned HTML/text or invalid JSON body.
- Missing operation in Builder: invalid OpenAPI structure or broken refs.
- Auth failures: incorrect token/header mapping.
- Silent fallback behavior: instructions not enforcing action usage.

## Minimal Exit Criteria

- [ ] Identity and instructions configured from repo source
- [ ] Required actions imported and callable
- [ ] At least 4 smoke tests executed
- [ ] Final status report includes blockers and next steps
