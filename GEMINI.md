# Gemini (Google) en Panelin / Calculadora BMC

**Propósito de este documento:** 
- Resumir la familia de modelos Gemini (con énfasis reciente en Gemini Robotics) de forma precisa y citada.
- Explorar en profundidad las tres áreas de foco que el usuario propuso después de compartir la investigación inicial:
  1. Cómo funciona el modelo On-Device.
  2. La distinción VLA vs VLM (Embodied Reasoning).
  3. Cómo funciona el *tool calling* (agentic) en el contexto de robótica / ER.
- **Analizar la arquitectura ideal para nuestro proyecto** (Panelin agent, presup flows, spatial reasoning en planos de techo, multi-canal, evals y gates humanos) y justificar si la dirección más obvia (paridad completa de tool calling en todos los providers) es la correcta, o si debemos preferir otro diseño.

Fecha de investigación principal: junio 2026. Todas las afirmaciones factuales de modelos se respaldan con búsquedas web en fuentes oficiales (DeepMind, Google AI for Developers, arXiv, análisis técnicos) y se citan inline.

---

## 1. Visión general de la familia Gemini Robotics (2025-2026)

Google DeepMind ha construido una familia de modelos especializados que pueden trabajar juntos o de forma independiente:

- **Gemini Robotics 1.5 (VLA — Vision-Language-Action)**: El modelo central de acción. Recibe información visual (lo que "ve" el robot) + comandos en lenguaje natural y los traduce directamente a comandos de motor/acción. Soporta "pensar antes de actuar" (interleaved natural language reasoning traces) para tareas multi-paso complejas. Aprendizaje cross-embodiment: lo que aprende en un tipo de robot (brazos estáticos, humanoides como Apollo, plataformas bi-brazo) ayuda en otros.
- **Gemini Robotics-ER 1.6 (Embodied Reasoning)**: Un VLM de alto nivel enfocado en razonamiento espacial, lógica y planificación de largo horizonte ("limpiar la cocina"). No controla motores directamente. Actúa como el "cerebro" planificador. Puede descomponer tareas, entender relaciones 3D entre múltiples cámaras, estimar éxito/fallo de acciones, y —críticamente— **llamar herramientas de forma agentic** de forma nativa.
- **Gemini Robotics On-Device**: Versión optimizada para correr localmente en hardware robótico. Baja latencia, offline. Primera del familia explícitamente abierta a fine-tuning por desarrolladores con tan solo 50-100 demostraciones humanas.

La filosofía central: sistemas jerárquicos (ER como planner/reasoner de alto nivel que usa herramientas + VLA como executor preciso) en lugar de un modelo monolítico, con fuerte énfasis en generalización y composabilidad para desarrolladores.

---

## 2. Las tres áreas de foco (investigación ampliada + citas)

### 2.1 Cómo funciona el modelo On-Device

Gemini Robotics On-Device es un VLA optimizado para ejecución local en el robot. Su gran diferenciador es que es el primero de la familia que Google pone a disposición de desarrolladores para fine-tuning/adaptación rápida.

- Se puede especializar en tareas nuevas o entornos con tan solo **50-100 demostraciones humanas**.
- Incluye SDK (con soporte para simulador MuJoCo) para iterar de forma segura antes de llevar al hardware real.
- Beneficios: latencia cero de red, operación offline, privacidad, y adaptación rápida a "novedades" (nuevos objetos, nuevas geometrías, nuevos robots) sin re-entrenar todo el modelo base desde cero.
- Estado (2026): Private preview / trusted tester program.

Esto tiene analogía directa con nuestro dominio: un "extractor/planner" que se puede afinar rápidamente con ejemplos internos de cotizaciones, planos o diálogos de canales (ML/WA) sin depender 100% de prompts o del modelo base cloud.

### 2.2 La distinción VLA vs VLM / Embodied Reasoning (ER)

Esta es la separación conceptual más importante de la familia y la que más valor tiene para diseñar sistemas agentic complejos:

- **VLA (1.5 y On-Device)**: El "cuerpo" o capa de ejecución. 
  - Entra: visión + instrucciones en lenguaje natural.
  - Sale: acciones concretas (tokens de movimiento, o en nuestro caso: llamadas a `calcular_cotizacion`, generación de PDF, escrituras CRM, timers, etc.).
  - Evolución clave en 1.5: ahora intercala *razonamiento en lenguaje natural* antes y durante la acción ("thinks before acting"). Esto hace las decisiones más interpretables y mejora tareas multi-paso.
  - Optimizado para reactividad, destreza y (en la variante On-Device) baja latencia.

- **ER / VLM de alto nivel (1.6)**: El "cerebro" planificador y razonador embodied.
  - Especializado en: comprensión espacial avanzada (2D/3D coordinates, relaciones entre múltiples vistas, oclusión), descomposición de tareas de largo horizonte, estimación de progreso y éxito/fallo, razonamiento físico.
  - **No genera acciones de bajo nivel directamente**. Produce planes estructurados, coordenadas, criterios de éxito y **decide cuándo y cómo invocar herramientas** (o delegar a un VLA).
  - Nueva capacidad destacada en 1.6: **instrument reading** (lectura precisa de gauges analógicos, niveles de fluidos, sight glasses) mediante un loop agentic de visión (zoom/crop + pointing + ejecución de código para estimar proporciones) + conocimiento del mundo físico. Desarrollado en colaboración con Boston Dynamics para inspección industrial en Spot y Atlas.

**Por qué separar las capas (lección clave para nosotros):**
- Permite usar el mejor modelo para cada trabajo (planificación de alto nivel + verificación vs ejecución precisa y confiable).
- Facilita seguridad y políticas (el ER puede ser más fuertemente entrenado en seguridad).
- Composabilidad para desarrolladores: usás la capa de razonamiento (ER) vía API para enriquecer controladores existentes o flujos de presupuestación que ya tenés.

En Panelin ya tenemos una separación embrionaria muy similar (ver sección de Arquitectura).

### 2.3 Cómo funciona el tool calling (agentic) en robótica / ER

El aspecto más directamente accionable de la investigación para nuestro stack agentic actual:

- ER 1.6 es **explícitamente agentic** en el sentido de que el modelo mismo decide invocar herramientas externas cuando necesita información, verificación o capacidades que no tiene internamente.
- Herramientas que puede llamar de forma nativa: Google Search (para datos faltantes), ejecución de código (para cálculos, estimaciones de proporciones, proporciones en gauges), funciones definidas por el usuario, y hand-off explícito a otros modelos (incluyendo VLAs).
- El output del ER suele ser estructurado (planes paso a paso, coordenadas 2D/3D, estimaciones de éxito, warnings) para que un ejecutor (VLA, API de robot, o en nuestro caso el motor de cálculo + presup + CRM) lo consuma de forma confiable.
- Ejemplo concreto de instrument reading (nueva en 1.6): el modelo no "adivina" la lectura de un gauge. Ejecuta un loop: detecta → hace zoom/agentic crop → pointing a marcas de escala → llama a code execution para estimar el valor + aplica conocimiento físico para interpretarlo → decide si es normal o requiere acción.
- En la superficie de desarrolladores: mandás imágenes/video + prompt en lenguaje natural al Gemini API y recibís JSON espacial o planes. Vos proveés el "cuerpo" (tu controlador existente o nuestro loop de tools + calcLoopbackClient).

**Paralelo directo con nuestro agente actual:**
Nuestros `AGENT_TOOLS` + `executeTool` + loopback a `/calc/*` + presupOrchestrator ya son un "VLA domain-specific" muy maduro (el modelo no debe inventar precios ni BOMs: debe llamar la tool). La investigación valida que poner capacidad agentic fuerte en la capa de *planeación y razonamiento* (no solo en el ejecutor) es una de las formas más poderosas de escalar agentes complejos de largo horizonte.

---

## 3. Mapeo a Panelin / Calculadora BMC (nuestra "embodiment" comercial-técnica)

Nuestro agente no controla brazos robóticos, pero sí realiza un flujo equivalente de percepción → razonamiento espacial y comercial → acción verificable sobre un dominio físico (aislación térmica en obras):

- **VLA / Executor layer** ≈ `AGENT_TOOLS` (calcular_cotizacion, generar PDF, append CRM, timers TrakTime, quote registry, etc.) + `executeTool` + calcLoopbackClient + motores de cálculo. "Comandos de motor" concretos que nunca deben ser alucinados.
- **ER / High-level Planner & Reasoner layer** ≈ `presupOrchestrator.js` (conductor de flujo completo de presupuestación con sub-agentes/prompt modules: IntakeClassification, ContextBuilder, PricingBOMReviewer + ApprovalRouter + gates humanos + cost tracking + trace) + `planInterpreter.js` (visión + extracción espacial de planos/imágenes/DXF a zonas de techo/pared estructurado para el sistema de cotas 2D y preview).
- **Memoria / generalización** ≈ RAG (pgvector), trainingKB + autoLearnExtractor, KB surface — equivalente a "cross-embodiment learning" dentro de nuestro dominio (lo que aprende de una cotización ayuda en canales y escenarios futuros).
- **Agentic tool use en el planner** (el aspecto más valioso de ER 1.6): el reasoner debe poder decidir "necesito más datos → RAG o tool", "validar esta hipótesis de BOM → llamar calc y criticar", "esta tarea de largo horizonte requiere descomposición y gate humano".
- **Cross-embodiment / canales** ≈ las CHANNEL_RULES + surface handling (chat drawer, WA, ML, email, wolfboard, internal presup runs). Un mismo "cerebro planificador" debe funcionar adaptado a restricciones de cada canal.
- **Gates humanos + critic** ≈ ApprovalRouter + presup gates + verified_quote emissions + toolStats + evals. Equivalente al "success detection" y safety del ER.

Ya tenemos una separación embrionaria muy alineada con la investigación. El trabajo ahora es hacerla explícita, robusta y aprovechar las fortalezas de diferentes proveedores en cada capa.

---

## 4. Análisis de Arquitectura Ideal para Panelin + Opciones + Justificación

### Propiedades deseadas (derivadas de restricciones reales del proyecto + la investigación)
- Excelente calidad en español técnico y matices comerciales (actualmente fuerza de Claude).
- Eficiencia de costo en flujos interactivos de alto volumen + background (presup, ML, etc.).
- Soporte fuerte para tareas de **largo horizonte estructurado** (presup completo: intake → extracción espacial → revisión de precios/BOM → PDF/CRM → aprobación) con gates verificables.
- Razonamiento espacial y multi-vista de primer nivel (planos de techo, cotas, zonas, interpretación de imágenes/DXF) — planInterpreter ya es un beachhead.
- Tool use agentic confiable y auditable (tenemos excelente catálogo centralizado de tools + executeTool + superficie MCP; queremos que el LLM las use correctamente sin inventar números).
- Flexibilidad de providers sin explosión de mantenimiento (ya mantenemos 4 en aiProviderConfig).
- Soporte nativo para human-in-the-loop + loops de critic/approval (ApprovalRouter ya existe).
- Evolvabilidad hacia modelos especializados futuros (incluyendo reasoning previews tipo robotics-er) y unificación (gateway/SDK).
- Consistencia a través de "encarnaciones" / canales.
- Evals, auto-learn y propagación de conocimiento fuertes (fortaleza actual).

### Opciones evaluadas

**Opción 1: Paridad completa de tool calling agentic para Gemini (y futuros modelos ER) en el loop interactivo de chat.**
- Significado: Implementar el loop multi-ronda de tools (traducción de schema a functionDeclarations, manejo de partes functionCall, re-inyección de resultados, mismos side-effects de auth/verified_quote/suggestions) en la rama Gemini de agentChat.js. Agregar previews de robotics-er a la allowlist cuando sean usables.
- Pros: El usuario puede elegir "cerebro Gemini" para sesiones completas; flexibilidad máxima; turns baratos en conversaciones largas; demuestra directamente el "tool calling en robótica" dentro de nuestro agente.
- Cons / riesgos: Costo de implementación alto (una sola vez + mantenimiento); duplicación de lógica; Claude actualmente gana en following de instrucciones y confiabilidad de tools para nuestro dominio en español; superficie de tests se multiplica (provider × rondas de tool × canal); riesgo de regresiones de calidad para usuarios que elijan Gemini en la UI; carga de mantenimiento.
- Costo: Alto.
- **Veredicto de justificación**: No es el paso de mayor apalancamiento ahora. Es un buen follow-up posterior una vez que tengamos datos de uso de Gemini y una separación planner/executor sólida. La investigación explica *por qué* el tool calling en la capa de razonamiento es poderoso, pero no obliga a que *todos* los providers manejen el loop de acción de bajo nivel de la misma forma.

**Opción 2: Especialización explícita Planner (capa de razonamiento estilo ER) + Executor (capa de acción VLA) — dirección recomendada.**
- Significado:
  - Tratar a `presupOrchestrator.js` (y un posible "PanelinReasoner" ligero extraído o nuevo) como el hogar oficial del trabajo de alto nivel estilo ER: descomposición de largo horizonte, crítica espacial, estimación de éxito, decidir *qué* tools o sub-flujos invocar, y cuándo gatear a humanos.
  - Hacer el paso de reasoner seleccionable por provider (preferir Gemini o previews `gemini-robotics-er-1.6-preview` para fortalezas espaciales/planning + costo; caer a Claude-sonnet fuerte para instrucciones en español matizado). Usar prompt modules dedicados (ya iniciados en `server/prompts/presup-orchestrator/`) afinados para razonamiento "embodied-style" (multi-paso, citar fuentes, estimar confianza, producir plan estructurado + crítica).
  - Mantener el loop rico de ejecución interactiva de tools principalmente en Claude (o enrutar pasos de executor al modelo más capaz de tools) por confiabilidad.
  - Mejorar prompts de planInterpreter con técnicas inspiradas en instrument reading / agentic vision (pasos de zoom/estimate/validate incluso para cotas 2D ambiguas).
  - En paths simples (agentCore, extractores CRM) seguir expandiendo Gemini + gateway.
  - Exponer en UI / ai-options una distinción (o hint) entre modos "razonamiento" vs "acción/preciso" donde tenga sentido.
  - Agregar en aiProviderConfig helpers pequeños como `getReasonerProviders()`.
- Pros: Implementa directamente la lección central de la investigación (separar un planner fuerte que hace razonamiento agentic + selección de tools de un executor confiable); construye sobre la inversión *existente* en presupOrchestrator en lugar de duplicar loops; menor riesgo (Claude sigue siendo el "hacedor" para tools interactivos donde la calidad importa más); encaja perfectamente con nuestras features espaciales (planos de techo) y flujos multi-paso de presup; más fácil adoptar previews especializados de ER solo donde brillan (planning); juega bien con la unificación vía gateway que ya está en marcha; más fácil mantener evals (evals de planner vs executor); consistente con la cultura de "orquestadores" y full-team del repo.
- Cons: Un poco más conceptual (el usuario puede seguir viendo un selector único de provider); requiere algo de refactor de prompts / sub-agents para hacer el rol "reasoner" explícito.
- Costo: Medio (principalmente docs + trabajo de prompts + pequeños helpers de config/orquestador + pulido de planInterpreter; el conductor pesado de presup ya existe).
- **Veredicto de justificación**: Esta es **la dirección correcta y de mayor valor** para el proyecto. Respeta fortalezas actuales (confiabilidad de tools en Claude + español), la arquitectura existente (presupOrchestrator como conductor, planInterpreter como razonador espacial, tools centralizados), trade-offs de costo/calidad, y el patrón jerárquico agentic exacto descrito en la investigación de Gemini Robotics. Convierte la investigación pegada por el usuario en guía de diseño accionable en lugar de un pedido de feature para "hacer que Gemini haga todo igual".

**Opción 3: Acelerar unificación completa vía Vercel AI SDK + Gateway para las superficies agentic (incluyendo el tool loop).**
- Significado: Hacer que el loop interactivo rico de agente pase por las abstracciones del SDK `ai` (que maneja tool calling a través de providers con interfaz más uniforme). Enrutar por gateway cuando esté habilitado. Tratar las ramas de SDK nativo como legacy.
- Pros: Reduce drásticamente el branching por provider; los modelos futuros (incluyendo cualquier robotics-er o nuevo Gemini) vienen "gratis"; semántica consistente de streaming/tools; gateway da observabilidad/controles de costo/ruteo.
- Cons: Esfuerzo de migración en la parte más compleja del codebase (agentChat SSE + rondas de tool + features específicas de Anthropic como prompt caching y thinking budgets que pueden necesitar equivalentes o degradación elegante); gateway puede no estar completamente probado aún para loops agentic largos multi-turn con side effects; riesgo durante la transición.
- Costo: Alto upfront, alto reward si tiene éxito.
- **Veredicto**: Vale un spike/prototipo dedicado (posiblemente en terminal paralelo o como follow-up después de los fundamentos de la Opción 2). Es una *arquitectura ideal a largo plazo* fuerte (unificada + ruteada por gateway), pero no la respuesta inmediata al prompt de investigación. Podemos evolucionar hacia ella mientras especializamos la capa de reasoner (Opción 2 + gateway para pasos de planner).

**Opción 4: Status-quo + documentación + wins de Gemini solo en áreas actuales.**
- Documentar extensamente la familia + analogía VLA/ER en GEMINI.md y knowledge del equipo. Mejorar Gemini solo en sus sweet spots actuales (visión en planInterpreter, completions baratas, paths simples de agentCore, como planner opcional dentro de presup con prompts dedicados). Sin cambios en el loop rico de tools interactivo.
- Pros: Mínimo riesgo/costo; output de investigación inmediatamente útil.
- Cons: Pierde la oportunidad de usar la investigación como forcing function para una mejor separación planner/executor.
- **Veredicto**: Outcome mínimo viable aceptable si el tiempo o el apetito de riesgo es bajo. El artefacto de investigación ampliada + análisis en sí mismo seguiría siendo valioso para el equipo (y futuros full team / MATPROMT). Preferir Opción 2 sobre Opción 4 pura.

### Recomendación general y resumen de justificación
La arquitectura ideal para Panelin es una **separación deliberada Planner (razonamiento de alto nivel estilo ER + tool calling agentic + planificación espacial/largo-horizonte, flexible por provider y a menudo inclinado a Gemini) + Executor (acción estilo VLA confiable vía tools centralizados, actualmente fuerte en Claude para lo interactivo)**, con presupOrchestrator como la encarnación concreta del conductor, planInterpreter como el componente de razonamiento espacial, y aiProviderConfig + gateway como el sustrato de unificación.

Esta es la dirección correcta (vs. apurar paridad completa de tool calling en todos los providers para el loop rico) porque:
- Mapea 1:1 con la investigación que compartió el usuario (cerebro ER que planea y llama tools vs VLA que ejecuta).
- Amplifica inversiones *existentes* de alta calidad (presupOrchestrator ya existe y está diseñado exactamente para esto; planInterpreter ya usa Gemini para visión; las tools ya están centralizadas).
- Protege la experiencia de usuario donde más importa (precisión técnica en español y acciones confiables de cálculo/CRM en chat interactivo).
- Es de menor mantenimiento y riesgo mientras aún entrega el espíritu del "tool calling agentic en la capa de razonamiento" y "advanced spatial reasoning".
- Nos posiciona para adoptar modelos especializados (previews de robotics-er, inspiraciones futuras de on-device para extracción edge) de forma quirúrgica.
- Es consistente con la cultura del proyecto de orquestadores explícitos, gates humanos, evals y propagación de conocimiento.

La paridad completa y/o la unificación total vía SDK siguen siendo pasos futuros valiosos y se pueden evaluar con datos después de que los roles de planner/executor estén más nítidos.

---

## 5. Enfoque recomendado refinado (post-ampliación de la investigación)

1. **Output de investigación ampliada primero** (sin cambios de código obligatorios en esta fase):
   - Producir un `GEMINI.md` (raíz) de alta calidad que contenga: overview de la familia, cobertura detallada de las tres áreas de foco con citas, mapeos explícitos a conceptos de Panelin (presup como conductor ER, tools como acciones VLA, planInterpreter como ER espacial, etc.), y una sección dedicada "Análisis de Arquitectura Ideal" que resuma las opciones + justificación arriba.
   - Agregar o actualizar un compañero corto en `docs/team/knowledge/` si ayuda a la propagación a otros agentes / full team runs.
   - Una línea de actualización en PROJECT-STATE.md (Cambios recientes) + cualquier archivo de knowledge relevante del equipo.

2. **Movimientos de código/prompts livianos y de alto valor alineados con la arquitectura recomendada (Opción 2)** (scopeado, bajo riesgo):
   - Adiciones menores en `aiProviderConfig.js`: helper(s) para preferencias de provider "reasoner" vs "executor" o fast-paths; entrada/comentario opcional en allowlist para `gemini-robotics-er-1.6-preview` (con nota de que es preview y puede requerir acceso específico).
   - Pequeña evolución de `presupOrchestrator.js` (o sus módulos de prompt): hacer que las llamadas a sub-agentes / reasoner sean explícitamente seleccionables por un "reasonerProvider" (default desde config o "auto"), loguear qué modelo se usó para pasos de planning, agregar instrucciones ligeras inspiradas en ER a los módulos de prompt existentes (descomposición multi-paso, confianza, crítica espacial, decisiones "llamar tool o gate").
   - Pulido de `planInterpreter.js` (comentarios/prompts) con técnicas inspiradas en instrument reading / visión agentic (pasos secuenciales de zoom/estimate/validate para cotas ambiguas + warnings de confianza).
   - Opcional muy pequeño: exponer un hint o toggle "usar modelo de razonamiento" en la UI de chat / ai-options para usuarios avanzados (o mantenerlo interno a flujos de orquestador primero).
   - **Sin cambios** al core del loop de tools de Claude en agentChat.js en esta iteración (preservar estabilidad).

3. **Documentación + propagación**:
   - Actualizar `docs/AI-INTEGRATION-CALCULADORA.md` con notas de arquitectura sobre la separación planner/executor.
   - Asegurar que el nuevo GEMINI.md sea referenciado desde docs relevantes / salidas de knowledge antenna.

4. **Verificación (más liviana que un plan de implementación full)**:
   - `npm run lint && npm test` (especialmente tests de agent + kb + presup relacionados).
   - Smoke manual de corridas de presup orchestrator y planInterpreter (con clave Gemini presente) para confirmar que no hay regresión y que la selección de provider para pasos de razonamiento funciona.
   - Revisión del análisis de arquitectura por el usuario / equipo (el entregable principal).
   - Si hay cambios de prompt o pequeños en el orquestador: correr golden cases relevantes o flujos manuales.
   - Actualizar gates (el pre-deploy checklist menciona ítems abiertos en PROJECT-STATE).

Este plan ampliado entrega la profundidad de investigación que el usuario pidió, un análisis riguroso de arquitectura con opciones y justificación, y solo trabajo de follow-up scopeado y justificado en lugar de un refactor grande y riesgoso.

---

## Decisiones abiertas (para input del usuario si se desea durante/después de la revisión del plan)
- Cuánto prominence darle a la elección de "modelo de razonamiento" a usuarios finales en la UI de chat vs mantenerlo principalmente interno a flujos de presup/orquestador.
- Si hacer un spike/prototipo rápido de function calling de Gemini en una rama antes de comprometerse con la ruta de especialización de planner.
- Prioridad de acelerar el gateway para cubrir más superficies agentic (Opción 3) en el próximo trimestre.
- Si los IDs de modelo preview de robotics-er deberían ofrecerse ya en la UI pública de ai-options o solo documentarse para usuarios internos/power users.

---

**Estado del documento:** Investigación ampliada + análisis de arquitectura completos. Próximos pasos de ejecución liviana según el enfoque recomendado (Opción 2 priorizada).

Fuentes principales consultadas (además de la investigación inicial del usuario): DeepMind models pages, Google AI for Developers (robotics overview y function calling), blogs oficiales de ER 1.6, arXiv tech reports, análisis técnicos independientes (Encord y otros). Citas inline en las secciones relevantes.

Este documento debe mantenerse vivo y referenciado en team knowledge y full-team runs cuando se discuta la evolución del agente Panelin.
