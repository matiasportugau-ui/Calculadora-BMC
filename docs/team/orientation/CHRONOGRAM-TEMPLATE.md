# Plantilla de cronograma (copiar por proyecto)

**Nombre del programa:** _…_  
**Dueño:** _Matias_  
**Horizonte revisado:** _fecha_  
**Fuente JSON:** `docs/team/orientation/programs/<id>.json`

---

## Fases (altura del proyecto)

| ID | Nombre | Estado | Semanas (est.) | Criterios de salida |
|----|--------|--------|----------------|---------------------|
| p1 | Fundaciones | todo / doing / done | _ej. 2–4_ | _ej. credenciales, CI verde_ |
| p2 | Operación integrada | | _ej. 4–8_ | _ej. CRM+ML+API en prod_ |
| p3 | Escala y riesgos | | _ej. 4–12_ | _ej. E2E, alertas, fiscal mensual_ |

**Fase actual:** _pX_ — _una línea de por qué estás acá._

---

## Streams (trabajo en paralelo)

| Stream | Objetivo del trimestre | Riesgo si se abandona |
|--------|-------------------------|------------------------|
| Producto / Calculadora | | |
| CRM / ML / WhatsApp | | |
| Infra / Cloud Run | | |
| Fiscal / compliance | | |

---

## Puntos de convergencia (todos los streams)

| Cuándo | Qué debe estar listo | Comando o doc |
|--------|----------------------|---------------|
| Antes de deploy | | `npm run pre-deploy` |
| Fin de mes fiscal | | _planilla / contador_ |

---

## Próximas 5 tareas (rellenar desde `program:status` o JSON)

1. _…_
2. _…_

---

## Reglas de uso

- Actualizar el JSON al cerrar tareas; este Markdown es **opcional** y puede ser solo la vista humana del mismo contenido.
- Si el cronograma se mueve más de **2 semanas**, ajustá `estWeeks` o `notes` en el JSON y una línea en `PROJECT-STATE.md`.
