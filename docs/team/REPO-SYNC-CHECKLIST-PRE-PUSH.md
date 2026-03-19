# Repo Sync — Checklist pre-push

**Propósito:** Verificar antes de pushear a bmc-dashboard-2.0 o bmc-development-team.

---

## Antes de push

- [ ] No hay secrets en los archivos (grep .env, API_KEY, etc.)
- [ ] Lint pasa (si aplica)
- [ ] Cambios documentados en PROJECT-STATE si afectan al equipo
- [ ] Commit message descriptivo

---

## Por repo

### bmc-dashboard-2.0
- [ ] Código dashboard y API coherente
- [ ] planilla-inventory y DASHBOARD-INTERFACE-MAP actualizados si hubo cambios en Sheets

### bmc-development-team
- [ ] PROJECT-STATE actualizado
- [ ] Skills/agents alineados con cambios

---

## Referencias

- REPO-SYNC-SETUP.md
- bmc-repo-sync-agent skill
