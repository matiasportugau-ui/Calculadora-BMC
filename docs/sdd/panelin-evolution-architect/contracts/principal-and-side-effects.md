# Contract — Principal + SideEffectRegistry

**Seals:** `PANELIN_PRINCIPAL_V1` · `SIDE_EFFECT_REGISTRY_CONTRACT_V1`

## Principal

```text
Principal
├── subject_id
├── actor_type: customer | operator | service
├── roles
├── permissions
├── tenant_id
├── environment
├── auth_strength
└── session_id
```

`authorize(principal, action, resource, context)` — undeclared → **deny**.

## Hard rules

- Roles from JWT or DB — **never** from request headers after shared service token.  
- Service accounts: fixed scopes.  
- `pea:analyze` ⇏ `pea:implement` ⇏ `pea:merge`.  
- L4/L5 require durable grant rows.

## SideEffectRegistry fields

```text
tool_id
domain
effect_type
risk_level          # R0 read/calc | R1 reversible internal | R2 commercial mutate | R3 external/financial
reversible
idempotency_required
minimum_permission
approval_policy
allowed_environments
audit_event
compensation_action
```

Unregistered tool → **deny**.
