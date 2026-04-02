# PACKAGE_MONOFILE — Modo Transportista (índice)

Este repo implementa el **Modo Transportista** integrado en el servidor Express principal, no como carpeta aislada sin cablear.

## Dónde está cada cosa

| Artefacto del paquete original | Ubicación en Calculadora-BMC |
|-------------------------------|------------------------------|
| Migraciones SQL | [`transportista-cursor-package/migrations/`](transportista-cursor-package/migrations/) — ejecutar con `npm run transportista:migrate` |
| Reglas Cursor | [`transportista-cursor-package/.cursor/rules/`](transportista-cursor-package/.cursor/rules/) |
| Prompts por agente | [`transportista-cursor-package/prompts/`](transportista-cursor-package/prompts/) |
| API runtime | [`server/routes/transportista.js`](server/routes/transportista.js), [`server/lib/transportista*.js`](server/lib/) |
| PWA conductor | [`src/components/DriverTransportistaApp.jsx`](src/components/DriverTransportistaApp.jsx), ruta `/conductor` |
| Blueprint / fuentes | [`transportista-cursor-package/AGENTS.md`](transportista-cursor-package/AGENTS.md), [`transportista-cursor-package/src/README.md`](transportista-cursor-package/src/README.md) |

## Variables de entorno

- `DATABASE_URL` — Postgres (requerido para viajes/eventos; p. ej. Supabase)
- `API_AUTH_TOKEN` — backoffice (confirmar/asignar/timeline)
- `WHATSAPP_APP_SECRET` — verificación HMAC de `POST /webhooks/whatsapp` (recomendado en prod)
- `TRANSPORTISTA_GCS_BUCKET` — evidencia con URL firmada (opcional; si falta, usar `upload-b64` en dev)
- `PUBLIC_BASE_URL` — base para links del conductor en WhatsApp

## Comandos

```bash
npm run transportista:migrate   # aplicar migraciones (requiere DATABASE_URL)
npm run start:api               # API en :3001
```

Materialización completa del monobloque original: ver prompts en `transportista-cursor-package/prompts/`.
