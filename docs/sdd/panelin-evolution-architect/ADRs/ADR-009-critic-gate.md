# ADR-009: Critic gate before ready_for_review

**Status**: Accepted  
**Context**: Reflexion / Kitchen Loop; risk of architecture essays without Spec/tests.  
**Decision**: Mandatory Critic after plan; pass → `ready_for_review`; fail → one revise or DECOMPOSE.  
**Consequences**: + Packet quality; − Extra model call inside preflight budget.  
**Alternatives considered**: Human-only review; no critic.
