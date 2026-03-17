# Examples

## Example 1: End-to-end setup

### User request

`Deja el GPT de ventas listo en OpenAI Builder con actions y pruebas.`

### Expected behavior (example 2)

1. Read instructions and OpenAPI from repository.
2. Configure identity and full instruction block in Builder.
3. Import actions and set auth.
4. Run smoke tests and provide PASS/FAIL report.

## Example 2: Action auth ambiguity

### Situation (example 3)

Spec is imported but auth type is unclear.

### Expected behavior (example 3)

- Pause only for a focused confirmation about auth method.
- Do not guess tokens or secret formats.
- Resume execution immediately after user confirmation.

## Example 3: Missing required source file

### Situation

`gpt/instructions/manual-gates.md` is missing.

### Expected behavior

- Mark it as a blocker candidate.
- Propose creation with minimal contract content.
- Continue with remaining valid assets and report the gap.
