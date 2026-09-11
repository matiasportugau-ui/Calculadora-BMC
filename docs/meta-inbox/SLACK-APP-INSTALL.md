# Slack app install — Meta inbox operator ping

Crear una app Slack **From scratch** llamada **BMC Panelin**.

Scopes mínimos:

- `chat:write`
- `chat:write.public`
- `incoming-webhook`
- `app_mentions:read`
- `im:write`

Configurar los valores en **Doppler** (`bmc-backend` / `prd`) y probar el ping con:

```bash
doppler run --project bmc-backend --config prd -- node scripts/slack-ping.mjs
```

Cloud Run es el host **24/7**; **bmc02 no lo es**. No agregar Slack al `--set-secrets` de Cloud Run hasta que exista el secret en GSM. El wiring actual usa env vars / secrets ya declarados en el workflow sin tocar esa línea full-replace.

La **Events API** queda para más adelante. **No** se shippea `/webhooks/slack` en este run.
