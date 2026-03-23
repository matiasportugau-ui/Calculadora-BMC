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

## Skill

[`.cursor/skills/panelsim-email-inbox/SKILL.md`](../../../.cursor/skills/panelsim-email-inbox/SKILL.md)
