# Cotizar Button — Sidebar Production Proposal (v1)

**Fecha:** 2026-05-29  
**Contexto:** Decisión del usuario "a y b" sobre el preview interactivo + necesidad de pasar de mockup a implementación real en la planilla "2.0 - Administrador de Cotizaciones".  
**Referencia principal del UI objetivo:** [preview-sidebar-cotizar.html](./preview-sidebar-cotizar.html) (versión pulida post "distribuido mejor / abreviada + expandible").

---

## 1. Resumen Ejecutivo

Se propone construir el **Sidebar real** (HtmlService) para el flujo "Cotizar" usando como especificación visual y de interacción el mockup mejorado. 

**Modelo confirmado:**
- Uso exclusivo **backoffice**
- Flujo obligatorio **Borrador Automático → Revisión Humana → Aprobado Oficial** (nunca escribir directo en columna K)
- Opción **Speed Mode** (más rápido, menor costo, misma completitud de la explicación)
- Revisión humana **obligatoria** antes de cualquier PDF oficial enviado al cliente

El Sidebar será la interfaz principal para que un backoffice (ej. con fila Jonas) pueda:
1. Ver la interpretación automática del agente a partir de la columna I (Consulta).
2. Editar/corregir con **aclaraciones** en campos específicos + textarea libre.
3. Ver en tiempo real (lado a lado) la **explicación profesional para el comprador** que se escribiría.
4. Ejecutar "Re-interpretar" (llamada real al orchestrator).
5. Aprobar como Oficial (promover a columna K + estado final).

---

## 2. Principios de Diseño del Sidebar Real

- **Máxima abreviación por defecto + toda la información a un clic**: usar `<details>` + `<summary>` dinámicos que muestren los valores actuales (exactamente como en el preview pulido).
- **Retro-alimentación inmediata**: cualquier cambio en el formulario actualiza en vivo los chips de "Essentials", los textos de los summaries y la vista previa del comprador (sin esperar re-interpretar).
- **Aclaraciones del vendedor como ciudadano de primera clase**: textarea prominente + historial simple.
- **Vista previa del comprador colapsable**: permite dar foco total al formulario cuando se necesita o ver el texto lado a lado.
- **Speed Mode claramente visible** pero secundario (por defecto Normal).
- **Acciones principales sticky** (Re-interpretar + toggle preview) para que nunca se pierdan al scrollear.

El preview HTML actual es la **especificación viva** de cómo debe verse y comportarse el Sidebar.html final.

---

## 3. Modelo de Datos y Columnas (consolidado)

Usar exactamente las columnas definidas en `COTIZAR-BUTTON-STATES-AND-COLUMNS.md`:

**Columnas de Borrador (temporales, agregar al final):**
- `Borrador PDF` (URL)
- `Borrador Explicación` (texto largo / Markdown)
- `Fecha Borrador`
- `Generado Por` (email del usuario de Google que apretó el botón)
- `Modo` (Normal / Speed)
- `Duración (seg)` (opcional)

**Columnas de Revisión / Oficialización:**
- `Revisado Por`
- `Fecha Revisión`
- `Comentario de Revisión`
- Columna K (Link Presupuesto) → **solo se escribe aquí al aprobar como Oficial**

**Estado (columna C o equivalente):**
- "Borrador Automático"
- "En Revisión" (opcional)
- "Aprobado Oficial"
- "Rechazado"

Nunca se toca K ni se marca "Enviado" automáticamente.

---

## 4. Arquitectura Técnica

### 4.1 Componentes

| Componente              | Responsabilidad principal                                                                 | Restricciones Apps Script |
|-------------------------|-------------------------------------------------------------------------------------------|---------------------------|
| `Code.gs`               | Menú, abrir Sidebar, leer/escribir sheet, llamar orchestrator, logging, manejo de errores | 30s timeout por ejecución, sin fetch nativo fácil a endpoints privados |
| `Sidebar.html`          | UI completa (copia fiel del preview pulido + bindings reales)                             | HtmlService limitations (sin módulos externos, CSS/JS inline o <script> en el template) |
| `presupOrchestrator`    | (ya existe) Intake + Pricing + PDF + Drive upload + artifacts                             | Expuesto vía `/api/internal/presup/run` |
| Logging                 | Pestaña nueva "Log Cotizaciones" + (ideal) requestId del backend                          | Simple sheet append + console |

### 4.2 Flujo de llamada al Orchestrator (recomendado)

Opción recomendada para Fase 1 (evitar problemas de timeout):

1. Sidebar llama a una función en Code.gs.
2. Code.gs hace un `UrlFetchApp.fetch` al endpoint público o interno con autenticación (Service Account JWT corto o API Key interna dedicada).
3. El body incluye:
   ```json
   {
     "channel": "sheet-admin-cotizar",
     "consulta": "texto exacto de columna I",
     "aclaraciones": "texto del textarea + campos estructurados serializados",
     "mode": "profundo" | "ligero",
     "contexto_adicional": {
       "zona": "...",
       "fila_origen": 13,
       "wbk_id": "..."   // si existe
     }
   }
   ```
4. El orchestrator devuelve (idealmente enriquecido):
   - `pdfLink` (Drive shareable)
   - `explicacion_borrador` (o artifacts suficientes para generarla en el cliente o en el backend)
   - `total_estimado`
   - `trace_id` / `requestId` para logging
   - `gates` (para mostrar si hubo ajustes automáticos)

**Problema conocido de timeout (30s Apps Script):**  
Si el flujo completo (orchestrator + PDF con Puppeteer) puede pasar de 25-30s, usar patrón:
- Inmediato: escribir "Procesando..." en una columna temporal de estado.
- Usar `ScriptApp.newTrigger` o guardar la tarea en una hoja de "Cola Cotizaciones" y tener un trigger por minuto que procese la cola (o simplemente pedir al usuario que espere y refresque).
- Alternativa futura: endpoint que devuelva rápido el jobId y el Sidebar haga polling simple (con límite).

Para MVP: asumir que en la mayoría de casos el flujo cabe en el timeout y mostrar loading claro. Documentar el workaround si falla.

### 4.3 Estructura recomendada del Sidebar.html final

Replicar fielmente el preview pulido:
- Header fijo con ícono + "Cotizar - Fila X (Cliente)"
- Row info compacta
- Essentials chips bar (siempre visible, actualizado por JS)
- Sección "Aclaraciones del vendedor" (textarea grande + dirty state)
- 5-6 `<details>` (solo el primero abierto por defecto; summaries 100% dinámicos vía JS)
- Main actions sticky con "Re-interpretar..." + "Ocultar/Mostrar vista previa"
- Panel derecho `.buyer-preview` colapsable (clase `collapsed` + toggle)
- Estados (divs con hidden) para: inicial → after-first → loading → after-reinterpret + historial
- Todo el JS necesario para:
  - `getFormState()`
  - `rebuildEssentialsAndSummaries()` (llamado en todo input/change)
  - `updateBuyerPreviewLive()` (usa la plantilla exacta profesional)
  - `simulateReinterpretar()` → reemplazar por llamada real vía `google.script.run`

El archivo actual del preview sirve como **single source of truth** para HTML structure + CSS + comportamiento esperado.

---

## 5. Integración con el Orchestrator y Generación de Explicación

Dos caminos posibles (elegir uno claro):

**Opción recomendada (Fase 1):** El backend (orchestrator) recibe las aclaraciones y genera también la explicación final lista para la columna (usando el template aprobado en `COTIZAR-BUTTON-BORRADOR-EXPLICACION.md`). Devuelve `explicacion_borrador` + `pdf_link`.

**Opción alternativa:** El Sidebar genera la explicación en el cliente a partir de los artifacts (más frágil, menos consistente).

Se recomienda la primera (el backend ya tiene todos los artifacts del flow).

Actualizar ligeramente el orchestrator (si hace falta) para aceptar `aclaraciones` y `contexto_adicional` y exponer un campo rico para la explicación del comprador.

---

## 6. Seguridad, Costos y Control

- Autenticación: Service Account con scopes limitados (Sheets + Drive) + API Key o JWT corto para el backend.
- Rate limiting: máximo N cotizaciones por usuario/día desde la planilla (registrar en log).
- Costo: Speed Mode = `mode: ligero` → usar para casos urgentes.
- Trazabilidad: toda ejecución queda en:
  - Hoja "Log Cotizaciones Automáticas" (fecha, usuario, fila, modo, duración, traceId, resultado)
  - Posiblemente hub-tasks futuro.

---

## 7. Hoja de Log Recomendada

Nueva pestaña en la misma planilla:
Columnas: Timestamp | Usuario | Fila | WBK-ID (si existe) | Modo | Duración | PDF Borrador | Resultado | TraceId | Comentario

Esto permite auditoría y detección de problemas rápidamente.

---

## 8. Roadmap de Implementación (Fases Atómicas)

### Fase 0 — Preparación (1-2 días)
- Agregar las columnas temporales de borrador a la planilla real (siguiendo el documento de estados).
- Crear carpeta Drive "Borradores Automáticos - Cotizaciones 2.0".
- Definir Service Account / credenciales y endpoint estable.
- Actualizar `COTIZAR-BUTTON-STATES-AND-COLUMNS.md` con letras de columna reales una vez agregadas.

### Fase 1 — MVP Funcional (Sidebar + Llamada Real)
- Reemplazar `Code.gs` + `Sidebar.html` por versiones que repliquen el preview pulido.
- Implementar `getActiveRowInfo()`, `cotizarFilaActiva()` (con aclaraciones).
- Llamada real al orchestrator + escritura en columnas temporales + cambio de Estado.
- Vista previa del comprador generada en vivo (incluso antes del re-interpretar).
- Logging básico.
- Pruebas intensivas con fila 13 (Jonas) y 4-5 filas más reales.

**Criterio de salida:** Un backoffice puede generar un borrador correcto, ver la explicación, y tener el PDF en la columna de borrador sin romper nada existente.

### Fase 2 — Flujo de Aprobación + Calidad
- Botón "Aprobar como Oficial" completo (promueve PDF a carpeta oficial, escribe K, registra revisor, cambia estado).
- Mejor manejo de errores y timeouts.
- Historial de interpretaciones dentro del Sidebar.
- Speed Mode completamente cableado (pasa `mode: ligero`).

### Fase 3 — Pulido y Operación
- Validaciones previas (longitud mínima de Consulta, no permitir si ya está Aprobado Oficial).
- Rate limiting + métricas simples.
- Posible botón "Cotizar + Enviar WhatsApp" (futuro).
- Integración más profunda con Approval Router / hub-tasks cuando la infraestructura lo permita.

---

## 9. Riesgos y Mitigaciones

- **Timeout de Apps Script en flujos largos** → Patrón de cola + trigger o mensaje claro "Procesando (puede tardar 1-2 min)".
- **Inconsistencia entre lo que muestra el preview y lo que genera el PDF** → Hacer que el backend devuelva también la explicación (única fuente de verdad).
- **Costo descontrolado** → Rate limit por usuario + default a Normal + logging visible de costo aproximado.
- **Adopción** → Empezar con 3-4 usuarios de backoffice, training corto + botón de "Reportar problema" dentro del Sidebar.

---

## 10. Próximos Pasos Inmediatos (después de aprobar este documento)

1. Revisar y aprobar este proposal + el preview HTML final.
2. Agregar las columnas de borrador a la planilla real (con los nombres exactos).
3. Crear la carpeta de Drive.
4. Actualizar CONFIG del Code.gs con URLs y carpeta reales.
5. Implementar Fase 1 (empezando por un Sidebar.html que sea casi 1:1 del preview pulido, pero con `google.script.run` reales).
6. Primera prueba end-to-end con fila real (Jonas u otra).

---

**Estado de este documento:** Propuesta lista para revisión y aprobación.

Una vez aprobado, se puede pasar directamente a codificar el primer archivo real (`Sidebar.html` + actualizaciones de `Code.gs`) siguiendo esta guía y usando el preview como referencia visual y de interacción.

---

*Documento generado como parte del trabajo "a y b" (mejora del preview + propuesta de desarrollo).*