# Biblioteca técnica de productos (BMC / Panelin)

**Propósito:** Punto de entrada **documentado** para material técnico-comercial (flyers, logos por proveedor, fichas, promos) que PANELSIM y el equipo usan como **referencia de producto y discurso**, no como fuente de precios.

**Importante:** Los precios y cantidades de cotización **no** se toman de imágenes; la verdad numérica está en la **MATRIZ**, la **API** (`GET /api/actualizar-precios-calculadora`, `POST /calc/cotizar`) y el código de la calculadora. Ver [`../knowledge/PANELSIM-DIALOGUE-AND-CRITERIA.md`](../knowledge/PANELSIM-DIALOGUE-AND-CRITERIA.md).

---

## Ubicación canónica del contenido binario

Los archivos actualmente viven en la raíz del repo (importación previa), en esta ruta:

`PDF Productos /PDF Productos/`

*(Nota: el directorio externo se llama `PDF Productos ` con un **espacio final** en el primer segmento; en terminal usar comillas o tab-completion.)*

Estructura típica allí:

| Ruta relativa (dentro de `PDF Productos/`) | Contenido |
|---------------------------------------------|-----------|
| `FICHA TECNICA/` | Fichas técnicas |
| `Flyers/`, `BMC Flyer *.jpg|png` | Flyers comerciales BMC |
| `Bromyros/`, `Becam/`, `Armco/`, `Alambresa/`, etc. | Material por proveedor / línea |
| `BMC Logos/` | Logos |
| `Galpones/`, `INFO BMC/`, `ISODEC genericos/`, `Policarbonatos/`, `PU 20-30/`, `Seco Center/`, `SWL - Alquiler de Maquinaria/`, `Viapol/`, `Chalar/` | Colecciones temáticas |

Este `README` es el **índice canónico** en git; los binarios pueden permanecer en la ruta anterior para no duplicar ~26MB+ en otra carpeta. Si en el futuro se **mueve** el árbol completo aquí (`biblioteca-tecnica-productos/media/`), actualizar solo esta sección y [`../knowledge/PANELSIM-FULL-PROJECT-KB.md`](../knowledge/PANELSIM-FULL-PROJECT-KB.md).

---

## Versionado en git (decisión del equipo)

| Opción | Cuándo usar |
|--------|-------------|
| **Commit directo** | Repo privado y tamaño aceptable |
| **Git LFS** | Muchos binarios grandes, clones frecuentes |
| **Solo índice (este README) + `.gitignore` en binarios** | Material en disco local o Drive; el repo solo documenta la convención |

Estado actual: los binarios bajo `PDF Productos /` suelen ser **untracked** o añadidos bajo criterio de Matias; no asumir que todo está en `origin`.

---

## Cómo lo usa PANELSIM

1. **Inventariar** temas por carpeta y cruzar con [`../knowledge/PANELSIM-FULL-PROJECT-KB.md`](../knowledge/PANELSIM-FULL-PROJECT-KB.md) y `docs/google-sheets-module/`.
2. **Incorporar conocimiento** como texto en Markdown del equipo (resúmenes operativos), no como catálogo duplicado de precios.
3. Para **ML**, alinear voz y límites con [`../knowledge/ML-RESPUESTAS-KB-BMC.md`](../knowledge/ML-RESPUESTAS-KB-BMC.md).

---

**Última actualización:** 2026-03-26
