# LIVE-DEVTOOLS-NARRATIVE-REPORT — plantilla

Copiar a `LIVE-DEVTOOLS-NARRATIVE-REPORT-YYYY-MM-DD-<slug>.md` y rellenar. Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`. Invocación: **Live DevTools narrative** / **Narrativa en vivo DevTools**.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | |
| Base URL | (default `https://calculadora-bmc.vercel.app`) |
| Entorno | prod \| preview \| local |
| Navegador / MCP | chrome-devtools MCP + versión si consta |
| Participantes | |

## 2. Objetivo de la sesión

- **Goal (una frase):**
- **Criterios de éxito del usuario:**

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

_Orden cronológico. Texto tal cual o normalizado mínimo (sin inventar pasos)._

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | | | |
| U-02 | | | |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

_Resumen de lo obtenido por tools; pegar fragmentos cortos o referencia “ver tool output en chat”._

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | | p. ej. list_console_messages | |
| E-02 | | p. ej. list_network_requests | |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, … | sí \| no \| parcial | |
| U-02 | | | |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-YYYY-MM-DD-01 | P0 \| P1 \| P2 | | | |

## 7. Recomendaciones y siguientes pasos

1. 
2. 

## 8. Verificación (checklist)

- [ ] Reproducible en URL indicada
- [ ] Consola limpia de errores P0 / o documentado
- [ ] Red: sin 4xx/5xx inesperados en flujo principal
- [ ] Criterios de éxito del usuario (§2) cubiertos o ticket abierto

## 9. Anexos (opcional)

- Screenshots paths o enlaces
- JSON hermano `LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-*.json` si existe
