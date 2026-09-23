# Configuración Recomendada dentro de la App (manual)

> Estas son recomendaciones operativas para quien configure el agente dentro de WhatsApp Business App. No es código ni se aplica a este repo — es una guía para la persona que administre la herramienta de Meta.

## Audiencia (a quién responde el agente de IA)

Meta permite elegir: todos los clientes, solo clientes nuevos, o solo los que llegan desde anuncios (ads).

**Recomendación inicial:** empezar con **"solo clientes nuevos"** o **"solo tráfico de anuncios"** durante las primeras semanas, para poder revisar la calidad de las respuestas antes de exponerlo a toda la base de contactos (incluye clientes existentes que ya tienen una relación directa con el equipo comercial y podrían confundirse si de golpe les responde un bot). Ampliar a "todos" una vez validado.

**A decidir con el dueño del negocio:** esta elección final depende de cuántos leads nuevos llegan hoy por WhatsApp vs. clientes recurrentes — no es una decisión técnica.

## Reglas de derivación / handoff a configurar en la app

Configurar (si la herramienta lo permite) palabras o temas que fuercen el handoff automático a un humano, alineado con `08-LEAD-QUALIFICATION-AND-HANDOFF.md`:

- Menciones de precio, cotización, presupuesto.
- Menciones de reclamo, garantía, devolución.
- Palabras de frustración o pedido explícito de "hablar con una persona".

## Revisión y corrección de respuestas

Meta permite reescribir respuestas que no gustan, y el agente aprende de esas correcciones con el tiempo. Recomendación operativa:

- **Dueño del proceso:** una persona del equipo comercial (no de desarrollo) debería revisar las conversaciones semanalmente, sobre todo el primer mes.
- **Qué corregir primero:** cualquier respuesta que dé un precio, un plazo exacto, o un cálculo de material — son los errores más costosos (generan expectativas incorrectas en el cliente).
- Llevar un registro simple (puede ser una nota o planilla aparte, no hace falta que sea el CRM_Operativo) de qué se corrigió y por qué, para ir afinando `01-INSTRUCTION-SET.md` en la próxima actualización del paquete.

## Conexión de Página de Facebook y sitio web

- Si BMC tiene Página de Facebook activa, conectarla para que el agente también aprenda de esos posts (coherente con `02-COMPANY-OVERVIEW.md`).
- El sitio web (bmcuruguay.com.uy) también alimenta al agente si Meta puede rastrearlo — vale la pena revisar que el contenido público del sitio esté actualizado y no contradiga lo que dice este paquete.

## Historial de conversaciones pasadas

Meta también aprende del historial de WhatsApp de la **misma cuenta/número** conectada a la WhatsApp Business App. Importante verificar: si el número usado por la app de WhatsApp Business (donde se configura este agente nativo) es **distinto** del número que usa Panelin vía Cloud API, el historial de conversaciones que maneja Panelin **no** va a estar disponible para entrenar a este agente. Confirmar con el equipo técnico qué número(s) están en juego antes de asumir que ambos historiales se combinan.
