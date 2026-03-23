# panelsim-email-inbox — referencia rápida

## Variables

| Variable | Significado |
|----------|-------------|
| `BMC_EMAIL_INBOX_REPO` | Ruta absoluta al repo `conexion-cuentas-email-agentes-bmc` (opcional) |

## Comando

```bash
cd "$BMC_EMAIL_INBOX_REPO"   # o ruta resuelta
npm run panelsim-update
```

## Lectura obligatoria post-sync

- `data/reports/PANELSIM-ULTIMO-REPORTE.md`
- `data/reports/PANELSIM-STATUS.json` (opcional, conteos)

## Setup mínimo en repo de correo

- `config/accounts.json` (desde `accounts.example.json`)
- `.env` (contraseñas referenciadas por `passwordEnv`)
- `config/classification.json` (desde `classification.example.json`)
- `npm install`

## Otros comandos (repo de correo)

| Script | Uso |
|--------|-----|
| `npm run fetch` | Solo descarga + snapshot |
| `npm run report` | Solo MD desde snapshot actual |
| `npm run draft` | Borrador interactivo con aprobación |
