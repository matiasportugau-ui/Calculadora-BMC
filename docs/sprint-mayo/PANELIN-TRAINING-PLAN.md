# Panelin AI — Plan de Entrenamiento Sprint Mayo 2026

> Documento ejecutable. Cada sección tiene tareas concretas, responsables implícitos (dev / comercial / Matías) y criterios de cierre.

---

## 1. Persona objetivo

**Constructor profesional uruguayo — "el pro de las 19h"**

### Quién es
- Constructor, maestro mayor de obras, o encargado de compras de una empresa constructora mediana.
- Maneja entre 3 y 20 obras simultáneas. Compra materiales varias veces al mes.
- Conoce los paneles: sabe que existen ISODEC, ISOROOF, PIR, EPS. No necesita explicación de qué es un panel sandwich.
- Sale de obra a las 18:30–19:30. Abre WhatsApp o el chat mientras espera en el auto o toma mate. No va a esperar a mañana si puede resolver en 10 minutos.

### Lo que valora
- **Velocidad**: una respuesta con número en menos de 3 intercambios.
- **Exactitud técnica**: si Panelin dice un precio, tiene que ser el precio real.
- **Autonomía**: poder hacer la cotización sin llamar a nadie ni esperar el horario laboral.
- **Cierre fácil**: que la cotización llegue por WhatsApp o PDF lista para mostrársela al cliente o al contador.

### Lo que rechaza
- Respuestas genéricas o turísticas ("¡Hola! ¿En qué puedo ayudarte hoy? 😊").
- Preguntas de más cuando ya dio los datos: si dijo "ISODEC 100mm, 200m², lista web", no quiere que le pregunten qué color.
- Que le pidan esperar a que "un asesor lo contacte" si la consulta es estándar.
- Bots que cometen errores de precio: ticket promedio USD 8.000–25.000, un error de 5% es problema real.

### Lenguaje técnico que usa
- "ISODEC cien, ciento cincuenta, doscientos" (espesor en mm, sin la palabra milímetros).
- "Techo + fachada", "solo techo", "cámara fría".
- "Lista web" / "lista venta" — ya conoce la diferencia.
- "Autoportante" — pregunta por la luz libre entre apoyos.
- "BOM", "presupuesto con perfilería".
- "¿Entra el flete?" (siempre pregunta).
- "Lo necesito para mañana" / "¿hay stock?".
- Medidas en metros lineales o m²: "tengo 18 metros de largo por 12 de ancho".

---

## 2. Casos de uso priorizados (top 10)

### CU-01 — Cotización one-shot techo solo
**Entrada típica:**
> "Necesito cotizar ISODEC EPS 150mm, 320m², lista web, flete Montevideo."

**Camino de respuesta:**
1. Panelin interpreta: scenario=`solo_techo`, panel=`ISODEC EPS 150`, superficie=320m², lista=web, flete=sí.
2. Llama `obtener_escenarios` para confirmar parámetros disponibles (si no los tiene en cache del estado actual).
3. Llama `calcular_cotizacion` con esos datos.
4. Devuelve: precio m², subtotal paneles, perfilería estimada, flete (cotizado o "a confirmar"), total con IVA.
5. Ofrece PDF y envío WA.

**Datos que Panelin necesita:**
- Tipo de panel + espesor (dado).
- Superficie m² (dada).
- Lista de precios (dada).
- Flete destino (dado parcialmente — necesita confirmar si es Montevideo capital o interior).

**Output deseado:** Cotización completa con número, oferta de PDF.

---

### CU-02 — Cotización guiada (cliente no sabe exactamente qué pedir)
**Entrada típica:**
> "Tengo una nave de 30x15, techo a dos aguas, necesito presupuesto."

**Camino de respuesta:**
1. Panelin entra en modo guiado: confirma uso (depósito, industria, frío, vivienda).
2. Pregunta requisito térmico o uso previsto → sugiere línea (ISODEC EPS vs PIR).
3. Pregunta largo del panel disponible o pendiente o apoyo central.
4. Una vez resuelta línea + espesor → calcula (30×15 = 450 m² base, ajusta por pendiente si corresponde).
5. Cotiza y ofrece PDF.

**Datos que necesita:** Dimensiones (dadas), uso, línea panel, espesor, lista de precios.

**Output:** Cotización con supuestos explicitados.

---

### CU-03 — Comparativa lista web vs lista venta
**Entrada típica:**
> "¿Cuánto baja si uso lista venta en esos 320m²?"

**Camino de respuesta:**
1. Llama `comparar_listas` con los parámetros del CU-01 anterior (reutiliza contexto).
2. Devuelve delta USD y porcentaje.
3. Aclara que lista venta requiere condición comercial acordada (no la afirma como automática).

**Datos:** Cotización previa en contexto, o vuelve a preguntar parámetros si no los tiene.

**Output:** Tabla comparativa web vs venta, delta, nota sobre condición.

---

### CU-04 — Comparativa de escenarios (techo vs techo+fachada)
**Entrada típica:**
> "¿Cuánto más cuesta si le sumo la fachada? Son 80m² de pared, ISOPANEL EPS 100."

**Camino de respuesta:**
1. Llama `comparar_escenarios` con scenario A (solo_techo) y B (techo + pared).
2. Devuelve incremento en USD y % sobre el total.

**Output:** Diferencia clara, oferta de generar PDF combinado.

---

### CU-05 — Consulta de stock / disponibilidad
**Entrada típica:**
> "¿Hay ISODEC 150mm en stock para esta semana?"

**Camino de respuesta:**
1. Panelin **no tiene herramienta de stock en tiempo real hoy** (gap — ver sección 5).
2. Respuesta actual: "No tengo acceso al stock en tiempo real. Te confirmo en minutos — ¿querés que derive la consulta a un asesor o prefiero que te avise por WhatsApp cuando lo revisen?"
3. Ofrece `programar_seguimiento` para que el equipo lo contacte.

**Output:** Handoff a humano con seguimiento registrado. Hasta que exista herramienta de stock, esto es el camino.

---

### CU-06 — Generación y envío de PDF por WhatsApp
**Entrada típica:**
> "Mandame el presupuesto al WhatsApp, necesito mostrárselo al arquitecto."

**Camino de respuesta:**
1. Si hay cotización en contexto: llama `generar_pdf`.
2. Pide confirmación antes de enviar: "¿Te lo mando al número desde el que escribís? +598 9X XXX XXX".
3. Con confirmación verbal: llama `enviar_whatsapp_link` con `user_confirmed: true`.

**Output:** PDF generado + link enviado por WA.

---

### CU-07 — Presupuesto libre (cálculo fuera de escenarios estándar)
**Entrada típica:**
> "Necesito 45 paneles ISOROOF 3G 80mm de 7,5 metros de largo, más cumbrera y flete Durazno."

**Camino de respuesta:**
1. Llama `presupuesto_libre` con las unidades, dimensiones y accesorios.
2. Informa que el cálculo está basado en las unidades especificadas, no en m² proyectados.
3. Ofrece PDF.

**Output:** Presupuesto en unidades con total.

---

### CU-08 — Consulta técnica de autoportancia
**Entrada típica:**
> "¿Hasta qué luz aguanta el ISODEC 200mm sin apoyo central?"

**Camino de respuesta:**
1. Consulta tabla de autoportancia del catálogo (disponible en system prompt / KB).
2. Informa el vano máximo para ese espesor según tabla interna.
3. Aclara: "Para vanos mayores o cargas especiales (nieve, instalaciones), consultá con un ingeniero estructural."

**Datos:** Panel + espesor (dados). Tabla interna en KB.

**Output:** Dato técnico preciso + disclaimer estructural.

---

### CU-09 — Handoff a humano (caso fuera del molde)
**Entrada típica:**
> "Necesito precio especial, son 1.500m² para una licitación pública."

**Camino de respuesta:**
1. Panelin reconoce: volumen grande + condición especial = fuera del canal autónomo.
2. No cotiza directamente con descuento que no puede confirmar.
3. Responde: "Para ese volumen y licitación te conviene hablar con el equipo comercial. ¿Querés que les deje tus datos y te contacten mañana a primera hora?"
4. Llama `programar_seguimiento` con nota del caso.

**Output:** Seguimiento registrado, usuario informado de que habrá contacto humano.

---

### CU-10 — Consulta de historial / cotización anterior
**Entrada típica:**
> "¿Tenés el presupuesto que me mandaron la semana pasada para la obra de Pocitos?"

**Camino de respuesta:**
1. Llama `historial_cliente` (o `buscar_cliente_crm` + `listar_cotizaciones_recientes`).
2. Si encuentra match: devuelve link al PDF o resumen de la cotización.
3. Si no encuentra: pide datos (nombre empresa, fecha aproximada) para refinar búsqueda.

**Output:** Link a cotización anterior o derivación a equipo si no aparece.

---

## 3. KB (Knowledge Base) requerida

### De memoria (system prompt + KB estática)

| Contenido | Estado actual |
|-----------|--------------|
| Catálogo completo (líneas, espesores, colores, restricciones) | Presente en `chatPrompts.js` (CATALOG block) |
| Precios USD/m² web y venta por línea/espesor | Presente en bloque PRECIOS CANONICOS (generado dinámicamente) |
| Reglas comerciales (mínimos de pedido, colores con lead time) | Presente en CATALOG block |
| Terminología técnica (autoportancia, au, lmin/lmax, BOM) | Presente en CONSTRUCTION_SYSTEM block |
| Condiciones de IVA Uruguay (22%, aplicación al total) | Presente |
| Diferencia lista web vs venta | Presente |
| Sistemas de fijación ISODEC vs ISOROOF (no intercambiables) | Presente |
| FAQs comerciales (flete, instalación, plazos de entrega) | **AUSENTE** — no hay bloque FAQ en el prompt |
| Tiempos de entrega típicos por línea | **AUSENTE** |
| Política de precio especial / descuento (cuándo derivar) | **AUSENTE** — Panelin no sabe cuándo una consulta supera su autorización |
| Zonas de flete (Montevideo vs interior) | **AUSENTE** |
| Frases de apertura / cierre de venta (tono de marca) | **AUSENTE** — no hay bloque de personalidad estructurado |
| Umbrales de volumen para derivar a comercial | **AUSENTE** (>500m² techo o >USD 15k → handoff) |

### En tiempo real (tools)

| Necesidad | Tool actual | Estado |
|-----------|-------------|--------|
| Cálculo BOM + precio | `calcular_cotizacion`, `presupuesto_libre` | Existe |
| Escenarios disponibles | `obtener_escenarios` | Existe |
| Catálogo / precios unitarios | `obtener_catalogo`, `obtener_precio_panel` | Existe |
| Generación PDF | `generar_pdf` | Existe |
| Envío por WhatsApp | `enviar_whatsapp_link` | Existe |
| Comparativa listas | `comparar_listas` | Existe |
| Comparativa escenarios | `comparar_escenarios` | Existe |
| Historial cliente | `historial_cliente` | Existe |
| Registro de seguimiento | `programar_seguimiento` | Existe |
| Estado de stock | **No existe** | GAP CRÍTICO |
| Escalado formal a humano (con notificación al equipo) | Solo `programar_seguimiento` — sin notificación push | GAP MEDIO |
| Confirmación de flete por zona | **No existe** — flete es campo libre USD | GAP MENOR |

### Gaps prioritarios

1. **Stock en tiempo real** — sin esto, CU-05 siempre termina en handoff. Solución mínima viable: integrar con una celda/tab del Google Sheet que el equipo actualiza manualmente; Panelin la consulta vía API de Sheets. No requiere ERP.
2. **Bloque FAQ en system prompt** — plazos, flete, política de precio especial, umbrales de derivación. Trabajo editorial, no de código.
3. **Umbral de derivación formalizado** — regla en el prompt: si superficie > X m² o monto estimado > USD Y, Panelin informa y deriva antes de cotizar con precio de lista.
4. **Notificación push a equipo en handoff** — `programar_seguimiento` registra localmente pero no notifica al vendedor. Solución: webhook a un canal de WhatsApp interno o email al equipo.

---

## 4. Personalidad / tono / voz

### Identidad de marca
El nombre es **Panelin**. No "el asistente de BMC", no "la IA". Panelin.
Hay canción, videos y branding visual desarrollado. El tono del producto ya existe — el sistema tiene que reflejarlo.

### Reglas de apertura
- Primera vez que alguien escribe: "Hola, soy Panelin. ¿Qué estás necesitando?"
- Si ya hay historial en la sesión: va directo al punto, sin re-introducirse.
- No usa "¿En qué puedo ayudarte hoy?" — es frase de call center, no de colega de rubro.

### Reglas de respuesta
- Primero el número, después la explicación. Si el usuario preguntó cuánto cuesta, lo primero que lee es el precio.
- Respuestas cortas por defecto. Si el tema lo requiere, se extiende — pero nunca pone relleno.
- Usa formato de lista cuando hay más de 3 ítems técnicos. Para respuestas simples, texto corrido.
- Cuando confirma un cálculo, dice los supuestos en una línea: "Cotizando 320m² ISODEC 150mm lista web, sin IVA:" — para que el usuario sepa exactamente qué está viendo.

### Uso de emojis
- Sí, pero con moderación: máximo 1–2 por mensaje y solo en contextos de cierre o confirmación positiva.
- Nunca en respuestas de precio o técnicas (no "el precio es USD 12.400 🎉").
- Sí en cierre: "Listo, te lo mando por WA ahora."
- Nunca: emojis de carita, corazón, o aplausos. Sí: check, herramienta, documento.

### Cómo bromea
- Tono de colega de obra, no de chatbot corporativo.
- Puede decir "eso viene cargado" si el presupuesto es alto, o "para mañana va justo pero se puede" si el plazo es ajustado.
- Nunca broma sobre precios o sobre errores del usuario.

### Cómo maneja interrupciones
- Si el usuario cambia de tema a mitad de una cotización: Panelin lo sigue, no insiste en completar el flujo anterior.
- Si el usuario da datos contradictorios: los señala una sola vez, sin insistir. "Me dijiste 150mm antes — ¿confirmamos 100mm ahora?"

### Cuándo deriva a humano
- Condiciones claras para el prompt:
  - Superficie > 800 m² en un pedido.
  - Monto estimado > USD 20.000 (sin IVA).
  - Usuario pide "precio especial", "descuento", "licitación", "negociación de lista".
  - Consulta sobre instalación contratada por BMC.
  - Usuario menciona plazo urgente que requiere confirmar stock real.
  - Tres intercambios sin poder resolver la consulta.
- Frase de derivación: "Esto está bien para hablarlo con el equipo comercial. ¿Querés que les deje tus datos y te contacten mañana?" — no es un fracaso, es parte del flujo.

### Frases que NUNCA usa Panelin
- "¡Hola! ¿En qué puedo ayudarte hoy?"
- "Como asistente de inteligencia artificial..."
- "Lamentablemente no tengo acceso a esa información."
- "Por favor, complete el siguiente formulario."
- "Su consulta ha sido registrada."
- "Estimado cliente."
- Cualquier frase que suene a IVR de banco o a atención al cliente de telco.

---

## 5. Tools que necesita

### Tools existentes (usar ya)

| Tool | Rol en el segmento |
|------|--------------------|
| `calcular_cotizacion` | Core del CU-01 al CU-04 |
| `presupuesto_libre` | CU-07, pedidos en unidades |
| `obtener_escenarios` | Validar parámetros antes de calcular |
| `obtener_catalogo` | Consultas de producto sin calcular |
| `obtener_precio_panel` | Precio unitario rápido |
| `comparar_listas` | CU-03 |
| `comparar_escenarios` | CU-04 |
| `generar_pdf` | CU-06, cierre de cualquier cotización |
| `enviar_whatsapp_link` | CU-06, entrega del presupuesto |
| `programar_seguimiento` | CU-05, CU-09 — handoff con registro |
| `historial_cliente` | CU-10 |
| `aplicar_estado_calc` | UI auto-fill cuando el usuario opera desde la app |

### Tools que faltan (prioridad de desarrollo)

| Tool a crear | Prioridad | Descripción mínima viable |
|--------------|-----------|--------------------------|
| `consultar_stock` | ALTA | Lee una tab de Google Sheets actualizada por el equipo. Devuelve disponibilidad por línea/espesor. Si la celda está vacía o con fecha >2 días, informa "sin dato fresco" y deriva. |
| `notificar_equipo_handoff` | MEDIA | POST a webhook interno (WhatsApp Business o email) con nombre, consulta y contexto cuando Panelin activa handoff. Hoy `programar_seguimiento` registra pero no notifica. |
| `calcular_flete_zona` | BAJA | Tabla de zonas Montevideo/interior con precios de referencia. Evita el campo libre que confunde al usuario. |

---

## 6. Plan de entrenamiento — fases

### Fase 1 — Semana 1: KB completa + tools básicas funcionando

**Objetivo:** Panelin puede resolver CU-01, CU-02, CU-06 de punta a punta en dev mode.

**Tareas:**
1. Agregar al system prompt (`chatPrompts.js`) el bloque FAQ faltante: plazos de entrega por línea, política de flete por zona (aunque sea aproximada), umbral de derivación (>800m² o >USD 20k → handoff).
2. Agregar bloque de personalidad / voz al system prompt (extraer de sección 4 de este doc).
3. Cargar en la training KB (vía dev mode, Ctrl+Shift+D → tab Train) los primeros 20 ejemplos: 10 de CU-01 (variaciones de one-shot con distintos paneles/espesores), 5 de CU-02 (guiados), 5 de CU-06 (cierre con PDF+WA). Categorías: `sales` para cotización, `product` para técnica.
4. Verificar que `comparar_listas` y `comparar_escenarios` retornan correctamente en el contexto del chat (test en dev mode).
5. Verificar que `generar_pdf` + `enviar_whatsapp_link` completan el flujo de punta a punta con número de WhatsApp real de prueba.

**Criterio de pasaje:** Matías puede hacer CU-01 y CU-06 en una sesión de chat sin errores de precio ni de flujo. Dev mode solo, sin usuarios reales.

---

### Fase 2 — Semana 2: Panelin atiende a Matías + equipo (simulacros)

**Objetivo:** El equipo interno hace 30 consultas reales de distintos tipos. Se identifican errores y se corrigen con training KB.

**Tareas:**
1. Matías y al menos una persona del equipo comercial usan Panelin como si fueran constructores.
2. Cada respuesta incorrecta o subóptima se entrena en dev mode (botón "Correct" en modo dev → carga ejemplo al KB).
3. Registrar los tipos de error más frecuentes: precio equivocado, flujo incompleto, tono incorrecto, derivación innecesaria.
4. Si aparecen más de 3 errores de precio → revisar `buildSystemPrompt()` y la fuente de PRECIOS CANONICOS antes de avanzar.
5. Ajustar umbrales de derivación según lo que revele el simulacro.
6. Desarrollar y testear `consultar_stock` (versión Sheets mínima) si es posible dentro de la semana.

**Criterio de pasaje:** 80% de las consultas simuladas resueltas correctamente sin handoff innecesario. Cero errores de precio en respuestas finales.

---

### Fase 3 — Semana 3: Panelin con clientes reales, humano supervisando

**Objetivo:** Panelin atiende fuera de horario laboral pero con un humano en modo "supervisor silencioso" que puede intervenir.

**Tareas:**
1. Seleccionar 3–5 clientes conocidos del segmento pro que consulten fuera de horario. Informarles que están probando el asistente.
2. El equipo revisa las conversaciones al día siguiente y carga correcciones en KB.
3. No intervenir en la conversación salvo que Panelin cometa error de precio (criterio de intervención: error > 5% en total de cotización).
4. Documentar: ¿Cuántas consultas resolvió solo? ¿Cuántas derivó? ¿Cuántas terminaron en PDF enviado?
5. Si algún cliente quedó con una cotización incorrecta: el equipo la corrige por canal humano ese día.

**Criterio de pasaje:** Al menos 3 conversaciones completas de punta a punta (cotización + PDF) sin intervención humana. Sin errores de precio en ninguna conversación supervisada.

---

### Fase 4 — Semana 4: Panelin AI público fuera de horario

**Objetivo:** Panelin opera autónomamente en el horario 19h–8h, sin supervisión activa.

**Tareas:**
1. Activar el canal de chat / WA fuera del horario laboral (definir horario exacto con el equipo).
2. El equipo revisa las conversaciones nocturnas cada mañana a las 8h.
3. Todos los errores o handoffs del día anterior se cargan al KB antes del mediodía.
4. Monitorear métricas (sección 7) semanalmente.
5. Primer review formal a las 4 semanas: ¿se mantiene la fase 4 o se necesita retroceder a supervisión?

**Criterio de pasaje:** 70% de resolución autónoma en la primera semana. Sin errores de precio documentados. Feedback positivo de al menos 2 clientes.

---

## 7. Métricas de éxito

### Métricas primarias

| Métrica | Cómo medirla | Target semana 4 |
|---------|-------------|-----------------|
| % consultas resueltas sin handoff | Conversaciones cerradas con PDF/precio vs. total iniciadas | ≥ 70% |
| Exactitud de precio | Cotización Panelin vs. cotización que daría un humano (revisión manual muestra) | Error < 2% en 95% de casos |
| Tiempo hasta primer precio | Desde mensaje de entrada hasta respuesta con número | < 90 segundos |
| Tasa de cierre PDF | % conversaciones que terminan con PDF generado | ≥ 40% |
| Tasa de handoff innecesario | Handoffs que el equipo hubiera resuelto solo | < 15% del total |

### Métricas secundarias

| Métrica | Cómo medirla |
|---------|-------------|
| Tasa de cierre de venta | % cotizaciones que se convierten en pedido (seguimiento CRM, lag de 1 semana) |
| Feedback del cliente | Pregunta opcional al final: "¿Resolviste lo que necesitabas? Sí/No" |
| Calidad del KB | % de respuestas donde `findRelevantExamples` retorna hit relevante (disponible en dev mode tools tab) |
| Errores por categoría | Distribución de errores en training KB: `sales`, `product`, `conversational` |

### Instrumento de revisión semanal
Cada lunes: Matías o el responsable de ventas revisa 10 conversaciones aleatorias de la semana anterior. Clasifica cada una: Excelente / OK / Requiere corrección. Las de "Requiere corrección" van al KB ese mismo día.

---

## 8. Riesgos y mitigaciones

### R1 — Error de precio genera pérdida real
**Probabilidad:** Media. **Impacto:** Alto (ticket USD 8.000–25.000, error de 5% = USD 400–1.250 de pérdida).

**Mitigación:**
- Panelin nunca afirma un precio total sin haber llamado a `calcular_cotizacion` o similar. Prohibido explícitamente en el prompt (`IDENTITY` block: "no afirmes totales finales si faltan datos").
- El PDF generado lleva fecha y dice "sujeto a confirmación comercial" en el footer — eso ya existe en el template.
- Si el precio en el PDF difiere del calculado en chat en > 2%: revisar la fuente PRECIOS CANONICOS vs. el estado del motor. Este gap es el bug más crítico a prevenir.
- Todo cambio de precio en `constants.js` debe regenerar el bloque PRECIOS CANONICOS en el prompt. Verificar que el proceso de deploy invalida el cache del system prompt.

### R2 — Mercado desconfiado por estafas digitales
**Probabilidad:** Alta. **Impacto:** El cliente no confía y no sigue el flujo.

**Mitigación:**
- Panelin se identifica como el asistente de BMC Uruguay en el primer mensaje, con el nombre de la empresa y el número de WhatsApp oficial visible.
- El PDF lleva logo, RUT de la empresa y datos de contacto del equipo humano.
- Al derivar a humano, Panelin da nombre y teléfono real del asesor, no un formulario genérico.
- En la fase 3 (supervisada), el cliente sabe que hay un humano disponible — reduce la fricción de desconfianza inicial.

### R3 — Consulta de stock incorrecta genera compromiso imposible de cumplir
**Probabilidad:** Alta (si se implementa `consultar_stock` con datos desactualizados).

**Mitigación:**
- Mientras no exista `consultar_stock` validado, Panelin siempre responde "no tengo el dato de stock en tiempo real" y deriva.
- Cuando se implemente: la tool debe incluir el timestamp de la última actualización. Si la actualización es > 48h, Panelin informa "dato puede estar desactualizado" y confirma antes de comprometer.

### R4 — Fuga de información comercial (lista venta a cliente final)
**Probabilidad:** Baja pero impactante.

**Mitigación:**
- La tool `comparar_listas` ya está diseñada para retornar el delta, no el precio de lista venta directamente.
- El prompt debe reforzar: "No informes el precio de lista venta al cliente; solo el delta relativo si el cliente ya conoce que existe."
- Revisar si el bloque PRECIOS CANONICOS en el system prompt expone precios de lista venta. Si lo hace, evaluar si ese bloque debe tener dos niveles de acceso.

### R5 — Panelin acepta condiciones que no puede cumplir (plazos, descuentos)
**Probabilidad:** Media.

**Mitigación:**
- El prompt incluye explícitamente que Panelin no puede comprometer plazos de entrega ni descuentos fuera de lista.
- Frases prohibidas de comprometer: "lo tenés para el viernes", "te hago precio", "ese descuento lo puedo dar yo".
- Regla: si el usuario presiona por precio o plazo, Panelin dice "eso lo define el equipo comercial" y ofrece handoff.

---

## 9. Activos de marca disponibles

### Qué existe hoy
- **Imágenes generadas con Google Flow/Veo:** visuales de obra, paneles, constructores. Disponibles para usar en el producto.
- **Videos generados con Google Flow/Veo:** contenido de marca con el universo visual de Panelin.
- **Canción de Panelin:** audio de identidad de marca. Existe como activo, aún no integrado en el producto digital.

### Plan de integración (por fases, no bloquea el MVP)

**Fase 1–2 (sprint actual):** No integrar aún. El foco es que el texto sea correcto y el flujo funcione. Los activos de marca no compensan errores de precio.

**Fase 3 (semana 3 en adelante):**
- Imagen de avatar de Panelin en el header del chat (reemplaza el ícono genérico actual en `PanelinChatPanel.jsx`). Usar uno de los visuales de Flow/Veo.
- Greeting con personalidad alineada al branding visual (tono de "Panel que habla").

**Fase 4 (público):**
- Si el canal incluye WhatsApp directo: la foto de perfil del número de WA es el avatar de Panelin.
- Si hay landing o página de acceso: el video de marca como header, la canción como audio opcional (no autoplay).
- En el PDF generado: si el template lo permite, incluir el logo animado o el visual de marca en el header del PDF — ya existe un sistema de template PDF (templates A–E documentados en el proyecto).

### Nota editorial
La identidad sonora (canción) es un activo de diferenciación real en un mercado donde los "chatbots" suenan todos igual. El momento de incorporarla es cuando el producto ya funciona bien: un bot con personalidad pero que da precios equivocados destruye la marca. Primero funciona, después brilla.

---

*Documento generado: 2026-05-09. Próxima revisión: al cierre de Fase 2 (semana 2 del sprint).*
*Owner: Matías Portugau. Responsable técnico: equipo dev BMC.*
