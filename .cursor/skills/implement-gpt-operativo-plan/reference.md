# Reference Guide

## Scope Guardrails

- Execute only tasks explicitly present in the provided execution plan.
- Treat the plan as source-of-truth for sequencing and acceptance criteria.
- Do not modify plan files; implement changes in target repos only.

## File-Level Expectations

### Backend hardening

- `server/index.js`: enforce JSON defaults for errors and unknown routes.
- `server/routes/calc.js`: wrap risky handlers with explicit JSON error returns.
- CORS must remain globally active unless the plan says otherwise.

### OpenAPI hardening

For each spec under `gpt/actions/`:

- Keep exactly one production `servers` entry.
- Ensure `operationId` values are stable, unique, and descriptive.
- Add explicit JSON error responses (`400`, `401`, `500`) when applicable.
- Resolve invalid refs before closing the task.

### Instruction hardening

For `gpt/instructions/*.md`:

- Preserve a single decision flow: intake -> qualify -> quote -> persist -> approve.
- Include tool safety, fallback behavior, and manual confirmation contract.
- Keep terminology consistent across files.

### Go-live docs

- Include Builder upload steps by action/spec.
- Add operation mapping table (action -> endpoint -> expected behavior).
- Include smoke test payloads and troubleshooting notes.

## Verification Baseline

Run at minimum:

1. Re-read each changed file for consistency and unresolved placeholders.
2. Run available lint/check commands relevant to edited files.
3. Confirm API errors return parseable JSON, not HTML.

## Delivery Checklist

- [ ] Todos completed in plan order
- [ ] No unresolved TODO/FIXME placeholders
- [ ] Verification evidence captured
- [ ] Final report includes risks and next steps
