# Propuesta de evolución — Control Plane, Policy Engine y capacidades reales (logs v1–v34)

**Origen:** Evaluación de los logs v1–v34 y propuesta implementable para equipo multi‑agente. Integrado en full team run 9 (2026-03-18).

**Resumen:** Los “upgrades” descritos en lenguaje metafórico (“entanglement”, “superposition”, “quantum”) se traducen a **capacidades implementables** con estándares vigentes (NIST, OWASP, PQC, MCP) y a un **Control Plane** con Policy Engine y gates (sin auto‑aprobación ciega).

---

## Principios adoptables por el equipo

1. **No auto‑aprobación:** Cada cambio/upgrade exige evidencia, tests y plan de rollback. Evitar “Project‑state updated” sin gates.
2. **Policy Engine:** Privacidad, seguridad, cumplimiento y límites de costo como controles centrales; alineación a OWASP LLM 2025, OWASP Agentic 2026, NIST SSDF 800‑218/218A, NIST AI RMF y AI 600‑1.
3. **Traducción de metáforas a backlog real:** “Quantum no‑cloning” → control de copias y DLP; “Entanglement DP” → Differential Privacy en analítica; “Kyber + Dilithium” → PQC (ML‑KEM FIPS 203, ML‑DSA FIPS 204); “Infinite clones” → autoscaling con límites de costo; “Evolution oracle” → mejora continua con evaluación y A/B con gates.
4. **Arquitectura objetivo:** Control Plane (policy, governance, crypto, supply chain) + Runtime Plane (orchestrator, tool gateway tipo MCP, memoria segmentada, observabilidad). Memoria compartida con segmentación y need‑to‑know, no “shared consciousness” sin control.

---

## Roadmap por fases (referencia)

| Fase | Plazo | Contenido |
|------|--------|-----------|
| **P0** | 1–2 sem | Control Plane mínimo: policy engine, trazabilidad, límites de costo, permisos por herramienta; eliminar auto‑aprobación; checklist OWASP LLM 2025 y Agentic 2026. |
| **P1** | 2–6 sem | Secure SDLC GenAI: SSDF (SP 800‑218) + perfil GenAI (SP 800‑218A); threat modeling MITRE ATLAS; harness de evaluación (regresiones + adversarial). |
| **P2** | 1–3 mes | Roadmap PQC: inventario cripto, pilotos ML‑DSA/ML‑KEM, plan híbrido en transporte. |
| **P3** | Lab | DP formal para telemetría; selective disclosure (SD‑JWT); PoC QAOA solo si hay ROI medible. |

---

## Riesgos (semáforo) — para Fiscal y Security

| Riesgo | Nivel | Mitigación |
|--------|--------|-------------|
| Auto‑aprobación sin gates | Rojo | Change control: evidencia + pruebas + rollback; checklist OWASP Agentic 2026. |
| Prompt injection / tool abuse / system prompt leakage | Rojo | OWASP LLM 2025; aislamiento de herramientas; allowlists; revisión de outputs. |
| Memoria compartida sin segmentación | Amarillo | Memoria segmentada; RBAC; retención; auditoría. |
| Migración PQC mal planteada | Amarillo | Inventario cripto + roadmap por fases; híbridos donde aplique. |
| Conectores (MCP) sin hardening | Amarillo | Security Best Practices MCP; approvals; tool integrity. |

---

## Especialistas propuestos (para ampliar el equipo)

- SEC_PRIV: Security + Privacy (OWASP, PQC, sandboxing, logging).
- GOV_ETH: AI Governance (NIST AI RMF, AI 600‑1, ISO 42001, EU AI Act si aplica).
- SRE_SCALE: Escalabilidad y límites de costo; DR/failover.
- ROBUST_EVAL: Red team, adversarial, ATLAS, gates de aprobación.
- DATA_PRIV: PII, DP, retención, minimización.
- TOOLING_MCP: Conectores (MCP), hardening, permisos por herramienta.
- CRYPTO_PQC: Inventario cripto, plan ML‑KEM/ML‑DSA, rotación.

---

## Próximos pasos (equipo BMC)

- [ ] **Orquestador / Fiscal:** Integrar en criterios de evaluación que no haya auto‑aprobación silenciosa; exigir evidencia y rollback en cambios de estado.
- [ ] **Security:** Usar OWASP LLM 2025 y OWASP Agentic 2026 como checklist mínimo antes de producción y para agentes con herramientas.
- [ ] **Reporter:** Incluir en REPORT-SOLUTION-CODING o IMPLEMENTATION-PLAN un backlog “Control Plane / Policy Engine” con ítems P0–P3 cuando se priorice evolución.
- [ ] **Judge:** Considerar en JUDGE-CRITERIA que los entregables que modifican estado o herramientas deben incluir evidencia y plan de rollback (no solo “Project‑state updated”).

---

**Referencias:** NIST FIPS 203/204/205 (PQC), NIST AI RMF 1.0, NIST AI 600‑1, NIST SP 800‑218/218A, OWASP Top 10 LLM 2025, OWASP Agentic 2026, MITRE ATLAS, MCP Security Best Practices, ISO/IEC 42001:2023. Prompt JSON completo de “Team Evolution Implementation” en el input del run 9 (user message).
