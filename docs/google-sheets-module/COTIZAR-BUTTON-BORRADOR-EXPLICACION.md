# Cotizar Button — Estructura de la "Borrador Explicación"

**Fecha:** 2026-05-29  
**Decisión actual:** Opción A — Definir primero el texto que se genera automáticamente para el comprador.

**Decisiones del usuario confirmadas:**
- Tono: Profesional
- Nivel de detalle: Resumen de lo importante (no precios unitarios detallados)
- Disclaimer: Mantener como está propuesto
- Condiciones comerciales: Solo en el PDF (no en la explicación)
- Speed Mode: La explicación debe seguir siendo **completa** (no puede faltar información clave)

---

## 1. Objetivo de esta Explicación

Esta es la explicación que se escribe automáticamente en la columna temporal de **Borrador Explicación** cuando alguien del backoffice aprieta el botón **"Cotizar"**.

**Características clave:**
- Debe ser **útil para el comprador** (no solo datos técnicos).
- Debe ser **fácil de revisar y editar** por el backoffice.
- Debe explicar claramente **qué se consideró** de la consulta original.
- Debe dar una **explicación paso a paso** del presupuesto.
- Debe referenciar el PDF que está en la columna de borrador (y luego en K cuando se apruebe).

---

## 2. Estructura Recomendada del Texto

Se propone la siguiente estructura (en Markdown para que quede bien formateada cuando se copie a WhatsApp o email):

```markdown
**Presupuesto generado automáticamente basado en tu consulta**

**Tu consulta original:**
> [Texto completo o resumen de la columna "Consulta"]

**Qué consideramos para esta cotización:**
- Tipo de proyecto: [Techo / Pared / Combinado]
- Superficie total: [X m²]
- Zona: [Zona X]
- Altura y condiciones de obra: [detalles relevantes]
- Tipo de panel recomendado: [ISODEC EPS 150mm / ISOROOF / etc.]
- Terminación: [Blanco lisa / ...]
- Estructura: [Metal / Hormigón / ...]
- Principales accesorios incluidos: [lista breve]

**Resumen del presupuesto generado:**

Se realizó el cálculo considerando las especificaciones indicadas en tu consulta, aplicando los espesores y tipos de panel más adecuados según zona y uso. Se incluyeron los accesorios estructurales necesarios y el traslado a destino.

**Total estimado:** $[monto] USD + IVA

(El desglose detallado con precios unitarios, cantidades y condiciones comerciales se encuentra en el PDF).

---

**Presupuesto detallado:**  
[Link al PDF del borrador]

---

Este presupuesto fue generado automáticamente a partir de la información que nos diste.  
Si hay datos que no estaban claros en tu consulta (medidas exactas, altura, tipo de estructura, etc.), es posible que el valor varíe.

¿Querés que ajustemos algo (medidas, espesor, terminación, cantidad, etc.)?
```

---

## 3. Fuentes de Información Recomendadas (del Orchestrator)

Para generar un texto de calidad, idealmente deberíamos extraer del resultado del `runPresupFlow`:

| Información | Dónde viene idealmente | Prioridad |
|-------------|------------------------|---------|
| Tipo de proyecto (Techo/Pared) | IntakeClassification | Alta |
| Superficie total calculada | PricingBOMReviewer / Context | Alta |
| Tipo y espesor de panel recomendado | PricingBOMReviewer | Alta |
| Zona y condiciones | Intake o datos de la fila | Media |
| Desglose de precios principales | PricingBOMReviewer | Alta |
| Accesorios incluidos | PricingBOMReviewer | Media |
| Observaciones / supuestos tomados | DocumentGatekeeper o trace | Alta |
| Veredicto del Pricing Gate | gates.pricing | Alta (para saber si hubo rechazos o ajustes) |

**Nota importante:** Actualmente el orchestrator devuelve `artifacts`, `gates` y `trace`. Habrá que evaluar qué tan rico es el output para armar esta explicación (puede requerir ajustes en el orchestrator o prompts específicos).

---

## 4. Versiones según Modo

### Modo Normal (por defecto - recomendado)
- Texto completo como el del punto 2.
- Mayor detalle y profesionalismo.
- Más tiempo de generación.

### Speed Mode
Aunque es más rápido, la explicación debe seguir siendo **completa** (no puede faltar información importante):

```markdown
**Presupuesto generado automáticamente (modo rápido)**

Basado en tu consulta:  
> [resumen de la consulta]

**Qué se consideró:**
- Superficie: [X m²]
- Zona: [Zona X]
- Tipo de panel: [ISODEC EPS 150mm / ...]
- Terminación: [Blanco lisa]
- Estructura: [Metal]

Se incluyeron los accesorios estructurales necesarios y traslado a destino.

**Total estimado:** $[monto] USD + IVA

El presupuesto completo con todos los detalles está disponible aquí:  
[Link al PDF]

Este cálculo se realizó de forma automática. Si necesitás ajustes o mayor precisión en algún punto, avisanos.
```

---

## 5. Recomendaciones de Formato y Uso

- Usar **Markdown** (negritas, listas, bloques de cita) para que quede legible cuando se copie a WhatsApp o email.
- Siempre incluir el link al PDF al final.
- Agregar una frase de disclaimer clara ("generado automáticamente", "sujeto a confirmación de medidas", etc.).
- El backoffice debe poder **editar** este texto antes de aprobarlo como oficial.

---

## 6. Decisiones Confirmadas (respuestas del usuario)

1. Tono → **Profesional**
2. Nivel de detalle → **Resumen de lo importante** (no precios unitarios detallados)
3. Disclaimer → Mantener como está propuesto (está bien)
4. Condiciones comerciales → **Solo en el PDF**
5. Speed Mode → La explicación debe seguir siendo **completa** (no puede faltar información clave)

---

## 7. Preguntas abiertas restantes

- ¿Qué tan literal debe ser el texto respecto a los artifacts que devuelve el orchestrator?
- ¿Querés que incluya siempre una mención a "sujeto a confirmación final de medidas y condiciones"?
- ¿Hay algún otro punto que quieras ajustar en la estructura?

---

**Estado:** Primera propuesta de estructura de la explicación.

---

Decime qué te parece esta estructura y respondé las preguntas de arriba (o agregá las tuyas).  
Una vez que tengamos esto más claro, podemos pasar a definir exactamente qué datos le pediremos al orchestrator para armarla.