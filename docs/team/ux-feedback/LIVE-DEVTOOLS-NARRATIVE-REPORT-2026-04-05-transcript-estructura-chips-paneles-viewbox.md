# LIVE-DEVTOOLS-NARRATIVE-REPORT — Carteles apoyos/fijación (Estructura 2D)

**Fecha:** 2026-04-05  
**Contexto:** Captura usuario + pedido explícito (carteles violeta: no sobre paneles, no cortados, caja ≥ contenido).  
**Skill:** `live-devtools-transcript-action-plan`  
**URL referencia:** local `http://localhost:5173/` / prod `https://calculadora-bmc.vercel.app` (no corrida MCP en este hilo).

---

## 1. Tabla narrativa (usuario)

| ID | ACTION (hecho en app) | EXPECT (intención) | Notas |
|----|------------------------|-------------------|--------|
| U-01 | Ver paso Estructura con multizona | Carteles legibles, asociados a cada zona | “Carteles con cruz” = marcadores en captura |
| U-02 | Leer “3 apoyos / N pts fij.” | Caja con padding; segunda línea no pegada al borde | Texto largo (ej. 122 pts) debe entrar |
| U-03 | Revisar posición respecto al azul | **Nunca** sobre el relleno de paneles | Antes: candidatos “interior” ponían chip encima del panel |
| U-04 | Revisar bordes del SVG | Nada cortado por el viewport | `viewBox` insuficiente para chips fuera del techo |
| U-05 | Comparar con cotas rojas | Cotas legibles; chip no tapado si es posible | Se mantiene evitación de obstáculos de cota |

---

## 2. Tabla evidencia (MCP / DevTools)

| ID | Fuente | Hallazgo |
|----|--------|----------|
| E-01 | *(no ejecutado en esta sesión)* | Sin `list_console_messages` / `take_snapshot` en este hilo; la evidencia es captura estática aportada por el usuario y el diff en repo. |

---

## 3. Cruce usuario → evidencia

| Usuario | Evidencia | ¿Coincide? |
|---------|-----------|------------|
| U-03 | Código previo: candidatos interior del chip | Parcial: explicaba solape sobre paneles |
| U-04 | `viewBox` solo ampliado para cotas | Parcial: chips exteriores podían clippear |
| U-02 | `chipH` fijo × `zm` pequeño vs dos líneas | Sí: caja chica vs contenido |

---

## 4. Plan de acción (implementado)

| Fase | Cambio | Archivo |
|------|--------|---------|
| Investigación | Ubicar chip, `svgViewBox`, colisión con cotas | `RoofPreview.jsx` |
| Datos/UI | Solo posiciones **fuera** del rect `r` (gap `roofGap`); clamp dentro de bounds parseados del `viewBox` | `pickEstructuraChipPlacement` |
| UI | `chipSlack` extra en pads Estructura + `estructuraViewBounds` desde string `viewBox` | `svgViewBox` useMemo + `useMemo` bounds |
| UI | `chipW` mínimo por longitud de texto; `chipH` desde `padY` + líneas; `secondFs` | `EstructuraZonaOverlay` |
| Verificación | `npm run lint` + `npm test` | OK |

### Criterios de aceptación

1. Ningún cartel con AABB que intersecte el rectángulo de zona ampliado por `roofGap` (no sobre “paneles”).  
2. Cartel contenido en `viewBounds` con margen `vm` (salvo fallback extremo).  
3. Altura del `rect` ≥ baselines + descenders de las dos líneas + `padY`.  
4. Ancho acota a texto largo (tope 3,9 m coords — coherente con escala del plano).

---

## 5. Próxima verificación sugerida

- MCP **chrome-devtools** en local: paso **Estructura**, multizona, zoom ventana pequeña; consola sin errores.  
- Revisar caso **zm** muy grande (plano enorme): si hiciera falta, subir `chipSlack` o tope `chipW`.

---

## 6. Referencias código

- `src/components/RoofPreview.jsx`: `chipOverlapsRoofPanel`, `pickEstructuraChipPlacement`, `EstructuraZonaOverlay`, `chipSlack`, `estructuraViewBounds`.
