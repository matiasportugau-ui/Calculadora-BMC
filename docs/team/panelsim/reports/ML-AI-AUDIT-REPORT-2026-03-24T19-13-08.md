# ML — Informe automático (IA)

**Generado:** 2026-03-24T19:13:39.468Z
**API:** http://127.0.0.1:3001
**Modelo usado:** grok
**Datos agregados:** `docs/team/panelsim/reports/ML-AI-AUDIT-DATA-2026-03-24T19-13-08.json`

---
# Informe de Análisis de Operaciones y Marketplace para BMC Uruguay (METALOG SAS)

## 1. Resumen Ejecutivo
En el período analizado, se registraron 484 preguntas de compradores en Mercado Libre, con un 98% respondidas (475 de 484), lo que refleja un manejo eficiente de consultas. Por otro lado, se procesaron 22 órdenes, de las cuales 21 fueron pagadas y 20 cumplidas, indicando un alto nivel de conversión y ejecución. Sin embargo, persiste una pregunta no respondida y algunos órdenes con tags de "not_delivered", lo que podría afectar la percepción de entrega. En general, el equipo mantiene una buena reputación en el marketplace, pero se observan oportunidades para optimizar el flujo de envíos y el seguimiento de consultas pendientes. Las preguntas comunes giran en torno a costos, medidas y envíos, lo que sugiere un interés creciente en personalizaciones. Recomendamos priorizar la respuesta rápida para mantener SLAs y explorar mejoras en logística para capitalizar estas consultas en ventas adicionales.

## 2. Preguntas ML: Volumen, Estados y Posibles Riesgos
El volumen total de preguntas es de 484, con un rango temporal desde el 19 de agosto de 2025 hasta el 24 de marzo de 2026. En términos de estados, 475 están respondidas, 8 baneadas y solo 1 no respondida, lo que representa un 0,2% de pendientes. Este bajo porcentaje es positivo, ya que refleja un cumplimiento cercano al 100% en respuestas, alineado con buenas prácticas de Mercado Libre como tiempos de respuesta ágiles (idealmente dentro de 24 horas para mantener la reputación). 

Sin embargo, la pregunta no respondida (ID: 13550595916, del 24 de marzo de 2026) podría generar un riesgo de backlog si no se aborda pronto, potencialmente impactando en la calificación del vendedor. De la muestra, se observa que las consultas se centran en detalles específicos como costos, medidas y envíos (ej.: "Hola buen día, quisiera saber el costo para techo de 2 aguas"), lo que no indica un patrón de demoras generalizadas, pero sí la necesidad de chequear regularmente por consultas similares para evitar acumulaciones. No hay datos adicionales sobre tiempos promedio de respuesta, por lo que se sugiere monitorear esto en futuras revisiones.

## 3. Órdenes ML: Lectura del Flujo y Coherencia con Tags
Se registraron 22 órdenes en total, con 21 pagadas y 1 cancelada, mientras que 20 fueron cumplidas y solo 8 contaron con ID de envío. El flujo general muestra una alta tasa de pago (95%) y cumplimiento (91% de las pagadas), con fechas que van desde diciembre de 2025 hasta marzo de 2026. De la muestra reciente, todas las órdenes están en estado "paid", y la mayoría (7 de 10) tienen "fulfilled: true", lo que indica una ejecución efectiva post-pago.

En cuanto a coherencia con tags, se nota una posible inconsistencia: varios órdenes con "fulfilled: true" también llevan tags como "not_delivered" o "no_shipping" (ej.: orden ID 2000015644217084), lo que podría reflejar casos donde no se requiere envío físico (posiblemente retiros locales). Esto es coherente con el bajo número de órdenes con shipping ID (8 de 22), sugiriendo que el modelo de "no_shipping" funciona bien, pero se debe verificar para asegurar que no afecte la experiencia del comprador. En general, el flujo es sólido, pero la cancelación única (no especificada en detalles) podría indicar cuellos de botella en logística o comunicación.

## 4. Relación Cualitativa Consultas → Operación
Las consultas de compradores, basadas en la muestra, se enfocan en aspectos operativos como cotizaciones personalizadas (ej.: medidas específicas para techos o paredes), envíos y materiales complementarios, lo que parece correlacionar con el alto volumen de órdenes pagadas y cumplidas. Por ejemplo, preguntas sobre costos y envíos (como "Haces envíos a ciudad de la costa?") podrían estar vinculadas a las 8 órdenes con shipping ID, indicando que estas interacciones ayudan a aclarar expectativas y facilitar compras. 

Sin afirmar una causalidad directa, se observa que el bajo número de preguntas no respondidas coincide con un flujo operativo eficiente, donde la mayoría de las consultas resueltas (475) podrían contribuir a la conversión en ventas. Esto resalta la importancia de la claridad en respuestas para reforzar la reputación, pero también destaca áreas como envíos locales, que aparecen en consultas y podrían influir en la tasa de cumplimiento. En resumen, las consultas cualitativas parecen apoyar un ecosistema operativo positivo, con oportunidades para refinar procesos basados en temas recurrentes.

## 5. Recomendaciones Priorizadas
- Responder inmediatamente la única pregunta pendiente (ID: 13550595916) para evitar riesgos en SLA y mantener una reputación alta en Mercado Libre.
- Monitorear el tiempo de respuesta a consultas, apuntando a menos de 24 horas, como buena práctica para mejorar la calificación del vendedor y fomentar más interacciones.
- Analizar las 8 órdenes con shipping ID para identificar patrones y optimizar el proceso de envíos, reduciendo posibles demoras que podrían surgir de tags como "not_delivered".
- Revisar las preguntas baneadas (8 en total) para entender causas y ajustar políticas de comunicación, evitando que se repitan y afecten la experiencia del comprador.
- Desarrollar plantillas de respuesta para consultas comunes (ej.: costos y medidas) para agilizar el proceso y asegurar claridad, lo que podría incrementar la conversión de consultas en órdenes.
- Explorar opciones de envíos a áreas mencionadas en consultas (ej.: Ciudad de la Costa o Nueva Palmira) para capturar oportunidades de ventas en regiones subatendidas.
- Realizar un seguimiento semanal de órdenes canceladas para identificar cuellos de botella, como en el caso de la única cancelación registrada.

## 6. Checklist Operativo para los Próximos 7 Días
- **Día 1:** Verificar y responder la pregunta pendiente en Mercado Libre, registrando el tiempo de respuesta para métricas internas.
- **Día 2:** Analizar el estado de las 22 órdenes, enfocándose en las con tags "not_delivered" para confirmar su cumplimiento real.
- **Día 3:** Compilar un reporte de preguntas respondidas en los últimos 7 días, identificando temas recurrentes como medidas y envíos.
- **Día 4:** Realizar una revisión de inventario para asegurar stock suficiente, basado en consultas sobre personalizaciones.
- **Día 5:** Capacitar al equipo en buenas prácticas de respuesta, enfatizando claridad y rapidez para mantener la reputación.
- **Día 6:** Contactar a compradores de órdenes recientes (ej.: vía mensajes) para recolectar feedback sobre entregas y consultas.
- **Día 7:** Preparar un resumen de métricas para la próxima semana, incluyendo volumen de preguntas y estado de órdenes, para ajustes proactivos.
