# Module pack — `envios`

> OMFT seed pack. Edit success criteria before each live run.

---

## 1. Identity

| Field | Value |
|-------|--------|
| **Slug** | `envios` |
| **Title** | Envíos / reparto / workspace de envíos |
| **Owner / product area** | Operaciones — coordinación de entregas |
| **Default base URL** | `https://calculadora-bmc.vercel.app` |
| **Primary routes** | workspace envíos, wizard, reparto surfaces (confirm in PREP via app nav) |
| **Auth required** | yes |
| **Last pack update** | 2026-08-09 |

## 2. What this module is for

Organize outbound shipments: match quotes, attachments, destinations, and handoff states so ops can run real deliveries (wizard, lists, status transitions).

## 3. Primary screens / surfaces

| Surface | Route or entry | Notes |
|---------|----------------|-------|
| Workspace envíos | app nav / hub | lists, filters |
| Envío wizard | create/edit flow | multi-step |
| Adjunto fetch | API + UI | SSRF allowlist; proxy-first |
| Reparto / coordinación | related UI | see SDD-REPARTO |

## 4. Happy-path skeleton (optional)

1. Sign in → open envíos workspace  
2. Create or open a real envío  
3. Attach / match quote or PDF  
4. Fill destinations / items as ops actually do  
5. Persist / status change  
6. Verify list reflects state  

## 5. Success criteria (operator POV — edit before run)

- [ ] Can complete one real envío without silent failures  
- [ ] Errors are actionable (network, auth, adjunto)  
- [ ] Status / list updates match operator expectation  
- [ ] _Your criteria for this run_  

## 6. Real data / fixtures needed

| Need | Example | Secret? |
|------|---------|---------|
| Operator login | prod | yes |
| Real client/order | name only in report | redact |
| Address / contact | as used in ops | careful with PII in git |

## 7. Out of scope

- Pure 3D packing polish (see `logistica`) unless same run  
- WhatsApp send paths (see `wa-cockpit`) unless included  

## 8. Known recent context

| Item | Value |
|------|--------|
| Related SDD | `docs/sdd/bmc-envios/` |
| Security | adjunto SSRF allowlist, CSP connect-src |

## 9. Related docs

- `docs/sdd/bmc-envios/SDD.md`  
- `docs/sdd/bmc-envios/SDD-ENVIO-WIZARD.md`  
- `docs/sdd/bmc-envios/SDD-REPARTO-COORDINACION.md`  

## 10. Capture protocol

OMFT fixed: ACTION / EXPECT / OBSERVED / Verdict / Fig / Severity.

## 11. Code touch hints

- Envíos components under `src/`  
- API routes under `server/` or Vercel API for envios/adjunto  
- Sheets sync if applicable (document in propagation)  
