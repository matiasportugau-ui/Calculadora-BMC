# Techo principal, tramos de largo y taxonomía de encuentros (planta)

Contexto: **paso 7 / 13** del wizard modo vendedor (*Solo techo*) = **Dimensiones (metros o paneles)** — aquí se definen los **cuerpos de techo** (zonas) que entran al presupuesto y su disposición en **planta** (`preview.x` / `preview.y`).

---

## 1. Techo principal (referencia de presupuesto)

- **Definición de producto:** entre todas las zonas válidas, una actúa como **techo principal**: suele ser la de **mayor área** (`largo × ancho`) y es la referencia mental del presupuesto (obra “principal” + **fragmentos / anexos**).
- **Implementación:** campo opcional `techo.zonaPrincipalGi` (índice 0-based). Si no está definido, la UI usa **automáticamente** la zona de mayor área (`defaultPrincipalZonaIndex` en `src/utils/roofPrincipalZona.js`).
- **Override:** el usuario puede marcar otra zona como principal sin cambiar geometría; sirve para informes, prioridad visual y futuras reglas (p. ej. orden en PDF).

---

## 2. “Otro largo” sin confundir con otro ancho: tramo apilado

**Actualización (2026-04-02):** Si la intención es **otras medidas de paneles en el mismo cuerpo / misma superficie** (forma no rectangular, anexo al costado del rectángulo principal), el flujo de producto es **anexo lateral** — solo **izquierda o derecha** en planta, sin “encadenar” longitudinalmente al frente/fondo. Modelo de datos: `preview.attachParentGi`, `lateralSide`, `lateralRank`; especificación y UX: [`ROOF-LATERAL-ANNEX-SAME-BODY-SPEC.md`](./ROOF-LATERAL-ANNEX-SAME-BODY-SPEC.md), layout [`src/utils/roofLateralAnnexLayout.js`](../../src/utils/roofLateralAnnexLayout.js). La subsección siguiente (**tramo apilado abajo**) sigue aplicando cuando el caso real es **mismo ancho y otro tramo de largo hacia el frente** (+y).

**Problema:** añadir siempre una **nueva zona** en fila obliga a explicar un **encuentro** (a menudo *continuo*) entre piezas que en obra son el **mismo ancho** y solo otro **tramo de largo** hacia el frente.

**Solución en UI (MVP):** botón **“Agregar tramo de largo abajo”** sobre una zona base:

- Crea una **nueva zona** (el motor de cotización sigue siendo **una zona = un par largo×ancho**) con el **mismo ancho** que la base y un largo inicial igual al de la base (editable).
- Asigna `preview.x` / `preview.y` para que el rectángulo quede **inmediatamente debajo** en planta (`+y` = hacia FRENTE), con separación `ROOF_PLAN_GAP_M`, de modo que `findEncounters` detecta un **encuentro horizontal** en el borde compartido.
- El modo de encuentro sigue siendo **Continuo / Pretil / Cumbrera / Desnivel** en el paso **Bordes** (ver `ROOF-ENCOUNTER-LOGIC-SPEC.md`). Por defecto el usuario puede dejar **continuo** si es un solo plano.

**Futuro (no implementado):** un único objeto zona con `tramos: [{ largo }]` compartiendo ancho — exige cambios en `calcTechoCompleto`, BOM y planta; el flujo actual evita ese salto manteniendo **N zonas** con layout explícito.

---

## 3. Taxonomía geométrica de encuentros (planta)

`findEncounters` (`src/utils/roofPlanGeometry.js`) solo considera rectángulos **alineados a ejes** y aristas que **tocan** dentro de una tolerancia (`ROOF_PLAN_EPS`). Para cada par de zonas puede darse:

| Caso | Condición geométrica | `orientation` en datos | Nota |
|------|----------------------|-------------------------|------|
| Encuentro **vertical** | Borde derecho de A = borde izquierdo de B (o espejo) | `vertical` | Línea en x constante; solape en **y** ≥ `ROOF_PLAN_MIN_OVERLAP` |
| Encuentro **horizontal** | Borde inferior de A = borde superior de B (o espejo) | `horizontal` | Línea en y constante; solape en **x** ≥ mínimo |
| Sin encuentro | Rectángulos separados o solo coincidencia puntual | — | No genera segmento compartido útil |

**Casos compuestos (varias zonas):**

- **L, U, patio:** varios segmentos vertical/horizontal entre pares; cada segmento es un encuentro con longitud = solape 1D.
- **Dos aguas:** el **ancho en planta** por zona es la **mitad** del ancho declarado por faldón; los encuentros se calculan sobre esos `w`, `h = largo`.

---

## 4. Taxonomía semántica (qué se cotiza en el tramo compartido)

Independiente de la geometría, el usuario elige **modo** en `preview.encounters[lado]` (normalizado en `roofEncounterModel.js`):

1. **Continuo** — sin perfil en el tramo compartido.
2. **Pretil** — perfiles propio y vecino.
3. **Cumbrera** — un solo perfil compartido.
4. **Desnivel** — perfiles alto/bajo (dos planos distintos).

La **geometría** sugiere si el encuentro es “mismo plano” o “quiebre”, pero la **decisión comercial** sigue siendo del usuario hasta que existan reglas automáticas.

---

## 5. Matriz resumen

| Necesidad de obra | Modelo actual recomendado |
|-------------------|---------------------------|
| Mismo ancho, otro largo hacia frente | **Tramo apilado** (nueva zona + `preview` debajo) + encuentro *continuo* si aplica |
| Mismo cuerpo, otras medidas al costado (no al frente) | **Anexo lateral** (`attachParentGi` + costado + orden) — ver spec enlazada arriba |
| Otro ancho o cuerpo separado | **Nueva zona raíz** + posición en planta (drag o auto) |
| Referencia “obra principal” | **Techo principal** (`zonaPrincipalGi` o mayor área) |

---

## Referencias

- Modos y JSON: [`ROOF-ENCOUNTER-LOGIC-SPEC.md`](./ROOF-ENCOUNTER-LOGIC-SPEC.md)
- Geometría: [`src/utils/roofPlanGeometry.js`](../../src/utils/roofPlanGeometry.js)
- Principal / apilado: [`src/utils/roofPrincipalZona.js`](../../src/utils/roofPrincipalZona.js)
- Anexos laterales mismo cuerpo: [`ROOF-LATERAL-ANNEX-SAME-BODY-SPEC.md`](./ROOF-LATERAL-ANNEX-SAME-BODY-SPEC.md), [`src/utils/roofLateralAnnexLayout.js`](../../src/utils/roofLateralAnnexLayout.js)
