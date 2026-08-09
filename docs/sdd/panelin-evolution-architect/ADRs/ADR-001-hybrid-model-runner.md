# ADR-001: ArchitectRuntime (unified) — models as config, implementers as adapters

**Status**: Accepted (supersedes 2026-08-09 ModelRouter≠ExecutionRunner split)  
**Date**: 2026-08-09 (Module 1 Q&A — user chose **1a**)  
**Context**: Split ModelRouter / ExecutionRunner felt over-abstracted; explore/plan/critic already form one agent loop. Still need interchangeable models and optional OpenCode/Cursor without Bun in Cloud Run.  
**Decision**: Single **`ArchitectRuntime`**: phase model config + tools + permissions by autonomy level; L3+ **implementer adapters** (manual | native-gh | Cursor | OpenCode) behind the same runtime. OpenCode is never “the model” and not required for L0–L2.  
**Consequences**: + Simpler mental model; − Implementer plugins must not leak write tools into L2.  
**Alternatives considered**: Dual ModelRouter+ExecutionRunner (rejected Module 1); OpenCode-as-core day 1 (rejected 1b); mega-agent with Panelin (rejected Module 0).
