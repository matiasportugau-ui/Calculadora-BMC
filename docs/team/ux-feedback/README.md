# UX feedback — informes de navegación (usuario → implementación)

Flujo para convertir **transcripción de audio**, **capturas** y **URL de la app desplegada** en un informe Markdown único que un agente de implementación pueda ejecutar paso a paso.

## Contenido de esta carpeta

| Archivo | Uso |
|---------|-----|
| [TEMPLATE-USER-NAV-REPORT.md](./TEMPLATE-USER-NAV-REPORT.md) | Plantilla con secciones fijas; el agente la copia y rellena. |
| `USER-NAV-REPORT-YYYY-MM-DD.md` | Informes generados por sesión (crear al vuelo). |

## Cómo usarlo (resumen)

1. Navegá la app (p. ej. preview o prod en Vercel), grabá comentarios y capturas.
2. Transcribí el audio a texto.
3. En Cursor: adjuntá transcripción + imágenes + URL base; invocá la skill **`navigation-user-feedback`** (o la regla de proyecto si está activa).
4. Revisá prioridades P0/P1/P2; pasá el `USER-NAV-REPORT-*.md` al agente que implementa.

## Skill y regla Cursor

- Skill: `.cursor/skills/navigation-user-feedback/SKILL.md`
- Regla opcional: `.cursor/rules/navigation-user-feedback.mdc`

## Enlaces al resto del equipo

- Propagación multi-área: [PROJECT-TEAM-FULL-COVERAGE.md](../PROJECT-TEAM-FULL-COVERAGE.md)
- Estado del repo: [PROJECT-STATE.md](../PROJECT-STATE.md)
- Sesión / cockpit: [SESSION-WORKSPACE-CRM.md](../SESSION-WORKSPACE-CRM.md)
- Gates humanos: [HUMAN-GATES-ONE-BY-ONE.md](../HUMAN-GATES-ONE-BY-ONE.md)
