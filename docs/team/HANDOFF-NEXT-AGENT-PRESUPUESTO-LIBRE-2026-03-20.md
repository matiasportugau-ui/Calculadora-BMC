# Handoff — Siguiente agente: Presupuesto libre + API + verificación

**Fecha:** 2026-03-20  
**Ámbito:** Calculadora BMC (`Calculadora-BMC`), escenario **Presupuesto libre**, endpoint API nuevo, GPT Actions / OpenAPI.

Este documento condensa **contexto**, **estado esperado del repo** y un **prompt copiable** para que un agente nuevo continúe sin releer todo el hilo.

---

## 1. Contexto (qué quedó hecho)

- **Motor único:** `src/utils/presupuestoLibreCatalogo.js`  
  - `flattenPerfilesLibre(perfilTecho, perfilPared)`  
  - `computePresupuestoLibreCatalogo(input)` con `catalog` opcional (p. ej. salida de `getPricing()` para overrides en UI).

- **UI canónica (App usa backup):** `src/components/PanelinCalculadoraV3.jsx`  
  - Escenario `presupuesto_libre` (`SCENARIOS_DEF` / `VIS` ya lo tenían).  
  - Acordeones: paneles, perfilería, tornillería/herrajes, selladores, servicios/flete, extraordinarios.  
  - `groups`: si `results.presupuestoLibre`, usa `libreGroups` y **no** duplica línea de flete.  
  - Estado libre persistido en snapshots locales, Drive y `serializeProject` / `deserializeProject`.

- **V3 standalone:** `src/components/PanelinCalculadoraV3.jsx` llama al mismo motor pasando catálogo **inline** (archivo autónomo con precios duplicados).

- **Constantes BOM:** `src/data/constants.js` — categoría `EXTRAORDINARIOS`; `FIJACIONES` en `CATEGORIA_TO_GROUPS` mapea también `TORNILLERÍA`.

- **Proyecto `.bmc.json`:** `src/utils/projectFile.js` — campos `libre*` + merge de `categoriasActivas` con defaults de `CATEGORIAS_BOM`.

- **API:** `server/routes/calc.js`  
  - `POST /calc/cotizar/presupuesto-libre` (cuerpo alineado al motor).  
  - `buildGptResponse`: si `results.presupuestoLibre`, **no** añade otro flete por query `flete`; resumen/texto ajustados.  
  - `GET /calc/gpt-entry-point`: escenario `presupuesto_libre` y acción nueva en `GPT_ACTIONS`.

- **OpenAPI:** `docs/openapi-calc.yaml` — path + schema `PresupuestoLibreRequest`.

- **Tests:** `tests/validation.js` suite **16b**; `npm test` → **119 passed** (objetivo: mantener en verde tras tus cambios).

Documentación ya tocada: `docs/CHANGELOG.md`, `docs/team/PROJECT-STATE.md` (entrada presupuesto libre).

---

## 2. Archivos clave (mapa rápido)

| Archivo | Rol |
|--------|-----|
| `src/utils/presupuestoLibreCatalogo.js` | Motor catálogo presupuesto libre |
| `src/components/PanelinCalculadoraV3.jsx` | UI + estado + `groups` |
| `server/routes/calc.js` | Ruta API, `buildGptResponse`, GPT discovery |
| `docs/openapi-calc.yaml` | Contrato GPT / clientes |
| `src/data/constants.js` | `CATEGORIAS_BOM` / `CATEGORIA_TO_GROUPS` |
| `src/utils/projectFile.js` | Serialización proyecto |
| `tests/validation.js` | Suite 16b + resto |

---

## 3. Checklist de verificación (primer bloque del próximo run)

1. **`npm test`** — debe seguir en **119 passed** (o más, si agregás tests).

2. **`npm run lint`** — 0 errores en `src/` (warnings existentes en backup pueden quedar documentados).

3. **API local** (con servidor en marcha):  
   - `npm run start:api` → `POST http://localhost:3001/calc/cotizar/presupuesto-libre` con JSON mínimo:
     - `lista`: `web` | `venta`
     - `librePanelLines`: `[{ "familia": "ISODEC_EPS", "espesor": 100, "color": "Blanco", "m2": 10 }]`
     - Opcional: `librePerfilQty`, `libreFijQty`, `libreSellQty`, `flete`, `libreExtra`  
   - Confirmar `ok: true`, `meta.escenario` coherente, `bom` sin **flete duplicado** si ya va en líneas del motor.

4. **Contrato (si aplica en tu flujo):** `npm run test:contracts` con API arriba (ver `AGENTS.md`).

5. **UI manual:** modo Cliente → escenario **Presupuesto libre** → cargar al menos una línea de panel → totales y BOM coherentes; toggles de categorías BOM filtran `TORNILLERÍA` / `EXTRAORDINARIOS`.

---

## 4. Próximos pasos sugeridos (prioridad sugerida)

**A. Deploy / GPT Builder**

- Desplegar build que incluya `calc.js` + OpenAPI actualizado.  
- En Custom GPT: importar o actualizar schema URL (`/calc/openapi` o YAML del repo).  
- Añadir en instrucciones del GPT cuándo usar **`calcular_presupuesto_libre`** vs **`calcular_cotizacion`**.  
- Probar una conversación: partidas sueltas sin dimensiones de techo/pared.

**B. Producto / UX**

- Opcional: acotar listado de tornillería en presupuesto libre a `PRESUPUESTO_LIBRE_IDS` en `constants.js` (hoy se listan todas las `FIJACIONES` + `HERRAMIENTAS`).  
- Wizard modo vendedor: si el usuario elige presupuesto libre en paso escenario, ya cae en formulario tipo cliente; documentar o añadir hint en UI.

**C. Calidad**

- Test de contrato o integración mínima para `POST /calc/cotizar/presupuesto-libre` (body fijo, assert `ok` y estructura `bom`).  
- Revisar `generatePrintHTML` / PDF para escenario `presupuesto_libre` (dimensiones vacías, títulos).

**D. Estado del equipo**

- Tras cerrar A–C: una línea en `PROJECT-STATE.md` → **Cambios recientes** y, si aplica, propagación en `PROJECT-TEAM-FULL-COVERAGE.md` §4.

---

## PROMPT PARA EL NUEVO AGENTE (copiar debajo de esta línea)

```
Sos el siguiente agente en Calculadora-BMC. Leé primero:

- docs/team/HANDOFF-NEXT-AGENT-PRESUPUESTO-LIBRE-2026-03-20.md (este handoff completo)
- docs/team/PROJECT-STATE.md — Cambios recientes
- AGENTS.md — comandos npm y convenciones

Objetivo de tu corrida (en orden):

1) Verificar: npm test, npm run lint en src/, y con API local probar POST /calc/cotizar/presupuesto-libre con un body mínimo (librePanelLines con ISODEC_EPS 100mm y m2>0). Confirmar que no haya flete duplicado en la respuesta cuando el flete ya viene del motor.

2) Si todo pasa: documentar en PROJECT-STATE.md (Cambios recientes) el resultado de la verificación.

3) Siguiente prioridad según el handoff §4: alinear GPT Builder con openapi-calc.yaml (nueva operación calcular_presupuesto_libre) O agregar test de contrato para la ruta nueva O acotar tornillería a PRESUPUESTO_LIBRE_IDS — elegir UNA línea principal y ejecutarla hasta criterio de hecho claro; no mezclar deploy real sin que Matias confirme URLs/credenciales.

Reglas: no commitear .env; no hardcodear sheet IDs; errores Sheets en API = 503 según convención del repo.

Al terminar: resumen corto al usuario con archivos tocados y comandos corridos.
```

---

## 5. Referencias cruzadas

- Estado del proyecto: [PROJECT-STATE.md](./PROJECT-STATE.md)  
- Changelog: [../CHANGELOG.md](../CHANGELOG.md)  
- Checklist E2E / URLs prod: [E2E-VALIDATION-CHECKLIST.md](./E2E-VALIDATION-CHECKLIST.md)  
- OpenAPI servido en runtime: `GET {PUBLIC_BASE}/calc/openapi` (ver `server/config` / `config.publicBaseUrl`).
