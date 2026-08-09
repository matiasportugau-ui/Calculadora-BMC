# Contract — PEA PostgreSQL Queue

**Seal:** `PEA_POSTGRES_QUEUE_V1`

```text
Business TX
├── GapEvent / occurrence
└── OutboxEvent
      → Outbox Dispatcher
      → pea_jobs
      → Worker FOR UPDATE SKIP LOCKED
```

## Rules

- GapEvents **must not** use in-memory `omni/eventBus` as sole channel.  
- Prefer sister table `pea_jobs` sharing claim/retry helpers with `omni_ai_jobs`.  
- Do not mix PEA job state into Omni conversation job rows without domain migration ADR.  
- Pub/Sub deferred until multi-consumer/fan-out need is proven.
