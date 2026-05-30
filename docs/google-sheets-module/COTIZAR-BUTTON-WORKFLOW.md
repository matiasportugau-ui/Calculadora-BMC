# Cotizar Button Workflow — 2.0 Administrador de Cotizaciones

**Objetivo principal:**
Desde cualquier fila de la planilla "2.0 - Administrador de Cotizaciones", poder hacer **un solo clic** en un botón llamado **"Cotizar"** y que el sistema:

1. Tome automáticamente el texto de la columna **Consulta** (columna I).
2. Lo envíe como input al presupuestador / orchestrator.
3. Genere el presupuesto completo + PDF.
4. Guarde el **link del PDF** en la columna **K** (Link Presupuesto).
5. Escriba en la columna **J** (Respuesta AI) una explicación clara y profesional para el comprador que incluya:
   - Qué se consideró de la consulta original.
   - Explicación paso a paso del presupuesto generado.
   - Referencia directa al PDF que está en la columna K.

---

## 1. Columnas involucradas

| Columna | Letra | Nombre actual     | Uso en este workflow                          |
|---------|-------|-------------------|-----------------------------------------------|
| I       | I     | Consulta          | **Input** principal (se envía al orchestrator)|
| J       | J     | Respuesta AI      | **Output** → Explicación comprador (nueva)    |
| K       | K     | Link Presupuesto  | **Output** → Link directo al PDF generado     |

---

## 2. Nombre y ubicación del botón

- **Texto del botón:** `Cotizar`
- **Ubicación recomendada:** 
  - **Sidebar** (panel lateral) que se abre al seleccionar una fila + menú personalizado "⚡ Cotizaciones 2.0".
  - Botones por fila usando Drawings **NO recomendados** (son frágiles, difíciles de mantener y malos para flujos de dos pasos).

**Recomendación fuerte:** Usar **Sidebar** como interfaz principal.

### ¿Por qué Sidebar es claramente mejor en este caso?

| Aspecto                        | Sidebar (HtmlService)                  | Botones por fila (Drawings)          | Ganador     |
|--------------------------------|----------------------------------------|--------------------------------------|-------------|
| UX / Claridad                  | Excelente (puede mostrar formulario dinámico de aclaraciones) | Pobre (solo un botón, sin contexto) | Sidebar    |
| Flujo de dos pasos (Cotizar → Aclaraciones → Re-interpretar) | Muy fácil de implementar              | Muy difícil / feo                    | Sidebar    |
| Mantenimiento y evolución      | Alto (código limpio, fácil agregar campos) | Bajo (drawings se rompen fácil)     | Sidebar    |
| Mostrar información rica       | Excelente (puede mostrar preview de la explicación, estado, errores) | Muy limitado                         | Sidebar    |
| Velocidad de desarrollo        | Media                                  | Rápido al principio, lento después   | Sidebar (largo plazo) |
| Experiencia del backoffice     | Profesional                            | "Trucho" / poco confiable            | Sidebar    |

**Conclusión:** Para lo que estás pidiendo (detección de datos faltantes + box de aclaraciones + botón de Re-interpretar), **el Sidebar es la única opción seria y mantenible**.

Es totalmente posible y es el estándar recomendado para herramientas internas en Google Sheets cuando hay lógica compleja.

---

## 3. Mockup del Sidebar (Propuesta de UI)

A continuación un mockup textual detallado de cómo se vería el Sidebar. Está diseñado para el flujo que pediste: backoffice, revisión humana obligatoria, box de aclaraciones y botón de re-interpretar.

### Estado 1: Al abrir el Sidebar (fila seleccionada)

```
┌──────────────────────────────────────┐
│  ⚡ Cotizar - Fila 13 (Jonas)        │
├──────────────────────────────────────┤
│                                      │
│  Cliente: Jonas                      │
│  Zona: Parque del plata              │
│  Estado actual: Enviado              │
│                                      │
│  [ Cotizar esta fila ]               │
│  (botón grande, azul)                │
│                                      │
│  Modo: ○ Normal (recomendado)        │
│        ○ Speed Mode                  │
│                                      │
│  Última acción: Ninguna              │
└──────────────────────────────────────┘
```

### Estado 2: Después de hacer clic en "Cotizar" (borrador generado)

```
┌──────────────────────────────────────┐
│  ⚡ Cotizar - Fila 13 (Jonas)        │
├──────────────────────────────────────┤
│                                      │
│  ✅ Borrador generado correctamente  │
│                                      │
│  PDF del borrador:                   │
│  [Ver PDF]  (link temporal)          │
│                                      │
│  ──────────────────────────────────  │
│  DATOS QUE NECESITAN ACLARACIÓN      │
│  ──────────────────────────────────  │
│                                      │
│  La consulta dice:                   │
│  "Isoroof 30 y 50 mm / 7p de 7,5    │
│   mts // ºMetal / completo"          │
│                                      │
│  □ Espesor principal:                │
│    ¿30mm o 50mm? (o ambos)           │
│    [ 50mm ]  [ 30mm ]                │
│                                      │
│  □ Largo por paño:                   │
│    ¿7,5m es el largo útil?           │
│    [ 7.5 ] metros                    │
│                                      │
│  □ Cantidad exacta:                  │
│    [ 7 ] unidades                    │
│                                      │
│  □ Accesorios en "completo":         │
│    ☐ Cumbreras                       │
│    ☐ Canalones y desagües            │
│    ☐ Fijaciones                      │
│    ☐ Flete incluido                  │
│                                      │
│  □ Otra aclaración:                  │
│    [______________________________]  │
│                                      │
│  [ Re-interpretar con estos datos ]  │
│  (botón secundario)                  │
│                                      │
│  ──────────────────────────────────  │
│  Vista previa de explicación (J):    │
│  ──────────────────────────────────  │
│  [Texto generado que iría a la       │
│   columna de borrador...]            │
│                                      │
│  [ Aprobar como Oficial ]            │
│  (deshabilitado hasta re-interpretar │
│   o confirmar que no hay cambios)    │
└──────────────────────────────────────┘
```

### Estado 3: Después de completar aclaraciones y hacer clic en "Re-interpretar"

```
┌──────────────────────────────────────┐
│  ⚡ Cotizar - Fila 13 (Jonas)        │
├──────────────────────────────────────┤
│                                      │
│  ⏳ Re-interpretando...              │
│  (puede tardar 30-90 seg)            │
│                                      │
│  Usando: Modo Normal + aclaraciones  │
│  del usuario                         │
└──────────────────────────────────────┘
```

### Estado 4: Después de re-interpretar (éxito)

```
┌──────────────────────────────────────┐
│  ⚡ Cotizar - Fila 13 (Jonas)        │
├──────────────────────────────────────┤
│                                      │
│  ✅ Borrador actualizado             │
│                                      │
│  PDF actualizado: [Ver PDF]          │
│                                      │
│  Explicación actualizada en columna  │
│  de borrador.                        │
│                                      │
│  [ Aprobar como Oficial ]            │
│  (ahora habilitado)                  │
│                                      │
│  [ Re-interpretar de nuevo ]         │
│  (si querés agregar más datos)       │
│                                      │
│  Historial de interpretaciones:      │
│  • 14:32 - Primera versión           │
│  • 14:35 - Con aclaraciones de       │
│            espesor y accesorios      │
└──────────────────────────────────────┘
```

---

## Notas sobre este diseño

- El Sidebar muestra claramente el flujo de dos pasos.
- El box de "Datos que necesitan aclaración" se genera automáticamente analizando la consulta (puede mejorarse con el tiempo).
- El botón "Re-interpretar" solo aparece después de generar el primer borrador.
- "Aprobar como Oficial" queda deshabilitado hasta que se haya hecho al menos una re-interpretación o el usuario confirme explícitamente que no necesita cambios.
- Se muestra historial simple para trazabilidad (importante para backoffice).

Este mockup está pensado para que sea usable, claro y profesional para el equipo de backoffice.

---

## 3. Flujo completo cuando se aprieta el botón

1. Usuario selecciona una fila en la hoja "Admin.".
2. Abre el Sidebar (o hace clic en el botón de la fila).
3. Presiona **"Cotizar"**.
4. El script:
   - Lee la columna **I** (Consulta) de la fila activa.
   - Llama al endpoint interno del orchestrator:
     `POST /api/internal/presup/run`
     con el body:
     ```json
     {
       "channel": "sheet-admin",
       "consulta": "<texto de la columna I>",
       "mode": "profundo"
     }
     ```
   - El orchestrator ejecuta el flujo completo (Intake → Pricing & BOM Reviewer → Document Gatekeeper → Approval Router).
   - Una vez terminado, se genera el PDF (usando el sistema actual de PDF).
   - El PDF se guarda en Drive (carpeta definida) y se obtiene el link shareable.
5. El script escribe:
   - **Columna K**: Link directo al PDF.
   - **Columna J**: Explicación estructurada para el comprador (ver plantilla abajo).
6. Opcional: Cambia el Estado de la fila a "Cotizado" o "Listo para enviar".

---

## 4. Plantilla de la explicación que va en la columna J

La explicación debe ser clara, profesional y útil para el comprador. Estructura sugerida:

```markdown
**Presupuesto generado automáticamente a partir de tu consulta:**

**Lo que consideramos de tu mensaje:**
- [Resumen corto de los productos y medidas mencionados]

**Criterios aplicados para esta cotización:**
- Tipo de panel: [ISODEC EPS / ISOROOF / etc.]
- Espesor: [100mm / 150mm / etc.]
- Terminación: [Blanco lisa / ...]
- Estructura: [Metal / Hormigón / ...]
- Zona y condiciones: [Zona X, altura, pendiente, etc.]
- Accesorios incluidos: [lista]

**Desglose paso a paso del presupuesto:**
1. Cálculo de superficie total: ...
2. Selección de espesor según requerimiento: ...
3. Aplicación de precio unitario vigente: ...
4. Cálculo de accesorios y flete: ...
5. Total antes de IVA: $ XXX USD
6. IVA (22%): $ XXX
7. **Total final: $ XXX USD**

El presupuesto detallado con precios unitarios, cantidades y condiciones comerciales está disponible en el siguiente enlace:

**PDF del Presupuesto:** [Link de la columna K]

¿Necesitás algún ajuste (medidas, terminación, cantidad, etc.)?
```

---

## 5. Arquitectura Técnica

### Componentes

- **Google Apps Script** (vinculado a la planilla)
  - Sidebar (HTML + JS)
  - Función principal `cotizarFilaActiva()`
- **Backend (Cloud Run)**
  - Endpoint existente: `/api/internal/presup/run`
  - Lógica del orchestrator + generación de PDF
- **Google Drive**
  - Carpeta destino para PDFs generados desde la planilla (ej: `Cotizaciones Automáticas / 2026`)

### Flujo técnico propuesto

```
Fila seleccionada en Sheets
        ↓
Apps Script lee columna I (Consulta)
        ↓
Llama a POST /api/internal/presup/run
        ↓
Orchestrator genera artifacts + PDF
        ↓
PDF se sube a Drive + se devuelve link
        ↓
Apps Script escribe:
  - Columna K ← link PDF
  - Columna J ← explicación estructurada
        ↓
(Opcional) Actualiza Estado
```

---

## 6. Pasos de implementación (faseada)

### Fase 1 — MVP (rápido)
- Crear Sidebar básico con botón "Cotizar".
- Leer fila activa + columna I.
- Llamar al endpoint del orchestrator (usando Service Account o token interno).
- Escribir el link del PDF en columna K (hardcodear o usar respuesta del orchestrator).
- Escribir texto básico en columna J.

### Fase 2 — Calidad
- Generar explicación rica y paso a paso en J (usar los artifacts del orchestrator).
- Mejorar manejo de errores.
- Agregar logging en una nueva pestaña "Log Cotizaciones Automáticas".
- Agregar columna "Fecha Cotización Automática".

### Fase 3 — Avanzado
- Integrar con el nuevo Approval Router / Hub-Tasks.
- Opción de elegir modo (Ligero / Profundo).
- Botón "Cotizar + Enviar por WhatsApp".
- Historial de versiones de presupuestos por fila.

---

## 7. Preguntas abiertas (para definir antes de programar)

1. ¿El PDF se debe generar siempre en modo **profundo** o queremos dar opción?
2. ¿Dónde guardamos los PDFs generados automáticamente? (carpeta Drive específica)
3. ¿Queremos que el botón también actualice el Estado automáticamente?
4. ¿El texto de la columna J debe ser editable después o es solo de solo lectura?
5. ¿Queremos un botón por fila (dibujo) o preferimos Sidebar?

---

## Próximos pasos recomendados

1. Definir las respuestas a las preguntas de arriba.
2. Crear el archivo de Apps Script inicial (`Code.gs` + `Sidebar.html`).
3. Instalarlo en la planilla real y probar con una fila de prueba.
4. Iterar el texto de la explicación en J según feedback.

---

**Estado actual del documento:** Diseño inicial v1 — listo para revisión y comienzo de implementación.