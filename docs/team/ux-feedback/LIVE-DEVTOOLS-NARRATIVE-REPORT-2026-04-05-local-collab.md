# LIVE-DEVTOOLS-NARRATIVE-REPORT — colaboración local (Calculadora BMC)

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`. **Base URL sesión:** `http://localhost:5173/`.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-05 |
| Base URL | `http://localhost:5173/` |
| Entorno | local (Vite + API `:3001`) |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` |
| Participantes | Matías (uso manual) + agente (MCP + correcciones) |

## 2. Objetivo de la sesión

- **Goal:** Evaluar en vivo sobre **local** mientras el usuario opera la app; cruzar **ACTION / EXPECT** con consola + red + snapshot; corregir hallazgos en código cuando aplique.
- **Criterios de éxito:** Sin errores P0 nuevos en consola en el flujo probado; red sin 4xx/5xx inesperados; hallazgos documentados con `U-xx` / `E-xx` / `LDN-…`.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION | EXPECT |
|----|----------------|--------|--------|
| U-00 | Inicio | (implícito) Arrancar local y abrir calculadora | App en `:5173`, API OK |

_Pegá aquí tus pasos como:_

```text
ACTION: …
EXPECT: …
```

## 4. Evidencia del agente (`E-xx`) — línea base (carga inicial)

| ID | Tool / fuente | Hallazgo |
|----|----------------|----------|
| E-01 | `list_console_messages` | 2× **warn** React Router future flags (`v7_startTransition`, `v7_relativeSplatPath`) |
| E-02 | `list_console_messages` | 1× **error** (React): prop DOM desconocida **`fetchPriority`** en `<img>` dentro de `QuoteVisualVisor.jsx` — sugerencia: usar **`fetchpriority`** |
| E-03 | `list_network_requests` | 84 req; módulos Vite 200/304; Shopify + Google gsi 200; video MP4 206 |
| E-04 | `take_snapshot` | Paso 1/13; modal Panelin abierto; toolbar con **Log interacción** (dev) |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | Notas |
|---------|--------------|--------|
| U-00 | E-01–E-04 | Stack local levantado por agente (`npm run dev:full`); MCP navegó a `:5173` |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Acción |
|----|-----------|--------|--------|
| LDN-2026-04-05-01 | P2 | `fetchPriority` en `<img>` (React DOM) | Corregido: atributo HTML `fetchpriority` + `eslint-disable-next-line react/no-unknown-property` en [`QuoteVisualVisor.jsx`](../../src/components/QuoteVisualVisor.jsx). Post-HMR: consola sin ese `error`, solo warnings de React Router. |
| LDN-2026-04-05-02 | P3 | React Router future flags | Opt-in futuro en router config (pendiente si se prioriza) |

## 7. Cómo seguimos (protocolo corto)

1. **Vos:** después de cada acción relevante, escribí en el chat **ACTION** + **EXPECT** (o “Paso N listo”).
2. **Yo:** `take_snapshot` + `list_console_messages` + `list_network_requests` (y performance si mencionás lentitud).
3. **Corrección:** si el hallazgo es claro en `src/`, propongo parche y lo aplicamos; si es duda de negocio, lo dejamos como `LDN` abierto.

## 8. Verificación

- [ ] Tras tus pasos: consola revisada de nuevo
- [x] Línea base local capturada (esta corrida)
- [x] Fix `fetchpriority` aplicado (recargá Vite y confirmá que desaparece el warning del `img`)
