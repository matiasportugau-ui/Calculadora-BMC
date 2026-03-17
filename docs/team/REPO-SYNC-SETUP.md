# Repo Sync — Configuración de nuevos repos

**Fecha:** 2026-03-17  
**Propósito:** Instrucciones para configurar y usar los repos bmc-dashboard-2.0 y bmc-development-team.

---

## Repos bajo mantenimiento

| Repo | Contenido | Qué se actualiza |
|------|-----------|------------------|
| **bmc-dashboard-2.0** | Desarrollo y funcionamiento del dashboard | Código dashboard (app.js, styles, index.html), rutas API (bmcDashboard.js), docs de dashboard, DASHBOARD-INTERFACE-MAP, planilla-inventory, config de Sheets, scripts de deploy |
| **bmc-development-team** | Equipo y artefactos | PROJECT-STATE, PROJECT-TEAM-FULL-COVERAGE, JUDGE-CRITERIA-POR-AGENTE, JUDGE-REPORT-HISTORICO, reportes Solution/Coding, handoffs, skills/agents actualizados |

---

## Configuración

### 1. Crear los repos en GitHub (o tu proveedor)

Crea dos repositorios nuevos:

- `bmc-dashboard-2.0` — para el código del dashboard
- `bmc-development-team` — para artefactos del equipo

### 2. Clonar localmente (o usar paths existentes)

```bash
# Ejemplo: clonar en un directorio hermano
cd ~
git clone https://github.com/TU_ORG/bmc-dashboard-2.0.git
git clone https://github.com/TU_ORG/bmc-development-team.git
```

### 3. Añadir a .env

En el proyecto Calculadora-BMC, edita `.env`:

```env
# Repo Sync (bmc-repo-sync-agent)
BMC_DASHBOARD_2_REPO=/ruta/absoluta/a/bmc-dashboard-2.0
BMC_DEVELOPMENT_TEAM_REPO=/ruta/absoluta/a/bmc-development-team
```

O con URLs remotas (el agente puede clonar si no existen):

```env
BMC_DASHBOARD_2_REPO=https://github.com/TU_ORG/bmc-dashboard-2.0.git
BMC_DEVELOPMENT_TEAM_REPO=https://github.com/TU_ORG/bmc-development-team.git
```

### 4. Actualizar PROJECT-STATE

En `docs/team/PROJECT-STATE.md`, sección **Estado por área**, añade:

```markdown
### Repos (Repo Sync)
- bmc-dashboard-2.0: /path/to/bmc-dashboard-2.0
- bmc-development-team: /path/to/bmc-development-team
```

---

## Uso tras configurar

Tras cada "Full team run" o "Invoque full team", el paso 7 (Repo Sync) sincronizará automáticamente:

1. **bmc-dashboard-2.0:** Copia dashboard, server/routes/bmcDashboard.js, docs relevantes
2. **bmc-development-team:** Copia docs/team/, .cursor/agents/, .cursor/skills/, reportes

Commit y push en cada repo tras la sincronización.

---

## Comando manual

Para sincronizar manualmente (sin full run):

```
"Sync repos" / "Actualizar bmc-dashboard-2.0" / "Mantener repos al día"
```

El skill `bmc-repo-sync-agent` ejecutará el protocolo.
