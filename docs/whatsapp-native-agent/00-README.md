# Agente Nativo de WhatsApp (Meta) — Paquete de Conocimiento

> **Estado:** documentación provisoria, en paralelo al desarrollo de Panelin. **No reemplaza ni modifica** el agente Panelin (Cloud API + WA Cockpit), `trainingKB.js`, RAG, ni ningún sistema de producción de este repo. Es un paquete de contenido curado, listo para cargar manualmente en el **Meta Business Agent** del WhatsApp Business App.

## Qué es esto

Meta ofrece un agente de IA nativo, sin código, configurable directamente dentro de la app de WhatsApp Business (sección Herramientas). Referencia: https://whatsappbusiness.com/products/business-app-ai-agent/

Ese agente **no tiene API** — se alimenta y configura manualmente desde:

1. **Contenido de la Página de Facebook** — posts, información del negocio.
2. **Historial de conversaciones pasadas de WhatsApp** — de la misma cuenta/número.
3. **Información del sitio web** — lo que Meta pueda rastrear públicamente.
4. **Documentos y fotos subidos manualmente** — el canal principal para este paquete.
5. **Catálogo de productos y listas de precios** — vía Meta Commerce Manager (opcional).

**Rol de este agente en BMC:** responder consultas generales de producto/proceso y **calificar leads** (extraer nombre, tipo de proyecto, m² aproximados, ubicación, plazo y contacto) para que el equipo comercial cotice manualmente. **Nunca da precios exactos ni cotiza.** Eso es trabajo de Panelin (calculadora + equipo humano).

## Mapa de documentos → canal de ingesta de Meta

| Archivo | Contenido | Canal de ingesta objetivo |
|---|---|---|
| `01-INSTRUCTION-SET.md` | Personalidad, tono, límites, guion de calificación | Config "personalidad e instrucciones" dentro de la app |
| `02-COMPANY-OVERVIEW.md` | Quiénes somos, diferenciales, zona de servicio | Página de Facebook + sitio web + doc subido |
| `03-PRODUCT-CATALOG-SUMMARY.md` | Familias de paneles y usos, sin precios exactos | Catálogo de productos / doc subido |
| `04-FAQ-GENERAL.md` | Preguntas frecuentes técnicas y de producto | Doc subido |
| `05-TECHNICAL-SPECS-AND-MAINTENANCE.md` | Fichas técnicas + mantenimiento | Doc subido |
| `06-CONSTRUCTION-PROCESS.md` | Proceso constructivo, a grandes rasgos | Doc subido |
| `07-OBJECTIONS-AND-CONVERSATION-PATTERNS.md` | Cómo responder objeciones sin cotizar | Doc subido |
| `08-LEAD-QUALIFICATION-AND-HANDOFF.md` | Guion de calificación + reglas de derivación a humano | Config + doc subido |
| `09-AUDIENCE-AND-ESCALATION-CONFIG.md` | Config recomendada dentro de la app | Config manual |
| `10-SOURCING-MAP.md` | Trazabilidad: de dónde salió cada dato | Referencia interna, no se sube a Meta |

## Procedimiento de carga (resumen, ~3 pasos según Meta)

1. Abrir WhatsApp Business App → **Herramientas** → **Agente de IA**.
2. Configurar personalidad/instrucciones pegando el contenido de `01-INSTRUCTION-SET.md`.
3. Subir como documentos los archivos `02` a `07` (exportar a PDF si la app no acepta `.md` directo).
4. Conectar Página de Facebook y sitio web si están disponibles, para que Meta también aprenda de ese contenido.
5. Configurar audiencia y reglas de derivación según `09-AUDIENCE-AND-ESCALATION-CONFIG.md`.
6. Revisar respuestas la primera semana y corregir las que estén mal (Meta aprende de las correcciones).

## Distribución sugerida (sin automatizar)

BMC ya tiene integración con Google Drive (`server/lib/googleAuthCache.js`, panel de Drive en la calculadora — ver `docs/EXTERNAL-CONNECTIONS.md`). Se sugiere **copiar manualmente** esta carpeta a un folder de Drive dedicado (ej. "BMC — Agente WhatsApp Nativo (Meta)") para que quien administre la app de WhatsApp Business pueda descargar y subir los archivos sin tocar el repo. No se agrega ningún script ni automatización de sincronización en este paquete — es un paso manual, a propósito, para no interferir con el desarrollo activo.

## Actualización

Este paquete es una **foto puntual**. Ver `10-SOURCING-MAP.md` para saber de qué archivo salió cada contenido y cuándo conviene refrescarlo (cambios de catálogo, FAQ o precios en el repo fuente).
