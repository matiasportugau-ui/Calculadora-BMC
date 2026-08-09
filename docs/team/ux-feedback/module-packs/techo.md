# Module pack — `techo`

> OMFT seed pack. Edit success criteria before each live run.

---

## 1. Identity

| Field | Value |
|-------|--------|
| **Slug** | `techo` |
| **Title** | Techo irregular / dual plant / factory list |
| **Owner / product area** | Calculadora — techo |
| **Default base URL** | `https://calculadora-bmc.vercel.app` |
| **Primary routes** | calculator techo steps (confirm path labels in PREP) |
| **Auth required** | optional / as deployed |
| **Last pack update** | 2026-08-09 |

## 2. What this module is for

Configure irregular roof sessions, dual-plant patches, factory order lists, and related limpia/reset behaviors so quotes match factory reality.

## 3. Primary screens / surfaces

| Surface | Route or entry | Notes |
|---------|----------------|-------|
| Techo steps in calculator | main app | irregular session |
| Dual plant | techo UI | plant A/B |
| Factory order list | techo UI | order for plant |
| Limpiar | reset controls | must clear irregularSession when expected |

## 4. Happy-path skeleton (optional)

1. Open calculator → techo flow  
2. Configure irregular geometry / session  
3. Dual plant if applicable  
4. Review factory list  
5. Limpiar / edge cases  
6. Quote output sanity  

## 5. Success criteria (operator POV — edit before run)

- [ ] Irregular session survives expected patches and dies on Limpiar when it should  
- [ ] Dual plant + factory list match operator expectation  
- [ ] No silent wrong cut lengths  
- [ ] _Your criteria_  

## 6. Real data / fixtures needed

| Need | Example | Secret? |
|------|---------|---------|
| Sample project dimensions | real or anonymized | no |
| Plant preference | A/B | no |

## 7. Out of scope

- Full logística trip (see `logistica`)  
- Hub cotizaciones CRM  

## 8. Known recent context

| Item | Value |
|------|--------|
| Irregular session fixes | see recent main PRs / Bug BK family |
| Draft bugfix PRs | may exist on cursor/* branches — note at PREP |

## 9. Related docs

- Techo / irregular docs under `docs/team/` as available  
- PROJECT-STATE for open techo bugs  

## 10. Capture protocol

OMFT fixed: ACTION / EXPECT / OBSERVED / Verdict / Fig / Severity.

## 11. Code touch hints

- Techo / irregular session modules under `src/`  
- Dual-plant and factory list components  
- Tests named `*irregular*` if present  
