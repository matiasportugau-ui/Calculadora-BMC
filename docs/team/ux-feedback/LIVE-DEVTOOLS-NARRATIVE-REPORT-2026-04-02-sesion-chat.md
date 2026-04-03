# LIVE-DEVTOOLS-NARRATIVE-REPORT — 2026-04-02 (sesion-chat)

Skill: **live-devtools-narrative-mcp**. Invocación: **Narrativa en vivo DevTools**.

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-02 |
| Base URL | https://calculadora-bmc.vercel.app |
| Entorno | prod (Vercel) |
| Navegador / MCP | chrome-devtools MCP |

## 2. Objetivo de la sesión

- **Goal:** Navegar la app comentando objetivos, acciones y expectativas; anotar mejoras y **bloqueos** hasta cerrar la primera inspección.
- **Criterios de éxito (bloque 1):** Wolfboard → Calculadora → **ÉXITO** (U-02).
- **Inspección multizona / techo (bloque 2):** Flujo **Solo techo** → lista **Precios BMC** → **EPS 100 mm**, color **blanco**, dimensiones **12 m × 15 paneles (ancho)** + **segunda área**; modo **largo** con **pendiente** y **estructura metálica**; paso **3D / accesorios** y **encuentro entre zonas** — **bloqueado**: no permite avanzar al siguiente paso (cierre inspección).

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | ACTION (hecho) | EXPECT (esperado) | Resultado (usuario) |
|----|----------------|-------------------|----------------------|
| U-01 | Abrir sesión narrativa + URL | Base MCP + informe | OK |
| U-02 | Wolfboard → Abrir calculadora | Llegar a `/` paso 1 | **ÉXITO** |
| U-03 | Escenario **Solo techo** | Avanzar a esa sección | **Bien, funcionó** |
| U-04 | Paso **Caída del techo** | Continuar flujo | OK |
| U-05 | Lista precios → **Precios BMC** (familia techo), **ISODEC EPS** **100 mm**, **blanco** | Selección coherente | (implícito OK hasta pasos posteriores) |
| U-06 | Dimensiones: primero 20 m × 15 paneles → corrige a **12 m × 15 paneles ancho** | Valores corregidos | OK |
| U-07 | Añadir **otra área**; posicionar **adjunta**, **derecha**, **arriba** | Segunda zona colocada | Parcial — problemas de **reubicación** |
| U-08 | **Doble clic** en borde para **pendiente / flecha** de identificación | Marca pendiente visible | **NO** — *no permite* |
| U-09 | Dos zonas **adjuntas** | Listo para siguiente lógica | OK (pero pendiente pendiente/slope UX) |
| U-10 | Modo cálculo **largo**; **considerar pendiente del panel**; **estructura metálica**; **Siguiente** | Avanzar | OK (según narrativa) |
| U-11 | **3D** — selección de **aristas / accesorios** | Elegir bordes con claridad | **Mejora deseada:** identificación visual sutil pero **clicable**; opciones de **perfil** por arista |
| U-12 | Asignación masiva de **canales/canalón** en varias aristas (zonas 1/2/3, frentes, laterales, etc.) | Cubrir todos los lados necesarios | OK en intención; fricción UX (U-11) |
| U-13 | **Encuentro entre dos techos** — perfiles de unión | Modelo acorde a realidad | **Problema A:** dibujo de **paneles perpendicular** a la orientación inicial; deberían ir **hacia el frente** como en la primera ubicación |
| U-14 | **Encuentro de zonas** — de macro a micro: (1) misma cubierta continua sin perfil; (2) **pretil/muro** con perfiles + **tablas** por lateral compartido zona 1 y 2; (3) **cambio de agua** (dos aguas) → **cumbrea** compartida | UI que refleje esas ramas | **Problema B:** hoy no cubre bien las ramas; requiere rediseño de opciones |
| U-15 | Tras elegir perfiles en lados del encuentro | **Siguiente** habilitado | **NO** — *bloqueado*; no avanza **incluso** con cualquier combinación probada |

### Resumen en una frase (usuario)

Inspección **cerrada** en el paso de **encuentro de zonas / enlace de techos**: **orientación de paneles incorrecta** en el modelo, **modelo de encuentro** insuficiente para continuidad / muro / cambio de agua, y **flujo bloqueado** sin poder pasar al siguiente paso.

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento | Tool / fuente | Hallazgo |
|----|---------|---------------|----------|
| E-01–E-08 | Sesión previa | (ver historial) | Hub + calculadora landing |
| E-09 | 2026-04-02 seguimiento | `navigate_page` `/` | Carga OK |
| E-10 | Tras clic **Solo Techo** + **Siguiente** | `take_snapshot` | **PASO 2 DE 13 — Caída del techo**; botones **1 Agua** / **2 Aguas**; **4 Aguas** deshabilitado |
| E-11 | Tras **1 Agua Pendiente única** + **Siguiente** | `take_snapshot` | **PASO 3 DE 13 — Lista de precios**; **Precio BMC** / **Precio Web** |
| E-12 | Tras clic **Precio BMC** | `take_snapshot` | **Siguiente** habilitado; *selectores familia/EPS/color no aparecen en snapshot a11y* (posible custom UI / canvas) |
| E-13 | Paridad narrativa | *No re-ejecutado en MCP* | Pasos **planta multizona**, **doble clic pendiente**, **3D accesorios**, **encuentro** — evidencia = **narrativa U-07–U-15** + implementación en `RoofPreview.jsx` / flujo calculadora (ver §6) |

**Nota MCP:** automatizar más allá del paso 3 requeriría **fill_form** / scripts o interacción con controles no expuestos en el árbol de accesibilidad; la evidencia de **bloqueo** y **bugs** la aporta la sesión real del usuario (U-13–U-15).

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-02 | E-05–E-08 | sí | — |
| U-03–U-04 | E-10 | sí | MCP confirma pasos 1→2 alineados con “Solo techo” + caída |
| U-05 | E-11–E-12 | parcial | Precio BMC seleccionable; detalle EPS 100 / blanco no visible en a11y |
| U-08 | E-13 | **no** | Doble clic pendiente / flecha: **gap UX o bug** — confirmar en `RoofPreview` |
| U-13–U-15 | E-13 | **no** | Orientación paneles + encuentro + **wizard bloqueado** |

## 6. Hallazgos priorizados (`LDN-2026-04-02-xx`)

| ID | Sev | Título | Resumen | Área probable |
|----|-----|--------|---------|----------------|
| LDN-2026-04-02-01 | **P0** | **Wizard bloqueado en encuentro de zonas** | Tras configurar perfiles en el encuentro, **Siguiente** no habilita / no avanza; bloquea cierre de flujo. | `PanelinCalculadoraV3_backup.jsx` (pasos/asistente), lógica validación encuentro, posiblemente `RoofPreview.jsx` |
| LDN-2026-04-02-02 | **P0** | **Orientación de paneles vs frente inicial** | En 3D/plano, paneles se ven **perpendiculares** al frente definido al posicionar zonas; esperado: alineación **hacia el frente** como en la primera colocación. | `RoofPreview.jsx`, `roofPlanGeometry.js`, BOM/dibujo |
| LDN-2026-04-02-03 | **P1** | **Pendiente / flecha — doble clic no responde** | Usuario espera **doble clic** en arista superior para marcar **pendiente** (flecha); la UI **no lo permite**; impacta 3D y relación frente superior/inferior entre zonas. | `RoofPreview.jsx` (handlers pointer/dblclick, estado pendiente) |
| LDN-2026-04-02-04 | **P1** | **Modelo de encuentro zona–zona (macro→micro)** | Hace falta distinguir: **(a)** misma cubierta continua (sin perfil); **(b)** pretil/muro con **perfiles + tablas** por lateral compartido en ambas zonas; **(c)** cambio de agua / dos aguas con **cumbrea** común. La UI actual no soporta bien estas ramas. | Producto + `RoofPreview` / asistente pasos |
| LDN-2026-04-02-05 | **P2** | **Selección de aristas en 3D (accesorios)** | Necesidad de **identificación visual** más clara (sutil pero **fácil de clic**) y menú de **perfiles** por arista. | Vista 3D / `RoofPreview` o componente accesorios |

## 7. Recomendaciones y siguientes pasos (implementación)

1. **Reproducir LDN-01** en local con los mismos datos (2 zonas, encuentro, perfiles) y registrar **consola** + condición exacta que deshabilita **Siguiente** (validación en código).
2. **Auditar orientación** de paneles (LDN-02) frente a `roofPlanGeometry` / estado de “frente” y vector de caída por zona.
3. **Especificar** interacción de pendiente (LDN-03): doble clic vs botón dedicado; wire a estado que alimente 3D y encuentros.
4. **Diseñar** árbol de decisión para encuentro (LDN-04) antes de más UI; alinear con `USER-NAV-REPORT` / backlog multizona si existe.
5. **Mejora UX** aristas (LDN-05) como iteración tras desbloqueo P0.

## 8. Verificación (checklist)

- [x] Bloque Wolfboard → Calculadora (U-02)
- [x] MCP: pasos 1–3 alcanzables (Solo techo → 1 agua → Precio BMC) (E-10–E-12)
- [ ] Paso planta multizona + pendiente doble clic (U-08) — **falla usuario**
- [ ] Paso 3D / accesorios sin fricción (U-11) — **mejora**
- [ ] Encuentro zonas — orientación paneles (U-13) — **falla**
- [ ] Encuentro zonas — avanzar (U-15) — **bloqueado**

## 9. Fin de primera inspección

**Cierre declarado por el usuario:** la inspección termina en el paso de **encuentro de dos zonas / perfiles**, con **bloqueo** para continuar. Próxima sesión sugerida: **Agent mode** + repro local o grabación corta solo del paso bloqueado para adjuntar **consola** en el momento del clic en **Siguiente**.
