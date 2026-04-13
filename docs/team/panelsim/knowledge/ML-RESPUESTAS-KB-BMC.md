# Mercado Libre — Base de conocimiento y reglas de respuesta (BMC Uruguay)

**Audiencia:** agentes humanos, PANELSIM, futuros asistentes. **Hub del sistema de entrenamiento + captura de corpus:** `[ML-TRAINING-SYSTEM.md](./ML-TRAINING-SYSTEM.md)`.  
**Fuente empírica:** análisis del corpus `**/questions/search`** vía API local (`GET /ml/questions`). **Última corrida completa:** **520** preguntas exportadas; **505** con **texto de respuesta** publicado (**~97%**); **15** sin texto de respuesta en el export (incluye `BANNED` con texto vacío y casos ML sin `answer.text` aunque el estado figure contestado).  
**Fecha análisis canónico KB:** **2026-04-13** (export `ML-CORPUS-FULL-2026-04-13T18-22-50.json` en `[../reports/ml-corpus/exports/](../reports/ml-corpus/exports/)`; reproducir con `npm run ml:corpus-export`). Histórico previo en esta misma sección: 2026-03-24 (**484** preguntas / **473** con respuesta).

Este documento **no** sustituye políticas oficiales de Mercado Libre; las secciones “ML — buenas prácticas” son criterios operativos alineados con documentación pública y con el comportamiento que ya mostráis en historial.

**Alineación PANELSIM (Cursor):** tono, datos antes de cotizar formal, guardrails y mapeo “instrucciones GPT → fuentes del repo” están en `[PANELSIM-DIALOGUE-AND-CRITERIA.md](./PANELSIM-DIALOGUE-AND-CRITERIA.md)`. Material gráfico de producto (flyers/fichas) se indexa en `[../biblioteca-tecnica-productos/README.md](../biblioteca-tecnica-productos/README.md)`; **no** usar imágenes como fuente de precio (MATRIZ/API/`/ml/items/:id`).

---

## 1. Resumen cuantitativo del estilo BMC (lo que ya entrenan con las respuestas humanas)

Las tasas **2026-04-13** se calculan con **expresiones regulares** sobre el texto de **505** respuestas con cuerpo (misma metodología que el barrido 2026-03-24; los porcentajes pueden moverse unos puntos si se afina el detector o el corpus).


| Métrica                                                          | Valor **2026-04-13**                   | Valor ref. **2026-03-24** | Lectura                                                                                                                     |
| ---------------------------------------------------------------- | -------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Respuestas con saludo tipo “Hola / Buenas / Buenos días…”        | **~66%**                               | ~68%                      | Saludo explícito sigue siendo norma; no obligatorio en mensajes ultra cortos.                                               |
| Cierre con marca (“… BMC Uruguay”, “Atentamente…”) o equivalente | **~75%**                               | ~78%                      | Firma / marca al cierre **muy habitual**.                                                                                   |
| “Hola + nombre propio” al inicio                                 | *(no medido en 04-13; regex estricta)* | ~53%                      | Mantener criterio: personalizar cuando el nombre venga claro en ML.                                                         |
| Mención explícita de precio (U$S / montos)                       | **~72%**                               | ~40%                      | El detector 04-13 es **más amplio** (capta números de medidas también); tomar como “menciona cifras” más que “solo precio”. |
| Texto con “IVA inc” / equivalente                                | **~43%**                               | ~46%                      | Cuando se cotiza: **IVA incluido** sigue siendo regla fuerte.                                                               |
| Respuestas con **al menos una** `?`                              | **~16%**                               | ~16%                      | Pedir datos mínimos **sigue estable**.                                                                                      |
| Longitud típica                                                  | **~62 palabras** (mediana)             | ~64                       | Respuestas completas; existen respuestas de una línea.                                                                      |
| “Por cualquier otra consulta…” (o variante)                      | **~32%**                               | ~35%                      | CTA de cierre frecuente.                                                                                                    |
| “no dudes en contact…”                                           | **~44%**                               | ~24%                      | Ojo: patrón regex más amplio en 04-13; seguir priorizando tono **cordial** sin forzar frase hecha.                          |
| “presupuesto detallado / personalizado”                          | **~53%**                               | ~36%                      | Puente a cotización formal muy presente en el corpus nuevo.                                                                 |
| Tratamiento formal (le / su / podría…)                           | **~37%**                               | ~43%                      | Convive con lenguaje directo de marketplace.                                                                                |
| Aviso **no incluye instalación**                                 | **~22%**                               | ~7%                       | Detector 04-13 más sensible; **sí** reforzar instalación cuando el cliente lo insinúe.                                      |
| Aviso **no incluye flete/traslado**                              | **~2%** (muestra)                      | pocas                     | Cuando cotizás paquete, **sí** explicitar flete si no va incluido (regla §4).                                               |


**Intención aproximada del comprador** (palabras clave en la **pregunta**, una etiqueta por hilo — orden de reglas fijas; sesgo hacia “otro”). Corpus **520** hilos, **2026-04-13**:


| Intención                                            | Cantidad de hilos |
| ---------------------------------------------------- | ----------------- |
| Precio / cotización                                  | 199               |
| Medidas / obra (dimensiones, techo, pared, espesor…) | 139               |
| Otro                                                 | 102               |
| Envío / flete / entrega / zona                       | 34                |
| Material / stock / color / familia de panel          | 33                |
| Instalación                                          | 11                |
| Fiscal / facturación                                 | 1                 |
| Técnico calidad / garantía                           | 1                 |


**Concentración de preguntas por publicación:** en el corpus 04-13 hay **40** `item_id` distintos; **~88%** de las preguntas caen en categoría de marketplace `**MLU403698`** (aislantes / construcción, títulos tipo Isodec, Isopanel, Isoroof, kits). Conviven listings puntuales de **galpones chapa**, **HM Rubber**, **PUR Hiansa** y un ítem **vehículo usado** (no panel): conviene **responder corto** aclarando alcance o redirigir a la publicación correcta sin mezclar criterios de panel.

---

## 2. Voz BMC (cómo suenan ya las respuestas)

1. **Marca:** firmar como **BMC Uruguay** (mayúsculas/minúsculas variables en histórico; unificar en **“BMC Uruguay”** salvo que el canal impida firma larga).
2. **Tono:** cordial, respetuoso, **español rioplatense** mezclado con registro de negocio (“le comentamos”, “no dudes en consultarnos”).
3. **Honestidad operativa:** si falta información para cotizar, **preguntar** lo mínimo (largo, ancho, ciudad, tipo de estructura, aguas del techo, etc.) en lugar de inventar — **pero** si el comprador **ya dejó medidas interpretables**, **no repreguntar** lo mismo en otros términos: da sensación de poco rigor y muchos clientes **no responden** bucles o listas repetitivas.
4. **Precios:** cuando se da monto, usar **U$S** (como en histórico) y, si corresponde, **IVA inc**. En **Mercado Libre**, no mencionar el **tipo de lista** (“web”, “venta”, “distribuidor”, “lista BMC”): el comprador recibe montos y alcance; la lista aplicada es decisión interna (calculadora/MATRIZ).
5. **Alcance del presupuesto:** cuando se cotiza paquete (paneles + accesorios), indicar **qué incluye** y, si aplica, **qué no** (traslado, instalación).
6. **Puente a presupuesto detallado:** invitar a “presupuesto detallado / personalizado” y a seguir en el mismo canal de preguntas sin prometer plazos irreales.
7. **Brevedad permitida:** respuestas de una línea solo cuando la pregunta es binaria (“¿tienen color X?”).
8. **Seriedad en ML:** priorizar **avance hacia cotización** cuando los datos alcanzan; reservar preguntas solo para **vacíos reales** (p. ej. ciudad si hace falta **flete**, o aclaración genuinamente ambigua).
9. **Precio primero en ML:** si el comprador **pide precio** y los datos **alcanzan** para cotizar (medidas + producto/espesor razonablemente claros), la respuesta debe incluir **montos** (U$S **IVA inc.** cuando corresponda) **alineados a lo pedido**, antes de “presupuesto detallado” genérico. **Después** del precio, en un segundo bloque corto, ofrecer **accesorios extra, terminaciones o servicios** (flete, etc.) si aplican — sin diluir la cifra principal.
10. **Lenguaje interno vs cliente:** **nunca** decirle al comprador que “hay que verificar en MATRIZ”, “planilla” o procesos internos; hacia ML solo **limitación comercial/técnica** + **solución** + **precio**.

---

## 3. Plantilla de respuesta (orden recomendado)

Usar como **guía**, no como texto fijo.

1. **Saludo + (opcional) nombre** si está claro en el hilo.
2. **Reconocimiento** de la consulta (“Recibimos tu consulta…”, “Gracias por escribirnos…”).
3. **Respuesta directa:** si piden **precio** y alcanza información, ir **primero** al **total (y/o desglose breve) en U$S IVA inc.**; si no alcanza, **solo** aclaraciones mínimas.
4. **Upsell (opcional, después del precio):** accesorios, terminaciones, flete u otros servicios — en una o dos frases, sin repetir la cotización entera.
5. **CTA:** “Por cualquier otra consulta…” / “Estamos a las órdenes”.
6. **Cierre:** “Saludos, BMC Uruguay” o “Atentamente BMC Uruguay”.

**Anti‑patrones** detectados a evitar en el futuro:

- Ortografía muy suelta en mensajes largos (el histórico tiene typos puntuales; el estándar objetivo es **corregir antes de enviar**).  
- Contradicciones entre hilos sobre inclusiones (flete/instalación); usar **lista corta de exclusiones** cuando se cotiza.  
- **Repreguntar medidas ya dichas** o armar “checklists” de datos que el cliente **ya entregó** en el mismo mensaje (reduce tasa de respuesta y afecta la imagen de seriedad).

---

## 4. Reglas de negocio para contestar (alineadas al historial)


| Situación                                                                                     | Regla                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solo “¿Cuánto sale?” sin medidas                                                              | Pedir **largo, ancho, ubicación**, tipo de solución (techo/pared/cámara), y si hay **estructura** para fijar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Medidas ya suficientes** (p. ej. dos paños de fachada con largos y altura común explícitos) | **Reconocer** las medidas y dar **precio** (U$S IVA inc.) con **alcance** (qué incluye / qué no). **No** volver a pedir largo/alto “para confirmar” salvo **contradicción real**. Ciudad/departamento **solo** si vas a **cotizar flete** en el mismo mensaje o condicionar entrega; si no, podés cotizar material y ofrecer flete después.                                                                                                                                                                                                                                                                                 |
| Techo a dos aguas                                                                             | Aclarar cómo se distribuyen **largo vs ancho** y dónde va la **cumbrera** (como ya hacen en hilos reales).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Cotización numérica                                                                           | Incluir **moneda + IVA inc** cuando el precio es al público con IVA; listar **componentes** principales (paneles, cumbrera, goteros, siliconas, fijaciones… según caso).                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Flete                                                                                         | Si no está incluido, decirlo; ofrecer que **se puede cotizar aparte** si es política vigente.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Instalación                                                                                   | Si no hacen instalación, **decirlo claro** cuando el cliente lo insinúa o al cotizar obra.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Stock / color                                                                                 | Respuesta corta afirmativa/negativa + invitación a consultar detalle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Pregunta fuera de alcance / muy genérica                                                      | Responder lo posible + **preguntas de calificación** mínimas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Cortes / retal por debajo del largo mínimo de fábrica**                                     | Los **cortes en sentido longitudinal del panel no se hacen en fábrica**: en obra se cortan con **amoladora** y disco adecuado para chapa. Hacia el cliente: explicar la **limitación** (no despachamos esas piezas ya cortadas a ese largo en fábrica) y ofrecer **solución con hojas en largo comercial** (múltiplos que cubran la medida; el **último** paño suele ir al **largo mínimo** para **mínimo desperdicio global**, no retal en cada hoja). **Dar precio** de esa propuesta (calculadora / `POST /calc/cotizar` o `presupuesto-libre`). **No** mencionar MATRIZ/planillas ni procesos internos de verificación. |
| **Babeta adosar Isodec / isopanel (dato de producto)**                                        | Desarrollo total **16 cm** sumando plegados; material **chapa galvanizada prepintada calibre 24** (respuesta directa cuando preguntan medida/material). Si un tercero exige **más desarrollo** del que da el perfil (p. ej. más de **16 cm**), aclarar que **no corresponde** a ese accesorio estándar y ofrecer vía plano/alternativa.                                                                                                                                                                                                                                                                                     |


### 4.1 Criterios por familia de publicación (correlación título ML + volumen de preguntas)

Usar como **guía de tono y profundidad**: en el corpus **2026-04-13**, las publicaciones con más interacción son **Isopaneles fachada a medida (100 / 150 mm)**, **Isodec cubierta/techo EPS (100–200 mm)**, **Isopanel pared / cámaras (50–200 mm)**, **Isoroof Foil PIR a medida**, **kits de canalón / goteros / babetas / cumbreras** Isodec, más accesorios puntuales (soportes, selladores asociados). Criterios:


| Familia (ejemplos en ML)                                     | Qué suele preguntarse                                                                                                       | Cómo responder (BMC)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Isopaneles fachada** (100 / 150 / 250 mm, largos a pedido) | Medidas de cada pared, “L”, altura, color, si incluye accesorios, **cortes** / piezas chicas, comparación con otra solución | Reconocer que el cálculo es **por proyecto**. Si las medidas **ya bastan** para despiece, **cotizar con precio** (U$S IVA inc., qué incluye / qué no) **sin** repreguntar lo obvio. Si falta un solo dato operativo, pedir **solo ese** dato (p. ej. ciudad si aplica **flete**). Sobre **cortes longitudinales** y piezas por debajo del **largo mínimo** de fábrica: aplicar regla §4 (**amoladora** en obra; ofrecer **largos comerciales** + precio; sin vocabulario interno).             |
| **Isodec cubierta / techo EPS** (100–200 mm)                 | Dos aguas, cumbrera, listones, solape, compatibilidad con perfilería                                                        | Mantener el patrón ya usado en historial: aclarar **geometría del techo** (largos, pendiente, encuentros) antes de cotizar. Indicar qué va **incluido** en el paquete cotizado (paneles, ciertos accesorios) y qué **no** (flete, instalación).                                                                                                                                                                                                                                                |
| **Isopanel pared / cámaras** (50–200 mm)                     | Espesor vs uso (frío, partición), terminación, fijación                                                                     | Diferenciar **uso** (pared simple vs cámara) y pedir **dimensiones** y ubicación. Si hay riesgo de confusión con **Isodec cubierta**, nombrar ambas opciones y pedir **una** para cotizar o enviar **dos presupuestos** si el cliente lo pide explícitamente.                                                                                                                                                                                                                                  |
| **Isoroof Foil PIR** (30 / 50 mm…)                           | Mínimos de m², color FOIL, pendiente, fijación                                                                              | Alinear a reglas de catálogo / MATRIZ: **no prometer** mínimos ni colores sin verificación. Tono técnico breve + invitación a datos de obra.                                                                                                                                                                                                                                                                                                                                                   |
| **Kits canalón / gotero / babeta / cumbrera**                | Medidas de desarrollo, color, compatibilidad con espesor de panel, “qué incluye el kit”                                     | Responder **en función del espesor** de la publicación (100 vs 150 vs 250). **Babeta de adosar:** desarrollo total **16 cm** (plegados incluidos), **chapa galvanizada prepintada calibre 24** — comunicarlo **en claro** cuando lo preguntan; si un arquitecto exige **más** desarrollo del que da el perfil, explicar el **tope del producto** y la vía plano/alternativa. Si la duda depende de **foto** ambigua, complementar con ficha/plano sin sustituir el dato canónico del producto. |
| **PUR / Hiansa u otros aislantes distintos de EPS**          | Stock, uso, pegado                                                                                                          | Respuesta **corta**: confirmar que es línea distinta de Isodec EPS; remitir a ficha y a cotización si aplica.                                                                                                                                                                                                                                                                                                                                                                                  |
| **Galpón chapa / HM Rubber / ítems no core**                 | Disponibilidad, envío, uso                                                                                                  | No mezclar con lógica de panel: responder como **producto de la publicación** o derivar al equipo si el mensaje es ambiguo.                                                                                                                                                                                                                                                                                                                                                                    |
| **Ítem fuera de catálogo panel** (p. ej. vehículo)           | Pregunta genérica                                                                                                           | Respuesta **mínima** o declinar cortésmente si no corresponde al negocio panelero.                                                                                                                                                                                                                                                                                                                                                                                                             |


**Datos que no deben inventarse:** medidas, espesores, precios, plazos de entrega, disponibilidad exacta. Usar **calculadora / MATRIZ / API** cuando PANELSIM u operador tengan acceso; si no hay acceso, **no afirmar cifras**.

---

## 5. Mercado Libre — buenas prácticas (operativas)

1. **Tiempo de respuesta:** priorizar preguntas **sin responder**; el historial muestra uso ocasional de mensajes tipo “dejamos respondida para no afectar reputación” — usar **con criterio** y solo si la política interna lo permite (evitar respuestas vacías o engañosas).
2. **Claridad:** un mensaje = una idea principal + detalles; listas cortas si hay muchos ítems.
3. **No pedir datos sensibles** fuera de lo que ML permite en mensajería; respetar **Términos y políticas** vigentes del marketplace.
4. **Seguimiento:** si la cotización quedó pendiente en otro hilo, enlazar el hilo mentalmente (“como te comentamos en la consulta anterior…”).
5. **Reputación:** responder siempre que haya **contenido útil**; evitar spam de firmas repetidas en el mismo hilo.
6. **No compartir** canales externos si ML restringe (teléfono, WhatsApp, email) según reglas del sitio — verificar política actual antes de incluirlos en plantillas.
7. **Moneda vía API (U$S → texto publicable):** al publicar con `POST /ml/questions/:id/answer`, Mercado Libre **suele eliminar** el carácter `$` (incluso intentos con **U+FF04**), dejando **“US” pegado al monto** (p. ej. “US 1.456” en lugar de “U$S 1.456”). Podés redactar borradores con **U$S** o **USD**; el servidor (`normalizeMlAnswerCurrencyText` en [`server/lib/mlAnswerText.js`](../../../../server/lib/mlAnswerText.js)) convierte **`U$S` / `u$s` → `USD`** antes de llamar a ML, y los **`$`** restantes los pasa a ancho completo como **mitigación** secundaria. Revisá el texto publicado en el centro de preguntas; si una respuesta **ya** salió mal antes de este cambio, corregila ahí (la API no permite volver a responder la misma pregunta).

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
- **Tooling:** solo cotizar con `/calc/`* o MATRIZ verificada; ML solo `GET` hasta aprobación humana para `POST /ml/questions/:id/answer`.

---

## 7. Checklist antes de publicar respuesta en ML

- ¿Responde exactamente lo que preguntó el comprador o pide **solo** los datos mínimos que **realmente** faltan (sin repreguntar medidas ya dichas)?  
- Si pidió **precio** y alcanza información: ¿el mensaje lleva **cifra** (U$S **IVA inc.**) **antes** del upsell opcional?  
- Si hay precio: ¿**U$S** (o moneda correcta) y **IVA inc** si corresponde?  
- ¿Quedó claro **qué incluye** y **qué no** (flete, instalación)?  
- ¿Tono **cordial + profesional** y firma **BMC Uruguay**?  
- ¿Sin prometer plazos o stock sin verificación?  
- ¿Ortografía y puntuación revisadas?  
- ¿Modo PANELSIM? → no enviar `POST` sin OK de Matias si está en **aprobación**.

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

Para iterar **cada 10 consultas** —respuesta modelo/KB sin ver primero la humana, luego comparación y mejoras— seguir el proceso en `[../reports/ML-SIM-ITERATIVE-BLIND-IMPROVEMENT.md](../reports/ML-SIM-ITERATIVE-BLIND-IMPROVEMENT.md)` y exportar tandas con `npm run ml:sim-batch` (ver ese doc §5).

**Auditoría automática (corpus completo + órdenes + informe IA):** `npm run ml:ai-audit` — descarga todas las preguntas y órdenes, agrega métricas y genera `docs/team/panelsim/reports/ML-AI-AUDIT-REPORT-*.md` (ver `AGENTS.md`). `--dry-run` solo escribe JSON agregado.

---

## 11. De borradores corregidos a Panelin (training-kb)

Cuando cerrás una tanda de preguntas ML (borrador IA + texto final aprobado para publicar):

1. **Registrar el par gold** en `[../reports/ml-gold-runs/](../reports/ml-gold-runs/)` (archivo tipo `ML-GOLD-CANDIDATES-*.md`): columna **Respuesta gold (humana)** = texto que publicás o aprobarías en ML (alineado a §3 y checklist §7).
2. **Cargar en el KB de entrenamiento de Panelin** (modo desarrollador en la app o API), con `API_AUTH_TOKEN` en `.env`:
  - **CLI desde el repo:** `npm run panelin:train:import -- --file <lote.json>` (API en `:3001` o `BMC_API_BASE=…` para Cloud Run). Ver `[../reports/ml-gold-runs/README.md](../reports/ml-gold-runs/README.md)`.
  - O `POST /api/agent/train` con header `Authorization: Bearer <API_AUTH_TOKEN>`.
  - Cuerpo JSON sugerido:
    - `category`: `sales` o `mercadolibre` (en código, `mercadolibre` se normaliza a `sales`).
    - `question`: texto del comprador (opcional prefijo `Canal: Mercado Libre —` ).
    - `goodAnswer`: respuesta final humana (no el borrador IA si difiere).
    - `badAnswer`: (opcional) borrador IA o texto descartado, para contraste en entrenamiento.
    - `context`: `Canal: Mercado Libre | Q:<id> | item:<MLU…>` — ayuda al match en `GET /api/agent/training-kb/match`.
    - `permanent`: `true` si querés prioridad alta en el scoring de ejemplos.
3. `**data/training-kb.json`** está en `.gitignore`: cada máquina acumula ejemplos locales; para otro entorno repetí el POST o mové el JSON con cuidado (sin PII innecesaria).

La **respuesta “especial” ML** es la ya definida en **§2–§7** (voz BMC, plantilla §3, checklist §7, buenas prácticas §5). El asistente Panelin recibe además reglas explícitas en `server/lib/chatPrompts.js` (WORKFLOW → Mercado Libre).

---

## 12. Anexo — Hilos `UNANSWERED` recientes y **borradores listos para aprobar** (iteración **2026-04-13**)

**Contexto:** tras `npm run ml:corpus-export` quedaron **4** preguntas con estado **`UNANSWERED`** en ML (los demás “sin texto de respuesta” en el JSON suelen ser `BANNED` o anomalías de `answer`). Los textos siguen §2–§4, §4.1 y el checklist §7. Los **importes** de las filas **13562857868** y **13562524850** se calcularon con la API local **`POST /calc/cotizar`** y **`POST /calc/cotizar/presupuesto-libre`** (lista **web**, **IVA incluido** en el total devuelto); **revalidar** color, geometría y alcance antes de publicar (`POST /ml/questions/:id/answer`). **No** incluir en el mensaje al cliente referencias a MATRIZ ni procesos internos. Al publicar, `normalizeMlAnswerCurrencyText` convierte **`U$S` → `USD`** para evitar que ML muestre “US” pegado al monto (§5 ítem 7).


| ID pregunta     | Publicación (resumen)              | Resumen consulta                                                      | Texto sugerido para ML (revalidar antes de publicar)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------- | ---------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **13562857868** | Isopaneles 100 mm fachada a medida | Dos fachadas: **2,8 × 2,5 m** y **4 × 2,5 m** (100 mm)                | *Hola, gracias por escribirnos. Con las medidas que nos pasás (una fachada **2,8 × 2,5 m** y la otra **4 × 2,5 m** en isopanel **100 mm**), el material estándar de cerramiento nos queda en **USD 1.625,76 IVA inc.** (podés escribir **U$S** en el borrador; el servidor lo normaliza al publicar). Incluye paneles, perfilería, fijaciones y selladores según el despiece habitual de este tipo de fachada; **no incluye flete ni instalación**. Si querés, en un siguiente paso podemos cotizar **flete** a tu ciudad o sumar **terminaciones** puntuales que quieras explicitar. Saludos, BMC Uruguay.*                                                                                                                                                                                                     |
| **13562108039** | Isopaneles 100 mm fachada a medida | Materiales para **dos paredes en L**; **sin** medidas                 | *Hola, gracias por la consulta. Sí, podemos cotizar materiales para **dos paredes en L** en **isopanel 100 mm fachada**. Para armar cantidades sin error, en un solo mensaje necesitamos **largo y alto (m) de cada paño del L**, **ciudad o departamento** (si querés que evaluemos **flete**) y si buscás **solo panel** o también **terminaciones** (esquineros, remates, etc.). Con eso te pasamos el **precio en USD con IVA inc.** y el alcance del material. Saludos, BMC Uruguay.*                                                                                                                                                                                                                                            |
| **13562524850** | Isopaneles 100 mm fachada a medida | Retal **2,20×0,40** y **1,20×0,40**; consulta corte “a lo largo”      | *Hola, gracias por el detalle. En fábrica **no hacemos el corte en el sentido longitudinal del panel**; ese corte lo hacés en obra con **amoladora** y disco adecuado para chapa. Las piezas que describís quedan por debajo del **largo mínimo** en que despachamos la hoja; la forma práctica es llevar **hojas en largo comercial** (por ejemplo **2 hojas** de **2,30 m** de largo útil) y cortar en obra hasta las medidas que necesitás, con **poco desperdicio global**. Solo por ese material de panel (**5,25 m²** aprox., isopanel **100 mm** color **Blanco**) el valor es **USD 294,43 IVA inc.** (sin perfilería ni fijaciones; si querés te cotizamos el **kit completo** en el mismo hilo). Saludos, BMC Uruguay.* |
| **13561044239** | Babeta adosar Isodec / isopanel    | Arquitecto pregunta si el desarrollo llega a **≥25 cm**; **material** | *Buenas, gracias por la consulta. La **babeta de adosar** suma un **desarrollo total de 16 cm** contando todos los plegados; el material es **chapa galvanizada prepintada calibre 24**. Si el arquitecto necesita **más de 16 cm** de desarrollo, esa condición **ya no cubre** este perfil estándar (habría que revisar plano u otra solución). Quedamos atentos a cualquier otra consulta. Saludos, BMC Uruguay.*                                                                                                                                                                                                                                                                                                              |


**Nota técnica (solo interno, no pegar en ML):** el total **1.625,76** = `solo_fachada`, `ISOPANEL_EPS` **100**, `alto` **2,5**, `perimetro` **6,8** (2,8 m + 4 m de desarrollo horizontal), `numEsqExt` **2**, `numEsqInt` **0**, `lista` **web**, `flete` **0**. La fila **13562524850** usa **5,25 m²** en `presupuesto-libre` como **aproximación** de **2 × (2,30 × 1,14)** m²; ajustar cantidades si el largo comercial o el color difieren. Recordar normalización de **U$S** al publicar (§5).

---

*Documento generado a partir del análisis estadístico del corpus local; el anexo §12 resume hilos abiertos puntuales con borradores guía. Las respuestas históricas del corpus completo no se archivan aquí íntegras.*