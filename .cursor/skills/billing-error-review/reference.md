# Billing Error Review - Reference

## 1) Column normalization map

The checker normalizes these logical fields from common aliases:

| Logical field | Accepted aliases (examples) |
| --- | --- |
| `tipo` | tipo, tipo cfe, tipo doc, comprobante, document type |
| `serie` | serie, serie doc, branch |
| `numero` | numero, nro, nro doc, invoice number, dnro |
| `fecha` | fecha, fecha emision, issue date, fecha comprobante |
| `rut_cliente` | rut, ruc, rut cliente, customer tax id |
| `neto` | neto, subtotal, taxable amount, monto neto |
| `impuesto` | iva, tax, monto iva, impuesto |
| `total` | total, amount total, importe total |
| `estado_pago` | estado, payment status, pagado, cobrador estado |
| `fecha_pago` | fecha pago, payment date, fecha cobro |
| `referencia_pago` | ref pago, payment ref, comprobante pago |

## 2) Validation rules

### A) Duplicate document key

- Key: `tipo|serie|numero`
- Trigger: same key appears more than once.
- Severity: `critical`
- Suggested fix: keep one valid document and trace correction.

### B) Tax math mismatch

- Formula: `neto + impuesto` should equal `total`.
- Tolerance: configurable (`--tolerance`, default 2.00).
- Severity: `critical` if mismatch exceeds tolerance.
- Suggested fix: correct line totals or tax assignment.

### C) Missing required values

Required fields:

- `tipo`, `numero`, `fecha`, `neto`, `impuesto`, `total`

Severity:

- `high` when missing document identity/date.
- `medium` when missing monetary fields but doc id exists.

### D) Credit note sign/use check

A document is considered credit note if `tipo` includes:
`nc`, `nota de credito`, `credit note`.

- Trigger: credit note with positive total.
- Severity: `medium`
- Suggested fix: verify sign and association to origin invoice.

### E) Period cut-off mismatch

When `--period YYYY-MM` is provided:

- Trigger: valid date is outside target month.
- Severity: `high`
- Suggested fix: re-check posting period and close controls.

### F) Payment status contradiction

Paid states recognized:
`paid`, `pagado`, `cobrado`, `cancelado`.

- Trigger: paid status without `fecha_pago` and without
  `referencia_pago`.
- Severity: `medium`
- Suggested fix: complete payment evidence or adjust status.

## 3) Severity model

| Severity | Operational meaning |
| --- | --- |
| `critical` | High financial risk or immediate misstatement |
| `high` | Period/reporting issue requiring prompt correction |
| `medium` | Process inconsistency affecting reliability |
| `low` | Data quality issue with low immediate impact |

## 4) Remediation playbook

### Same day

- Resolve `critical` duplicates and tax mismatches.
- Freeze affected documents from further processing.

### This week

- Resolve `high` period/date issues and missing mandatory fields.
- Validate credit note references and sign usage.

### Month close

- Review repeated `medium/low` patterns.
- Update admin SOP and checklist to prevent recurrence.

## 5) Output schema expected

### `diagnostico_rapido`

- total rows analyzed
- findings by severity
- findings by error type
- top risk drivers

### `hallazgos`

Row-level list:

- row number
- `doc_key`
- error type
- severity
- message
- suggested action

### `acciones_recomendadas`

Prioritized list grouped by urgency:
today / this week / month close.
