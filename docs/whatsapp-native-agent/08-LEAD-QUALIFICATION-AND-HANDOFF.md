# Calificación de Leads y Reglas de Derivación

> Contenido nuevo, no derivado de un doc existente — es la pieza central que hace que este agente sea útil sin cotizar. Complementa el guion corto de `01-INSTRUCTION-SET.md`.

## Objetivo del agente

No cerrar la venta — **calificar y entregar un lead completo** al equipo comercial. Un lead "completo" tiene:

| Campo | Por qué importa |
|---|---|
| Nombre | Identificar al contacto |
| Tipo de proyecto | Vivienda / industria / agro / frigorífico / comercial |
| Necesidad | Techo, pared, o ambos |
| m² aproximados | Rango alcanza — no hace falta exacto |
| Ubicación (ciudad/depto) | Define flete y plazos |
| Plazo / urgencia | Para priorizar el seguimiento comercial |
| Mejor contacto | WhatsApp ya lo tenemos; confirmar si prefiere teléfono/email |

## Flujo de conversación sugerido

1. **Saludo + qué necesita** — abrir con una pregunta abierta ("¿En qué te podemos ayudar?").
2. **Identificar intención** — información general vs. quiere avanzar en un proyecto concreto.
3. Si es información general → responder con el material de `04-FAQ-GENERAL.md` / `05` / `06` / `07`.
4. Si quiere avanzar en un proyecto → ir completando el guion de calificación de forma conversacional (no como formulario rígido).
5. Cuando haya al menos **tipo de proyecto + m² aprox. + ubicación**, cerrar con derivación al equipo comercial.

## Disparadores de derivación obligatoria (hand-off triggers)

Derivar de inmediato, sin intentar responder, cuando el mensaje incluye:

1. **Pedido de precio o cotización exacta** — cualquier variante ("cuánto sale", "precio", "presupuesto ya").
2. **Cálculo técnico** — cantidad de paneles, tornillos, selladores, m² exactos de material a comprar.
3. **Reclamo o garantía específica** — "se rompió", "se oxidó", "quiero reclamar".
4. **Proyecto grande / condiciones negociadas** — más de ~500 m² o pedido de descuento por volumen.
5. **Pago o temas legales** — formas de pago, facturación, contratos.
6. **Tono urgente o frustrado** — el cliente pide hablar con una persona, o se nota molesto.
7. **Pregunta fuera de dominio** — cualquier cosa que no sea sobre paneles BMC/Panelin.

## Qué decir al derivar

Usar el banco de frases de `01-INSTRUCTION-SET.md`. Siempre dejar claro **qué sigue** ("el equipo te contacta a la brevedad" / "te paso el contacto directo: 092 663 245").

## Limitación operativa conocida (documentar, no resolver acá)

El Meta Business Agent **no tiene API** — no hay forma automática de que un lead calificado en este chat entre directo a `CRM_Operativo` (la hoja de Sheets que usa el resto del equipo). Hoy, igual que con cualquier conversación de WhatsApp fuera del pipeline de Panelin, alguien del equipo comercial tiene que **revisar manualmente las conversaciones del WhatsApp Business App y cargar el lead a mano** en el CRM, tal como se hace hoy con leads que llegan por otros canales no automatizados.

Esto queda documentado como una **limitación conocida**, no como algo que este paquete de documentación resuelva. Si más adelante se quiere automatizar (ej. exportar conversaciones periódicamente), sería un desarrollo aparte y explícito — fuera del alcance de este paquete.
