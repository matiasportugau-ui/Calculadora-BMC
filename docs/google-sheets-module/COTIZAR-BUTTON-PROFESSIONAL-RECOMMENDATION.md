# Recomendación Profesional: Botón "Cotizar" en el Administrador de Cotizaciones 2.0

**Fecha:** 2026-05-29  
**Autor:** Análisis basado en estado actual del sistema BMC  
**Alcance:** Planilla "2.0 - Administrador de Cotizaciones" (ID: `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0`)

---

## 1. Resumen Ejecutivo

Se propone implementar un botón **"Cotizar"** que permita, desde una fila de la planilla operativa, generar automáticamente un presupuesto usando el nuevo `presupOrchestrator`, guardar el PDF y escribir una explicación profesional para el cliente.

**Conclusión principal:**  
**No se recomienda** una solución completamente automática y síncrona en esta etapa. Se recomienda un modelo **híbrido con revisión humana** + arquitectura asíncrona.

---

## 2. Diagnóstico del Estado Actual

### Fortalezas
- Existe un `presupOrchestrator` maduro con gates de calidad (Pricing Reviewer + Document Gatekeeper).
- Hay un endpoint interno diseñado para uso por scripts (`/api/internal/presup/run`).
- El sistema de generación de PDF server-side es sólido (`/api/pdf/generate` con Puppeteer).
- La planilla ya tiene integración vía Service Account.
- Hay cultura de trazabilidad (WBK- IDs, columnas de estado).

### Debilidades / Riesgos Actuales
- La columna **"Consulta"** es texto libre de muy variable calidad.
- No existe revisión humana obligatoria antes de generar un PDF oficial.
- El orchestrator actual **no devuelve un PDF listo** como output principal (es un paso separado).
- El volumen de filas es significativo y muchas están en estados intermedios ("Pendiente", "Asignado").
- No existe logging/auditoría de cotizaciones generadas automáticamente.
- Riesgo alto de **costos descontrolados** si se permite cotizar cualquier fila sin filtros.
- Riesgo reputacional: enviar presupuestos automáticos de baja calidad.

---

## 3. Opciones de Arquitectura (evaluadas)

| Opción | Sincronía | Revisión Humana | Complejidad | Riesgo | Recomendación |
|--------|-----------|------------------|-------------|--------|---------------|
| **A. Botón síncrono directo** | Síncrona | Ninguna | Baja | **Muy Alto** | No recomendada |
| **B. Botón + revisión manual obligatoria** | Síncrona + paso manual | Obligatoria | Media | Medio | **Recomendada para Fase 1** |
| **C. Sistema de jobs asíncronos + cola** | Asíncrona | Configurable | Alta | Bajo | Ideal a mediano plazo |
| **D. Híbrido (Sidebar + cola ligera)** | Mixto | Configurable | Media-Alta | Bajo-Medio | **Recomendación profesional** |

**Recomendación fuerte: Opción D (Híbrido)**

---

## 4. Recomendación Profesional (Modelo Recomendado)

### 4.1 Principios de Diseño

1. **Nunca enviar un PDF al cliente sin revisión humana** (al menos en los primeros 6-12 meses).
2. **Separar claramente** "Borrador generado automáticamente" de "Presupuesto oficial enviado".
3. **Trazabilidad total**: toda cotización automática debe quedar registrada.
4. **Costo controlado**: limitar la cantidad de ejecuciones por usuario/día.
5. **Calidad de entrada**: no permitir cotizar filas con consultas muy pobres.

### 4.2 Arquitectura Propuesta (Fase 1 + Fase 2)

#### Fase 1 (MVP - 3-4 semanas)
- Sidebar en la planilla con botón **"Generar Borrador Automático"**.
- El sistema ejecuta el orchestrator en modo `profundo`.
- Guarda:
  - Link al PDF en una **nueva columna** (ej: "Borrador PDF" - columna temporal).
  - Explicación generada en otra columna temporal o en J con prefijo `[BORRADOR AUTO]`.
- Cambia el Estado a "Borrador Automático - Pendiente Revisión".
- **No toca** la columna K (Link Presupuesto oficial) todavía.

#### Fase 2 (Madurez)
- Botón adicional: **"Aprobar y Enviar como Oficial"** (solo visible en filas en estado de borrador).
- Al aprobar:
  - Copia el PDF a la carpeta oficial.
  - Escribe el link definitivo en columna **K**.
  - Limpia o marca el borrador.
  - Actualiza Estado a "Cotizado - Enviado".
- Logging completo en una pestaña "Historial Cotizaciones Automáticas".

### 4.3 Componentes Técnicos Recomendados

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| Interfaz de usuario | Google Apps Script + Sidebar (HtmlService) | Mejor UX que botones por fila. Fácil de evolucionar. |
| Orquestación de jobs | Apps Script + Cloud Run (actual) | Por ahora suficiente. Futuro: Cloud Tasks / Pub/Sub. |
| Autenticación | Service Account + JWT corto o API Key interno | El endpoint interno ya está pensado para esto. |
| Almacenamiento de PDFs | Google Drive (carpeta separada "Borradores Automáticos") | Fácil control de permisos. |
| Logging / Auditoría | Nueva pestaña en la misma planilla + logs en Cloud Run | Trazabilidad completa. |
| Control de calidad | Reglas antes de ejecutar (mínimo de caracteres en Consulta, etc.) | Evita basura. |

---

## 5. Riesgos Críticos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación Recomendada |
|--------|--------------|---------|------------------------|
| Presupuestos de baja calidad enviados a clientes | Alta | Alto | Revisión humana obligatoria + marca clara de "Borrador Automático" |
| Costos excesivos de LLM | Media | Medio | Rate limiting por usuario + modo "Ligero" por defecto |
| Tiempo de ejecución largo (timeout en Apps Script) | Media | Medio | Hacer el proceso asíncrono desde el día 1 |
| Datos inconsistentes entre sheet y backend | Media | Medio | Usar el WBK-ID como llave canónica |
| Dependencia de un solo endpoint interno | Baja | Alto | Versionar el endpoint y tener fallback |

---

## 6. Plan de Implementación Recomendado (Fases)

### Fase 0 – Fundación (1 semana)
- Documentar exhaustivamente el estado actual de la planilla y columnas.
- Definir claramente qué columnas serán "oficiales" vs "temporales de automatización".
- Crear carpeta en Drive para borradores automáticos.

### Fase 1 – MVP Controlado (3-4 semanas)
- Implementar Sidebar + botón "Generar Borrador".
- Llamada al orchestrator.
- Escritura en columnas temporales + cambio de estado.
- Logging básico.
- Pruebas intensivas con 20-30 filas reales.

### Fase 2 – Madurez Operativa (4-6 semanas)
- Flujo de aprobación ("Aprobar como Oficial").
- Mejor generación de explicación en J (usar artifacts del orchestrator).
- Rate limiting y controles de costo.
- Métricas (cuántos borradores se generan vs se aprueban).

### Fase 3 – Escalabilidad (futuro)
- Cola de jobs real (Cloud Tasks o similar).
- Integración nativa con Hub-Tasks / Approval Router.
- Posibilidad de "Cotizar + Enviar por WhatsApp" en un solo flujo.

---

## 7. Recomendaciones Específicas de Diseño

1. **No uses la columna K** para el primer borrador. Crea columnas temporales primero (`Borrador PDF`, `Borrador Explicación`).
2. **Prefija siempre** el texto automático en J con `[GENERADO AUTOMÁTICAMENTE - REVISAR]`.
3. **Modo por defecto**: "Ligero" para el botón (más barato y rápido). Ofrecer "Profundo" como opción avanzada.
4. **Validación previa**: No permitir cotizar si la columna Consulta tiene menos de X caracteres o contiene solo emojis/texto muy corto.
5. **Trazabilidad**: Guardar en el log quién apretó el botón y cuándo.

---

## 8. Decisiones Tomadas (2026-05-29)

Durante la sesión de definición, el usuario confirmó los siguientes puntos clave:

| Pregunta | Decisión |
|----------|----------|
| ¿Quiénes van a usar el botón "Cotizar"? | **Solo Backoffice** |
| ¿Modelo Borrador → Revisión Humana → Oficial? | **Sí** (obligatorio en la primera etapa) |
| ¿Velocidad vs Seguridad? | Priorizar **más lento pero más seguro/controlado**, con opción de activar **Speed Mode** |

Estas decisiones cambian significativamente el diseño:

- El botón será de uso **interno/backoffice** (no para vendedores en campo).
- El flujo debe ser explícitamente de **dos pasos**: Generar Borrador + Aprobar como Oficial.
- Se implementará un **Speed Mode** (probablemente usando `mode: "ligero"` + menos gates) como opción avanzada, pero el modo por defecto será el más controlado.

---

## 9. Conclusión Actualizada y Próximos Pasos

Con las decisiones confirmadas, el enfoque recomendado es:

> Implementar un sistema de **"Generación de Borradores Controlados"** exclusivo para backoffice, con revisión humana obligatoria y un Speed Mode opcional para casos urgentes.

**Próximos pasos recomendados (orden sugerido):**

1. **Definir el modelo de estados** exacto para las filas (Borrador Automático, En Revisión, Aprobado Oficial, etc.).
2. **Diseñar las columnas temporales** que se van a usar (Borrador PDF, Borrador Explicación, Fecha Generación Automática, Generado Por, etc.).
3. **Diseñar el comportamiento del Speed Mode** (qué sacrifica y qué no).
4. **Empezar la implementación de Fase 1** (Sidebar + botón "Generar Borrador" + logging).
5. Definir el flujo de "Aprobar como Oficial".

---

¿Querés que ahora desarrolle en detalle alguno de estos puntos?

Opciones concretas:

- **A.** Definir el esquema completo de estados + columnas nuevas (recomendado empezar por acá).
- **B.** Diseñar cómo funcionaría el "Speed Mode" (qué cambia respecto al modo normal).
- **C.** Empezar directamente a escribir el código del Apps Script + Sidebar adaptado a estas decisiones.
- **D.** Otra prioridad que tengas.

Decime cómo seguimos.