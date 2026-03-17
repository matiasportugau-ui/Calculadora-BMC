# Examples

## Example 1: Daily admin review

### User request

`Review today's billing export and list possible admin mistakes.`

### Expected behavior

1. Load CSV/XLS/XLSX and normalize columns by aliases.
2. Run duplicate, tax math and missing-field checks.
3. Return findings sorted by severity (`critical` first).
4. Provide immediate correction actions for admin team.

## Example 2: Month close control

### User request

`Audit 2026-03 billing and flag any out-of-period or invalid payment status records.`

### Expected behavior

- Apply `--period 2026-03` logic.
- Flag rows outside month as `high`.
- Detect paid-state contradictions as `medium`.
- Deliver summary with risk totals and top drivers.

## Example 3: Credit note integrity

### User request

`Find credit notes that look wrong in sign or structure.`

### Expected behavior

- Identify credit notes by `tipo` labels.
- Flag positive totals in credit notes.
- Suggest verification against origin invoice and policy.

## Example 4: Multi-source sanity check

### User request

`Use this internal export and tell me where admin data quality is weak.`

### Expected behavior

- Continue even if payment fields are missing.
- Explicitly declare analysis limits due to absent columns.
- Highlight recurring low/medium quality issues for SOP updates.
