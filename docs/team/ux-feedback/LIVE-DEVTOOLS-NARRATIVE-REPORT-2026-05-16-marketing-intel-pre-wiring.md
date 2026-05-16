# LIVE-DEVTOOLS-NARRATIVE-REPORT — Marketing Intel V1 · pre-wiring baseline

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`
Mode: **modo asistido sin MCP** — usuario narra desde su browser local, agente documenta.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-05-16 |
| Base URL | https://calculadora-bmc.vercel.app/hub |
| Entorno | prod |
| Navegador / MCP | Chrome local del usuario · MCP chrome-devtools NO disponible en sandbox |
| Participantes | Matías Portugau (narrador) · Claude (documenta) |
| PR relacionada | [#241](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/241) (draft, WIP) |

## 2. Objetivo de la sesión

- **Goal:** Anclar visualmente dónde va a vivir el módulo `/hub/marketing` antes de wire-up, validar que `/hub` existente está limpio en prod, y capturar contexto UI para el componente `BmcMarketingModule.jsx` que viene en step B3.
- **Criterios de éxito:**
  - Inventario claro de los items existentes en `/hub`
  - Identificar gaps visuales/UX del HUB que el módulo nuevo debería respetar
  - Detectar errores de consola o red que se arrastrarían a la nueva ruta

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

_A completar mientras vos navegás. Pegame texto, screenshots o describí._

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | _pendiente_ | | |
| U-02 | _pendiente_ | | |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | _pendiente_ | usuario pega de DevTools | |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | | | |

## 6. Hallazgos priorizados

_A completar al final de la sesión._

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|---------------|

## 7. Recomendaciones y siguientes pasos

_Pendiente._

## 8. Verificación (checklist)

- [ ] HUB renderiza sin errores en prod
- [ ] Rutas existentes (`/hub/ml`, `/hub/wa`, `/hub/canales`, `/hub/admin`, `/hub/cotizaciones`) accesibles
- [ ] No hay 4xx/5xx en flujo principal
- [ ] Identificado patrón visual a respetar en `BmcMarketingModule.jsx`

## 9. Anexos

- Bundle del módulo: `/tmp/marketing-intel-review/bmc-marketing-intel-v1/`
- Componente pendiente de wire-up: `src/components/BmcMarketingModule.jsx`
