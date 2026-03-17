# Examples

## Example 1: Full execution request

### User request

`Implementa el plan gpt_operativo_completo adjunto y dejalo listo para go-live.`

### Expected behavior (example 2)

1. Read plan and create ordered progress checklist.
2. Execute backend hardening changes.
3. Execute OpenAPI hardening changes.
4. Complete instructions and go-live docs.
5. Verify and report by plan section.

## Example 2: Missing artifact during execution

### Situation (example 3)

`gpt/instructions/manual-gates.md` does not exist.

### Expected behavior (example 3)

- Create the missing file with required confirmation contract.
- Continue the sequence without skipping remaining sections.
- Report file creation explicitly in final output.

## Example 3: JSON parse failure

### Situation

Builder call fails with `Failed to Parse JSON`.

### Expected behavior

1. Inspect endpoint response shape and content type.
2. Align error schema with OpenAPI response definitions.
3. Retest the same action and report PASS/FAIL.
