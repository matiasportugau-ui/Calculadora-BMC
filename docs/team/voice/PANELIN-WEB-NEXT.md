# Panelin Web — next

SoT for `/panelin-web`. Keep this short. Update after each useful hop.

**Última:** 2026-10-08 (Admin VW working-set + columnas C–L; no append 3713+)  
**Local:** http://127.0.0.1:3001/storefront-voice/  
**Shop:** widget on bmcuruguay.com.uy. Orb opens. `POST /chat` 200 `grok` / `grok-3-mini`. Silence mic **10 s**. Chat idle **25 s** → one «¿Seguís ahí?».  
**Score:** runtime **68/100** (2026-09-07) — logs: `docs/team/reports/STATUS-EVAL-panelin-front-LOGS-2026-09-07.md`

## Estado

Prod chat was 400 `Incorrect API key` on xAI and did not fall through to Gemini. Doppler `XAI_API_KEY` was valid; `GROK_API_KEY` matched the dead GSM copy. GSM `GROK_API_KEY` version 5 and Doppler `GROK_API_KEY` now match that working key. Cloud Run `panelin-calc-01120-c7n` serves 100%. Identify gate unchanged (name + phone before chat). This branch still has unshipped idle/closeout work.

## Próximo prompt

```
Tras merge: deploy-calc-api. Dump VW 3713+ ya migrado HITL al working set.
```

## No hacer ahora

- Theme APPLY.
- Mover el gate nombre+teléfono sin HITL.
- Mezclar Driver / logística / keywords.
