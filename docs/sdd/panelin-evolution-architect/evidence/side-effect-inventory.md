# Side-effect inventory (PEA M3 seed)

Generated as part of IMP-PEA-04. Extend as tools are registered.

| tool_id | domain | risk | approval | envs |
|---------|--------|------|----------|------|
| get_calc_state | calc | R0 | none | all |
| calcular_cotizacion | calc | R0 | none | all |
| guardar_en_crm | crm | R2 | user_confirmed | all |
| enviar_whatsapp_link | wa | R3 | user_confirmed | staging, production |
| pea_explain_gap | pea | R0 | none | all |

Unregistered tools: denied when `PEA_SIDE_EFFECT_ENFORCE=1`.

SoT registry: `server/lib/pea/sideEffectRegistry.js`
