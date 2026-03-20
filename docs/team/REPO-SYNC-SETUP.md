# Repo Sync — Setup Instructions

**Propósito:** Configurar los repositorios externos para que el agente `bmc-repo-sync-agent` pueda sincronizar artefactos tras cada full team run.

**Estado actual:** Ambos configurados en `.env`:
- `BMC_DASHBOARD_2_REPO`: https://github.com/matiasportugau-ui/bmc-dashboard-2.0.git
- `BMC_DEVELOPMENT_TEAM_REPO`: https://github.com/matiasportugau-ui/bmc-development-team.git

---

## 1. Repos a mantener

| Repo | Contenido | Qué se actualiza |
|------|-----------|------------------|
| **bmc-dashboard-2.0** | Desarrollo y funcionamiento del dashboard | Código dashboard (app.js, styles, index.html), rutas API (bmcDashboard.js), docs de dashboard, DASHBOARD-INTERFACE-MAP, planilla-inventory, config de Sheets, scripts de deploy |
| **bmc-development-team** | Equipo y artefactos | PROJECT-STATE, PROJECT-TEAM-FULL-COVERAGE, JUDGE-CRITERIA-POR-AGENTE, JUDGE-REPORT-HISTORICO, reportes Solution/Coding, handoffs, skills/agents actualizados |

---

## 2. Configuración

### Opción A: Paths locales (recomendado para desarrollo)

Si los repos están clonados localmente, añadir a `.env`:

```bash
# Repo Sync (bmc-repo-sync-agent)
BMC_DASHBOARD_2_REPO=/path/to/bmc-dashboard-2.0
BMC_DEVELOPMENT_TEAM_REPO=/path/to/bmc-development-team
```

### Opción B: URLs remotas (Git)

Si prefieres URLs para `git clone` o `git push`:

```bash
BMC_DASHBOARD_2_REPO=https://github.com/USER/bmc-dashboard-2.0.git
BMC_DEVELOPMENT_TEAM_REPO=https://github.com/USER/bmc-development-team.git
```

### Opción C: Documentar en PROJECT-STATE

Añadir en `docs/team/PROJECT-STATE.md` sección "Estado por área":

```markdown
### Repos (Repo Sync)
- bmc-dashboard-2.0: /path/to/bmc-dashboard-2.0
- bmc-development-team: /path/to/bmc-development-team
```

---

## 3. Crear los repos (si no existen)

1. **bmc-dashboard-2.0:** Crear repo en GitHub/GitLab (o local).
   - Inicializar con: `docs/bmc-dashboard-modernization/dashboard/`, `server/routes/bmcDashboard.js`, `docs/google-sheets-module/`, `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md`, `docs/google-sheets-module/planilla-inventory.md`.

2. **bmc-development-team:** Crear repo para equipo.
   - Inicializar con: `docs/team/`, `.cursor/agents/`, `.cursor/skills/` (o subconjunto), reportes Judge, IMPLEMENTATION-PLAN, REPORT-SOLUTION-CODING.

---

## 4. Verificación

Tras configurar, ejecutar:

```bash
# Full team run incluye paso 7 (Repo Sync)
# O manualmente: el agente bmc-repo-sync-agent evaluará y sincronizará
```

El agente leerá `BMC_DASHBOARD_2_REPO` y `BMC_DEVELOPMENT_TEAM_REPO` de `.env` o PROJECT-STATE.

---

## 5. Referencias

- Skill: `.cursor/skills/bmc-repo-sync-agent/SKILL.md`
- PROJECT-TEAM-FULL-COVERAGE §2: Repo Sync es miembro del equipo
- .env.example: líneas 33–36 (BMC_DASHBOARD_2_REPO, BMC_DEVELOPMENT_TEAM_REPO)
