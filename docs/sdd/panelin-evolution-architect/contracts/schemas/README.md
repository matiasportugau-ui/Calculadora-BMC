# PEA JSON Schemas (draft 2020-12)

Machine contracts for Panelin Evolution Architect persistence and API payloads.

| File | Entity | SDD | DB table |
|------|--------|-----|----------|
| [`gap-event.schema.json`](gap-event.schema.json) | GapEvent | §6 GapIngest, §12 glossary | `pea.gap_events` |
| [`gap.schema.json`](gap.schema.json) | Gap (aggregated) | §6.4 dedupe | `pea.gaps` |
| [`evolution-packet.schema.json`](evolution-packet.schema.json) | EvolutionPacket | §6.4c–d, ADR-009/010 | `pea.evolution_packets` |
| [`grant.schema.json`](grant.schema.json) | Grant | §6.1, ADR-002 | `pea.grants` |
| [`analysis-run.schema.json`](analysis-run.schema.json) | AnalysisRun | §6.3, §9.4 | `pea.analysis_runs` |

Related contracts:

- Dedupe: [`../fingerprint.md`](../fingerprint.md) (`PEA_GAP_FINGERPRINT_V1`)
- HTTP: [`../openapi-pea.yaml`](../openapi-pea.yaml)
- DDL: [`../../../../server/migrations/pea/001_pea_core.sql`](../../../../server/migrations/pea/001_pea_core.sql)

Validation (offline):

```bash
node -e "
const fs=require('fs'); const Ajv=require('ajv/dist/2020'); const ajv=new Ajv({allErrors:true, strict:false});
for (const f of fs.readdirSync('.').filter(x=>x.endsWith('.schema.json'))) {
  JSON.parse(fs.readFileSync(f,'utf8'));
  console.log('ok parse', f);
}
"
```
