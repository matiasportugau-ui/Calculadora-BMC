# Mercado Libre — Base de conocimiento y reglas de respuesta (BMC Uruguay)

**Audiencia:** agentes humanos, PANELSIM, futuros asistentes. **Hub del sistema de entrenamiento + captura de corpus:** [`ML-TRAINING-SYSTEM.md`](./ML-TRAINING-SYSTEM.md).  
**Fuente empírica:** análisis del corpus **`/questions/search`** vía API local (`GET /ml/questions`), **484** preguntas; **473** respuestas publicadas con texto (**~98%** del corpus).  
**Fecha análisis:** 2026-03-24 (entorno local; reproducir con paginación `limit`/`offset`).

Este documento **no** sustituye políticas oficiales de Mercado Libre; las secciones “ML — buenas prácticas” son criterios operativos alineados con documentación pública y con el comportamiento que ya mostráis en historial.

**Alineación PANELSIM (Cursor):** tono, datos antes de cotizar formal, guardrails y mapeo “instrucciones GPT → fuentes del repo” están en [`PANELSIM-DIALOGUE-AND-CRITERIA.md`](./PANELSIM-DIALOGUE-AND-CRITERIA.md). Material gráfico de producto (flyers/fichas) se indexa en [`../biblioteca-tecnica-productos/README.md`](../biblioteca-tecnica-productos/README.md); **no** usar imágenes como fuente de precio (MATRIZ/API/`/ml/items/:id`).

---

## 1. Resumen cuantitativo del estilo BMC (lo que ya entrenan con las respuestas humanas)

| Métrica | Valor | Lectura |
|--------|-------|---------|
| Respuestas con saludo tipo “Hola / Buenas / Buenos días…” | **~68%** | Saludo explícito es norma frecuente, no obligatoria en mensajes ultra cortos. |
| Cierre con marca (“Saludos… BMC Uruguay”, “Atentamente…”) o frases equivalentes | **~78%** | Identidad de marca al cierre es **muy habitual**. |
| “Hola + nombre propio” al inicio | **~53%** | Personalización frecuente cuando el contexto lo permite. |
| Mención explícita de precio (U$S / montos) | **~40%** | Muchas respuestas son aclaratorias sin precio; cuando hay cotización, casi siempre hay monto. |
| Texto con “IVA inc” / equivalente | **~46%** de respuestas | Regla fuerte cuando se cotiza: **precio con IVA incluido**. |
| Respuestas que incluyen **al menos una pregunta** (`?`) | **~16%** | Pedir aclaraciones es **minoritario pero estable**: se usa cuando faltan medidas o tipo de obra. |
| Longitud típica | **~64 palabras** (mediana similar) | Respuestas completas; las cortas existen (“Hola sí vendemos…”). |
| Frase “Por cualquier otra consulta…” (o variante) | **~35%** | CTA estándar de cierre. |
| “no dudes en contact(arnos/ar)” | **~24%** | Tono cercano, invitación a seguir el canal. |
| “presupuesto detallado / personalizado” | **~36%** | Puente hacia cotización formal sin cerrar en ML. |
| Formas de **tratamiento formal** (le/su/podría…) | **~43%** | Conviven con frases coloquiales (“no dudes”); el tono global es **profesional y cordial**. |
| Aviso **no incluye traslado/flete** (cuando aplica) | pocas pero **explícitas** | Cuando cotizan obra, a veces aclaran exclusiones. |
| Aviso **no incluye instalación** | **~7%** | Coherente con “no hacemos instalaciones” en muestras largas. |

**Intención aproximada del comprador** (palabras clave en la pregunta, una sola etiqueta por hilo — sesgo hacia “otro”):

| Intención | ~Cantidad de hilos |
|-----------|---------------------|
| Precio / cotización | 179 |
| Medidas / dimensiones | 80 |
| Otro | 100 |
| Envío / flete / entrega | 51 |
| Material / producto | 33 |
| Stock / disponibilidad | 18 |
| Instalación | 15 |

---

## 2. Voz BMC (cómo suenan ya las respuestas)

1. **Marca:** firmar como **BMC Uruguay** (mayúsculas/minúsculas variables en histórico; unificar en **“BMC Uruguay”** salvo que el canal impida firma larga).  
2. **Tono:** cordial, respetuoso, **español rioplatense** mezclado con registro de negocio (“le comentamos”, “no dudes en consultarnos”).  
3. **Honestidad operativa:** si falta información para cotizar, **preguntar** (largo, ancho, ciudad, tipo de estructura, aguas del techo, etc.) en lugar de inventar.  
4. **Precios:** cuando se da monto, usar **U$S** (como en histórico) y, si corresponde, **IVA inc**.  
5. **Alcance del presupuesto:** cuando se cotiza paquete (paneles + accesorios), indicar **qué incluye** y, si aplica, **qué no** (traslado, instalación).  
6. **Puente a presupuesto detallado:** invitar a “presupuesto detallado / personalizado” y a seguir en el mismo canal de preguntas sin prometer plazos irreales.  
7. **Brevedad permitida:** respuestas de una línea solo cuando la pregunta es binaria (“¿tienen color X?”).

---

## 3. Plantilla de respuesta (orden recomendado)

Usar como **guía**, no como texto fijo.

1. **Saludo + (opcional) nombre** si está claro en el hilo.  
2. **Reconocimiento** de la consulta (“Recibimos tu consulta…”, “Gracias por escribirnos…”).  
3. **Respuesta directa** o **lista de aclaraciones necesarias** (si no alcanza datos).  
4. **Cotización (si aplica):** ítems principales + total **U$S … IVA inc** + exclusiones.  
5. **CTA:** “Por cualquier otra consulta…” / “Para presupuesto detallado…” / “Estamos a las órdenes”.  
6. **Cierre:** “Saludos, BMC Uruguay” o “Atentamente BMC Uruguay”.

**Anti‑patrones** detectados a evitar en el futuro:

- Ortografía muy suelta en mensajes largos (el histórico tiene typos puntuales; el estándar objetivo es **corregir antes de enviar**).  
- Contradicciones entre hilos sobre inclusiones (flete/instalación); usar **lista corta de exclusiones** cuando se cotiza.

---

## 4. Reglas de negocio para contestar (alineadas al historial)

| Situación | Regla |
|-----------|--------|
| Solo “¿Cuánto sale?” sin medidas | Pedir **largo, ancho, ubicación**, tipo de solución (techo/pared/cámara), y si hay **estructura** para fijar. |
| Techo a dos aguas | Aclarar cómo se distribuyen **largo vs ancho** y dónde va la **cumbrera** (como ya hacen en hilos reales). |
| Cotización numérica | Incluir **moneda + IVA inc** cuando el precio es al público con IVA; listar **componentes** principales (paneles, cumbrera, goteros, siliconas, fijaciones… según caso). |
| Flete | Si no está incluido, decirlo; ofrecer que **se puede cotizar aparte** si es política vigente. |
| Instalación | Si no hacen instalación, **decirlo claro** cuando el cliente lo insinúa o al cotizar obra. |
| Stock / color | Respuesta corta afirmativa/negativa + invitación a consultar detalle. |
| Pregunta fuera de alcance / muy genérica | Responder lo posible + **preguntas de calificación** mínimas. |

**Datos que no deben inventarse:** medidas, espesores, precios, plazos de entrega, disponibilidad exacta. Usar **calculadora / MATRIZ / API** cuando PANELSIM u operador tengan acceso; si no hay acceso, **no afirmar cifras**.

---

## 5. Mercado Libre — buenas prácticas (operativas)

1. **Tiempo de respuesta:** priorizar preguntas **sin responder**; el historial muestra uso ocasional de mensajes tipo “dejamos respondida para no afectar reputación” — usar **con criterio** y solo si la política interna lo permite (evitar respuestas vacías o engañosas).  
2. **Claridad:** un mensaje = una idea principal + detalles; listas cortas si hay muchos ítems.  
3. **No pedir datos sensibles** fuera de lo que ML permite en mensajería; respetar **Términos y políticas** vigentes del marketplace.  
4. **Seguimiento:** si la cotización quedó pendiente en otro hilo, enlazar el hilo mentalmente (“como te comentamos en la consulta anterior…”).  
5. **Reputación:** responder siempre que haya **contenido útil**; evitar spam de firmas repetidas en el mismo hilo.  
6. **No compartir** canales externos si ML restringe (teléfono, WhatsApp, email) según reglas del sitio — verificar política actual antes de incluirlos en plantillas.

---

## 6. Sistema de entrenamiento sugerido (humanos + asistente)

### 6.1 Nivel 1 — Onboarding (1–2 h)

- Leer este KB + `docs/team/knowledge/Calc.md` (IVA, trazabilidad, no inventar).  
- Ver 5 respuestas **largas** y 5 **cortas** del corpus real (export desde API o CRM).  
- Practicar: transformar 3 preguntas reales en **borrador** usando la plantilla §3.

### 6.2 Nivel 2 — Cotización

- Práctica con **techo 1 agua / 2 aguas** + pedido de aclaraciones.  
- Práctica **U$S + IVA inc + exclusiones**.  
- Revisión cruzada: otro agente marca incoherencias.

### 6.3 Nivel 3 — ML + marca

- Simulacro: 10 preguntas mezcladas (precio, envío, instalación, color).  
- Criterio de aprobación: **checklist §7** sin ítems fallidos.

### 6.4 Para modelo / PANELSIM (RAG + reglas)

- **Corpus:** mantener export periódico de Q&A (sin datos personales innecesarios).  
- **System prompt:** incrustar §2–§4 y checklist §7.  
- **Tooling:** solo cotizar con `/calc/*` o MATRIZ verificada; ML solo `GET` hasta aprobación humana para `POST /ml/questions/:id/answer`.

---

## 7. Checklist antes de publicar respuesta en ML

- [ ] ¿Responde exactamente lo que preguntó el comprador o pide solo los datos mínimos que faltan?  
- [ ] Si hay precio: ¿**U$S** (o moneda correcta) y **IVA inc** si corresponde?  
- [ ] ¿Quedó claro **qué incluye** y **qué no** (flete, instalación)?  
- [ ] ¿Tono **cordial + profesional** y firma **BMC Uruguay**?  
- [ ] ¿Sin prometer plazos o stock sin verificación?  
- [ ] ¿Ortografía y puntuación revisadas?  
- [ ] ¿Modo PANELSIM? → no enviar `POST` sin OK de Matias si está en **aprobación**.

---

## 8. Mantenimiento del KB

- **Trimestral:** re-correr script de export total y actualizar §1 (tasas y conteos).  
- **Tras cambios de precios o política comercial:** actualizar §4 y ejemplos internos.  
- **Responsable sugerido:** rol Integrations + SIM-REV en full team run.

---

## 9. Reproducibilidad técnica (desarrollo)

Desde la raíz del repo, con API en `:3001` y OAuth OK:

```bash
# Paginar hasta agotar (ejemplo conceptual; ajustar offset en bucle)
curl -sS "http://127.0.0.1:3001/ml/questions?limit=50&offset=0"
```

Los parámetros válidos están acotados en `server/index.js` (`seller_id`, `limit`, `offset`, `status`, `site_id`, `api_version`).

---

## 10. Mejora continua por tandas (simulación en ciego)

Para iterar **cada 10 consultas** —respuesta modelo/KB sin ver primero la humana, luego comparación y mejoras— seguir el proceso en [`../reports/ML-SIM-ITERATIVE-BLIND-IMPROVEMENT.md`](../reports/ML-SIM-ITERATIVE-BLIND-IMPROVEMENT.md) y exportar tandas con `npm run ml:sim-batch` (ver ese doc §5).

**Auditoría automática (corpus completo + órdenes + informe IA):** `npm run ml:ai-audit` — descarga todas las preguntas y órdenes, agrega métricas y genera `docs/team/panelsim/reports/ML-AI-AUDIT-REPORT-*.md` (ver `AGENTS.md`). `--dry-run` solo escribe JSON agregado.

---

## 11. De borradores corregidos a Panelin (training-kb)

Cuando cerrás una tanda de preguntas ML (borrador IA + texto final aprobado para publicar):

1. **Registrar el par gold** en [`../reports/ml-gold-runs/`](../reports/ml-gold-runs/) (archivo tipo `ML-GOLD-CANDIDATES-*.md`): columna **Respuesta gold (humana)** = texto que publicás o aprobarías en ML (alineado a §3 y checklist §7).
2. **Cargar en el KB de entrenamiento de Panelin** (modo desarrollador en la app o API), con `API_AUTH_TOKEN` en `.env`:
   - **CLI desde el repo:** `npm run panelin:train:import -- --file <lote.json>` (API en `:3001` o `BMC_API_BASE=…` para Cloud Run). Ver [`../reports/ml-gold-runs/README.md`](../reports/ml-gold-runs/README.md).
   - O `POST /api/agent/train` con header `Authorization: Bearer <API_AUTH_TOKEN>`.
   - Cuerpo JSON sugerido:
     - `category`: `sales` o `mercadolibre` (en código, `mercadolibre` se normaliza a `sales`).
     - `question`: texto del comprador (opcional prefijo `Canal: Mercado Libre — `).
     - `goodAnswer`: respuesta final humana (no el borrador IA si difiere).
     - `badAnswer`: (opcional) borrador IA o texto descartado, para contraste en entrenamiento.
     - `context`: `Canal: Mercado Libre | Q:<id> | item:<MLU…>` — ayuda al match en `GET /api/agent/training-kb/match`.
     - `permanent`: `true` si querés prioridad alta en el scoring de ejemplos.
3. **`data/training-kb.json`** está en `.gitignore`: cada máquina acumula ejemplos locales; para otro entorno repetí el POST o mové el JSON con cuidado (sin PII innecesaria).

La **respuesta “especial” ML** es la ya definida en **§2–§7** (voz BMC, plantilla §3, checklist §7, buenas prácticas §5). El asistente Panelin recibe además reglas explícitas en `server/lib/chatPrompts.js` (WORKFLOW → Mercado Libre).

---

*Documento generado a partir del análisis estadístico del corpus local; las respuestas individuales no se reproducen aquí íntegras para evitar duplicar contenido privado del marketplace en documentación.*
