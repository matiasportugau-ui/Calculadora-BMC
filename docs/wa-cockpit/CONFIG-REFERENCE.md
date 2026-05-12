# WA Module Config Reference

*Documentación auto-generada desde `server/lib/waConfigSchema.js`.*

## Feature Flags

| Key | Default | Descripción |
|-----|---------|-------------|
| `enricher.enabled` | `false` | Worker que clasifica intent y genera sugerencias AI sobre mensajes inbound. |
| `autoQuote.enabled` | `false` | Auto-cotizar cuando el enricher detecta cotización con m² + (espesor o familia). |
| `webhooks.enabled` | `false` | Disparar webhooks salientes (HMAC firmados) en eventos del módulo. |
| `slaTracking.enabled` | `false` | Worker que detecta breaches de SLA (unreplied/unassigned) respetando business hours. |
| `routingRules.enabled` | `false` | Aplicar reglas de wa_rules sobre /ingest (assign automático, label, alert). |
| `cloudApiOutbound.enabled` | `false` | Permitir envíos vía WhatsApp Cloud API (requiere consent_at en wa_conversations). |
| `extensionLiveSync.enabled` | `true` | Permitir live sync de la extensión (live: true en /ingest). |
| `auditLogVisible.enabled` | `true` | Mostrar la pestaña Audit Log en la UI a Owner/Admin. |

## Runtime Settings

| Key | Type | Default | Descripción |
|-----|------|---------|-------------|
| `enricher.intervalMs` | `number` | `8000` |  |
| `enricher.batchSize` | `number` | `5` |  |
| `enricher.maxHistoryMsgs` | `number` | `12` |  |
| `ai.classify.provider` | `enum` | `"anthropic"` |  |
| `ai.classify.model` | `string` | `"claude-sonnet-4-5"` |  |
| `ai.classify.temperature` | `number` | `0.2` |  |
| `ai.classify.maxTokens` | `number` | `200` |  |
| `ai.suggestions.provider` | `enum` | `"anthropic"` |  |
| `ai.suggestions.model` | `string` | `"claude-sonnet-4-5"` |  |
| `ai.suggestions.temperature` | `number` | `0.5` |  |
| `ai.suggestions.maxTokens` | `number` | `1200` |  |
| `ai.quoteParse.provider` | `enum` | `"anthropic"` |  |
| `ai.quoteParse.model` | `string` | `"claude-sonnet-4-5"` |  |
| `ai.quoteParse.temperature` | `number` | `0.1` |  |
| `ai.quoteParse.maxTokens` | `number` | `300` |  |
| `ai.followupText.provider` | `enum` | `"anthropic"` |  |
| `ai.followupText.model` | `string` | `"claude-sonnet-4-5"` |  |
| `ai.followupText.temperature` | `number` | `0.7` |  |
| `ai.followupText.maxTokens` | `number` | `200` |  |
| `quote.minM2` | `number` | `5` |  |
| `quote.defaultWallHeightM` | `number` | `3` |  |
| `quote.requireFamilyOrThickness` | `boolean` | `true` |  |
| `sla.unrepliedAlertHours` | `number` | `2` |  |
| `sla.unassignedAlertHours` | `number` | `0.5` |  |
| `sla.businessHours.tz` | `string` | `"America/Montevideo"` |  |
| `sla.businessHours.mon` | `tuple` | `[9,18]` |  |
| `sla.businessHours.tue` | `tuple` | `[9,18]` |  |
| `sla.businessHours.wed` | `tuple` | `[9,18]` |  |
| `sla.businessHours.thu` | `tuple` | `[9,18]` |  |
| `sla.businessHours.fri` | `tuple` | `[9,18]` |  |
| `sla.businessHours.sat` | `tuple` | `null` |  |
| `sla.businessHours.sun` | `tuple` | `null` |  |
| `sla.breachAction` | `enum` | `"notify"` |  |
| `sla.workerIntervalMs` | `number` | `60000` |  |
| `outbound.ratePerMinPerChat` | `number` | `6` |  |
| `outbound.ratePerMinPerOperator` | `number` | `30` |  |
| `outbound.dailyCapPerChat` | `number` | `50` |  |
| `data.ttlDays` | `number` | `180` |  |
| `data.purgeEnabled` | `boolean` | `true` |  |
| `consent.requiredForCloudApi` | `boolean` | `true` |  |
| `consent.defaultSource` | `string` | `"manual"` |  |
| `extension.heartbeatSeconds` | `number` | `60` |  |
| `extension.batchSizeLive` | `number` | `50` |  |
| `extension.batchSizeHistorical` | `number` | `200` |  |
| `extension.retryDelaysMs` | `array` | `[500,1500,4000]` |  |
| `extension.liveTickleDebounceMs` | `number` | `2500` |  |
| `followups.defaultHours` | `number` | `24` |  |
| `followups.workerIntervalMs` | `number` | `60000` |  |
| `followups.rules` | `array` | `[{"kind":"remind_24h","hours":24,"template":"Hola, ¿pudiste revisar la cotización?","enabled":true}]` |  |
| `prompts.classifyOverride` | `string` | `""` |  |
| `prompts.suggestionsOverride` | `string` | `""` |  |
| `prompts.cockpitInstruction` | `string` | `""` |  |
| `prompts.followupTemplate` | `string` | `""` |  |

## Precedencia

1. **Operator Override**: `wa_settings` con `scope='operator'`.
2. **Tenant Setting**: `wa_settings` con `scope='tenant'`.
3. **Environment Variable**: Fallback para bootstrap inicial.
4. **Schema Default**: Valor definido en el código.
