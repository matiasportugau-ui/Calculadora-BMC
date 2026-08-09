# Contract — Gap fingerprint (mass dedupe)

**Seal:** `PEA_GAP_FINGERPRINT_V1`

## Purpose

Stable identity for aggregated gaps. Same normalized failure → same `pea.gaps.fingerprint` regardless of session, request id, or timestamp jitter.

## Algorithm

```text
fingerprint_inputs (object)
  → normalizeInputs()
  → canonicalJson = JSON.stringify(sortedKeysDeep(normalized))
  → fingerprint = SHA-256(canonicalJson) as lowercase hex (64 chars)
  → store with fingerprint_version
```

Implementation reference (M1): `server/lib/pea/gapFingerprint.js`.

## Normalization rules

Apply in order before hashing:

| Field / path | Rule |
|--------------|------|
| `signal_type` | Required; lowercase snake_case |
| `source` | Required enum: `panelin_fast` \| `operator_feedback` \| `system_probe` |
| `tool_id` | If present: lowercase; strip version suffix after `@` |
| `error_code` | If present: uppercase; trim whitespace |
| `calc_surface` | If present: enum `techo` \| `pared` \| `mixto` \| `unknown` |
| `message_template` | If present: collapse whitespace; truncate to 512 chars |
| **Strip (never hash)** | `session_id`, `request_id`, `trace_id`, `occurred_at`, `user_id`, `conversation_id`, `message_id`, raw stack traces, phone, email |
| `payload` | Keep only whitelisted keys after strip; drop null/empty strings |

Deep sort: object keys sorted lexicographically at every level; arrays preserve order unless `sort_arrays: true` in `fingerprint_version` bump.

## fingerprint_version

| Version | Change |
|---------|--------|
| `1` | Initial: rules above; arrays not sorted |
| Bump | Any change to strip list, key whitelist, or sort policy → increment version; old fingerprints remain on historical rows |

Colliding distinct bugs under one fingerprint: use manual split API (SDD §11) — do not silently change v1 in place.

## Dedupe flow

```text
GapEvent → normalizeInputs → hash → lookup pea.gaps BY (fingerprint, fingerprint_version)
  ├─ hit  → increment gap_occurrences; update last_seen
  └─ miss → insert pea.gaps + first occurrence
# EXPORT_SEAL: PEA_MASS_GAP_DEDUPE_V1 (see SDD §6.4)
```

## Schema cross-ref

- Input shape: [`schemas/gap-event.schema.json`](schemas/gap-event.schema.json) → `fingerprint_inputs`
- Aggregated row: [`schemas/gap.schema.json`](schemas/gap.schema.json) → `fingerprint`, `fingerprint_version`
