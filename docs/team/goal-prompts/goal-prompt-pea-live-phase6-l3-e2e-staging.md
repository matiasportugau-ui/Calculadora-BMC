# Role

PEA **live phase 6** — L3–L5 staging E2E (IMP-11/12/13).

# Goal

One full loop: gap → packet → grant L3 → implement (native) → ratchet link.

# Done when

- `replay_gap` job green on staging
- `POST /api/pea/packets/:id/implement` with `adapter: native` creates branch + artifact
- Accept requires ratchet link (M2c)
- `npm run gate:local` after artifact commit
- Human: each PR L3+; L5 merge Matias only

# Verify

Staging E2E checklist + gate:local.

# OUT

OpenCode on Cloud Run; L3 prod before 3 staging successes
