# PANELSIM + correo — workspace multi-root (Fase A)

## Opción 1: archivo de workspace (recomendado)

1. En Cursor: **File → Open Workspace from File…**
2. Elegí [`panelsim-email.code-workspace`](../../../panelsim-email.code-workspace) en la raíz de Calculadora-BMC.

Incluye **Calculadora-BMC** y el repo hermano **conexion-cuentas-email-agentes-bmc** (ruta relativa `../conexion-cuentas-email-agentes-bmc`).

## Opción 2: Add Folder to Workspace

**File → Add Folder to Workspace…** y agregá la carpeta del repo de correo con nombre exacto `conexion-cuentas-email-agentes-bmc`.

## Opción 3: variable de entorno

En `.env` local de Calculadora-BMC (no commitear):

```env
BMC_EMAIL_INBOX_REPO=/ruta/absoluta/a/conexion-cuentas-email-agentes-bmc
```

Ver [`.env.example`](../../../.env.example). Para shells fuera de Cursor: `export BMC_EMAIL_INBOX_REPO=...` en `~/.zshrc`.

## Un comando desde Calculadora-BMC (recomendado)

Con el repo BMC como cwd (no hace falta `cd` al repo de correo):

```bash
npm run panelsim:email-ready
```

Resuelve la ruta con [`scripts/resolve-email-inbox-repo.sh`](../../../scripts/resolve-email-inbox-repo.sh) (`BMC_EMAIL_INBOX_REPO` → línea en `.env` → carpeta hermana), instala dependencias del repo de correo si falta `node_modules`, y ejecuta **`panelsim-update`** (IMAP + `PANELSIM-ULTIMO-REPORTE.md` + `PANELSIM-STATUS.json`).

Ventana de días distinta al default del `accounts.json` del repo de correo:

```bash
npm run panelsim:email-ready -- --days 7
```

En Cursor: **Terminal → Run Task…** → tareas **PANELSIM: sincronizar correo** o **PANELSIM: correo últimos 7 días** ([`.vscode/tasks.json`](../../../.vscode/tasks.json)).

## Scripts npm: desde qué carpeta

Los scripts de **Calculadora-BMC** solo existen en ese repo. Si estás en tu home (`~`) u otro directorio, `npm run …` no los encuentra (`Missing script`).

| Objetivo | Dónde ejecutar | Comando |
|----------|-----------------|---------|
| **Sync IMAP + reporte** sin cambiar de carpeta | Raíz **Calculadora-BMC** | `npm run panelsim:email-ready` (o con `-- --days N`) |
| Abrir el `.env` del repo de correo | Raíz **Calculadora-BMC** | `npm run open:email-env` |
| Sync directo en el repo de correo (equivalente) | Raíz **conexion-cuentas-email-agentes-bmc** | `npm run panelsim-update` |

**Regla rápida:** desde BMC usá `panelsim:email-ready`; `open:email-env` sigue siendo solo con `cd` a Calculadora-BMC.

## Qué “enciende” y qué no

| Comando | Qué deja listo |
|---------|----------------|
| `npm run panelsim:email-ready` | Bandeja IMAP + `PANELSIM-ULTIMO-REPORTE.md` + snapshot (capacidad **correo**) |
| `npm run panelsim:env` | Chequeo de credenciales Google / planillas / MATRIZ (capacidad **Sheets** vía API local) |
| `npm run dev:full` o `start:api` | API :3001 + calculadora (capacidad **HTTP** para dashboard/ML) |

No hay un solo comando que levante *todo* PANELSIM a la vez: son capas distintas. Para sesión “completa”, en la práctica: `panelsim:email-ready` + API si hace falta consultar `/api/*` o ML.

## Skill

[`.cursor/skills/panelsim-email-inbox/SKILL.md`](../../../.cursor/skills/panelsim-email-inbox/SKILL.md)
