# Mercado Libre — Buenas prácticas de plataforma (BMC Uruguay)

**Audiencia:** agentes IA (Cursor, PANELSIM), integraciones y operación comercial cuando el tema es **cómo funciona el marketplace** y **qué conviene hacer en la cuenta**, distinto del tono y texto de las respuestas en preguntas.

**Complementa (no reemplaza):**

- Voz, plantillas y reglas al **contestar preguntas:** [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md).
- OAuth, API y rutas `/ml/*`: [`../../../ML-OAUTH-SETUP.md`](../../../ML-OAUTH-SETUP.md) y skill **bmc-mercadolibre-api**.

**Principio:** este documento resume **criterios operativos BMC** en palabras propias. **No** copia cursos ni ayuda oficial; para normas, plazos y requisitos exactos siempre usar **Ayuda de Mercado Libre** y el **panel del vendedor**.

---

## 1. Alcance y límites

| Tema | Qué cubre este doc | Qué queda fuera |
|------|-------------------|-----------------|
| Políticas y reglas ML | Orientación general; remisión a fuentes oficiales | Texto legal, multas, tiempos exactos de mediación |
| Precios y cotizaciones | Coherencia con mensajes públicos (ver ML-RESPUESTAS) | Números: solo MATRIZ, calculadora, API catálogo — nunca inventados |
| Automatización Panelin | Qué expone el repo vía API | Configuración de envíos, stock y publicaciones en el sitio ML |

**Conector en este repo (técnico):** OAuth (`/auth/ml/*`) y datos vía `GET/POST` bajo `/ml/*` (preguntas, órdenes, ítems, etc.) según [`server/index.js`](../../../../server/index.js) y cliente ML. Eso **no** reemplaza: editar publicaciones, elegir modalidad de envío en el panel, resolver reclamos en la interfaz de ML, ni campañas de Mercado Ads.

**El agente no debe:** afirmar políticas ML específicas (ej. “tenés X horas para…”) sin verificar en ayuda oficial o en la cuenta; dar asesoramiento fiscal sobre Mercado Pago; prometer resultados de publicidad.

---

## 2. Mapa temático y Central de aprendizaje

La [Central de aprendizaje para vendedores (UY)](https://vendedores.mercadolibre.com.uy/aprender/search?offset=0&limit=18&filters=GUIDES%7CMODULES%7CCONTENTS%7CML%7CMP%7CME%7CMA&page=1) organiza contenido por tipo (cursos, módulos) y temática (**Mercado Libre**, **Mercado Pago**, **Envíos**, **Mercado Ads**, etc.). Conviene recorrerla **con sesión iniciada** para contenido completo.

| Temática (aprendizaje ML) | En la cuenta / plataforma (humano) | En Panelin / repo (agente + API) |
|---------------------------|-------------------------------------|-----------------------------------|
| **Mercado Libre** (publicaciones, reputación, preguntas) | Calidad de fichas, fotos, stock, tiempos de respuesta | Texto de respuestas: [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md); lectura preguntas/ítems vía `/ml/*` |
| **Mercado Pago** | Medios de cobro, liquidaciones, resoluciones en panel | Solo marco comercial; **no** normativa fiscal detallada |
| **Envíos (ME)** | Modalidad, costos, promesas al comprador | Las **promesas** deben coincidir con lo que luego se explica en preguntas (flete, plazos, retiro) |
| **Mercado Ads (MA)** | Presupuesto, creatividades, reporting | Escalar a humano comercial/marketing para decisiones de inversión |

---

## 3. Buenas prácticas (criterios BMC)

### 3.1 Publicaciones

- **Título y ficha:** claro qué se vende (producto, espesor, uso previsto si aplica). Evitar ambigüedad que después genera preguntas repetitivas o expectativas incorrectas.
- **Fotos y variaciones:** mostrar lo relevante (color, espesor, accesorios). Si hay variaciones, que el comprador pueda elegir sin tener que adivinar por mensaje.
- **Stock y disponibilidad:** mantener alineado con operación real; incoherencias generan cancelaciones y mala experiencia.
- **Descripción vs mensajería:** lo esencial en ficha; en preguntas profundizar con el mismo criterio que el KB de respuestas (datos antes de cotizar, sin inventar).

### 3.2 Envíos y promesas

- Lo configurado en ML (modalidad, plazos, zonas) debe ser **coherente** con lo que el vendedor (o el texto asistido) comunica en preguntas y postventa.
- Sobre **flete a obra** o **retiro**: alinear con [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md) (qué incluye / no incluye el presupuesto). No prometer envío incluido en el mensaje si la publicación o la operación dicen lo contrario.

### 3.3 Tiempos de respuesta y postventa

- Responder pronto en **preguntas** mejora conversión y reputación; los umbrales exactos y métricas están en ayuda ML y en el panel.
- Tras la venta: seguimiento según canales que ML habilite; el agente asistido debe evitar comprometer plazos o gestiones logísticas no confirmadas.

### 3.4 Reputación y reclamos

- Tratar reclamos y mediaciones con **documentación y tono profesional**; no discutir en público de forma agresiva.
- Para criterios de cancelación, devolución y arbitraje, **siempre** la fuente es ayuda ML y el estado del pedido en la cuenta — no inventar pasos.

### 3.5 Mercado Pago y cobros

- Objetivo operativo: que el flujo de cobro sea claro para el comprador y coherente con la publicación.
- **No** usar este documento como guía impositiva (IVA, facturación): eso es contador / [`bmc-dgi-impositivo`](../../../../.cursor/skills/bmc-dgi-impositivo/SKILL.md) según el caso, no el chat de marketplace.

### 3.6 Mercado Ads

- El agente puede recordar que existe la herramienta y que conviene revisar **objetivos y presupuesto** con quien define comercial.
- Decisiones de puja, creatividades y ROI: **humano** con acceso a panel y reportes.

---

## 4. Referencias oficiales (enlaces)

Usar estos enlaces para profundizar; no se reproduce aquí el contenido de terceros.

| Recurso | URL |
|---------|-----|
| Developers Mercado Libre Uruguay | https://developers.mercadolibre.com.uy |
| Ayuda Mercado Libre (sitio regional; buscar desde el pie o menú de ayuda según país) | https://www.mercadolibre.com.uy/ayuda |
| Central de aprendizaje vendedores UY (catálogo / búsqueda) | https://vendedores.mercadolibre.com.uy/aprender/search?offset=0&limit=18&filters=GUIDES%7CMODULES%7CCONTENTS%7CML%7CMP%7CME%7CMA&page=1 |

Si una URL de ayuda cambia, actualizar esta tabla y anotar fecha en el changelog (§5).

---

## 5. Changelog interno (BMC)

| Fecha | Nota |
|-------|------|
| 2026-04-07 | Versión inicial: doc creado; integrado con ML-RESPUESTAS, ML-TRAINING-SYSTEM, PANELSIM-FULL-PROJECT-KB, inventario agentes, chatPrompts (referencia), skill ML API. |

*Añadir una línea cuando cambie una política ML relevante para tono, envíos o procesos BMC.*
