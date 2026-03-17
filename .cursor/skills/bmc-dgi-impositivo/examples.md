# Examples

## Example 1: Conciliacion IVA mensual

### User request (example 2)

`Cruza CFE emitidos/recibidos con mi sistema y decime por que no cierra el IVA de enero 2026.`

### Expected behavior (example 2)

1. Validate available files for the notified period.
2. Normalize keys (tipo, serie, numero, fecha, RUT, neto, IVA, total).
3. Reconcile debit/credit and classify differences by cause label.
4. Deliver executive summary and technical evidence list.

## Example 2: Vista Art. 46

### User request

`Tengo Vista Art. 46 por diferencia de IVA. Necesito borrador tecnico de descargo.`

### Expected behavior (example 3)

- Prioritize notified period first.
- Separate verified facts from hypotheses.
- Build evidence-backed discrepancy table.
- Produce draft response with pending items for accountant/lawyer validation.

## Example 3: Incomplete data

### Situation

No bank extract is provided.

### Expected behavior

- Continue with DGI + billing sources.
- Explicitly mark analytical limits due to missing bank traceability.
- Keep conclusions conditional where certainty is reduced.
