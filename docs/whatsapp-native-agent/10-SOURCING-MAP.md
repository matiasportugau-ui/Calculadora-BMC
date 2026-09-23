# Mapa de Trazabilidad de Fuentes

> Referencia interna — no se sube al agente de Meta. Sirve para refrescar el paquete cuando cambien las fuentes originales en el repo. Esta carpeta es una **foto puntual** (snapshot), generada manualmente; no hay sincronización automática con `data/knowledge/`, `data/training-kb.json`, `src/data/constants.js` ni ningún sistema de producción.

| Doc en este paquete | Fuente(s) en el repo | Transformación aplicada |
|---|---|---|
| `01-INSTRUCTION-SET.md` | Nuevo (no derivado) — alineado con el rol definido por el usuario (no-quoting, lead qualification) | — |
| `02-COMPANY-OVERVIEW.md` | `data/knowledge/preguntas-frecuentes-clientes.md` (datos de contacto/fábrica), `CLAUDE.md` (identidad del proyecto) | Reescrito como copy institucional; falta revisión de marketing |
| `03-PRODUCT-CATALOG-SUMMARY.md` | `data/knowledge/fichas-tecnicas.md` | Se quitaron SKUs y precios; se mantuvieron espesores y datos técnicos |
| `04-FAQ-GENERAL.md` | `data/knowledge/preguntas-frecuentes-clientes.md` (137 líneas) | Preguntas comerciales/de precio reescritas para derivar; preguntas técnicas mantenidas |
| `05-TECHNICAL-SPECS-AND-MAINTENANCE.md` | `data/knowledge/fichas-tecnicas.md` + `mantenimiento-y-comparativas.md` | Fusionado y resumido; se quitaron cifras de ahorro en USD |
| `06-CONSTRUCTION-PROCESS.md` | `data/knowledge/proceso-constructivo.md` (160 líneas) | Simplificado a nivel "explicación al cliente"; se quitó el detalle paso a paso para instaladores y las cifras de rendimiento se marcaron como orientativas |
| `07-OBJECTIONS-AND-CONVERSATION-PATTERNS.md` | `data/knowledge/encuentros-tecnicos.md` (161 líneas) | Reenfocado de "cómo cotizar el encuentro" a "cómo responder y derivar sin cotizar"; se quitaron SKUs/precios |
| `08-LEAD-QUALIFICATION-AND-HANDOFF.md` | Nuevo (no derivado) | — |
| `09-AUDIENCE-AND-ESCALATION-CONFIG.md` | Nuevo, basado en las capacidades de configuración descritas en https://whatsappbusiness.com/products/business-app-ai-agent/ | — |

## Fuentes NO usadas (a propósito)

- `server/lib/trainingKB.js`, `data/training-kb.example.json`, `server/lib/rag.js`, `server/lib/agentCore.js`, `server/routes/wa.js` — son la KB/infraestructura de **Panelin en producción**. No se leyó su contenido para "clonar" texto porque ese sistema ya tiene su propio ciclo de vida (auto-learn, revisión, RAG). Este paquete es independiente a propósito.
- Precios exactos, SKUs y condiciones de pago de cualquier documento fuente — excluidos en todos los archivos de este paquete porque el agente nativo no cotiza.

## Cuándo refrescar este paquete

- Cuando cambie el catálogo de productos (`src/data/constants.js`) — nuevas familias, discontinuaciones.
- Cuando se actualicen sustancialmente `data/knowledge/*.md` (revisiones de FAQ, mantenimiento, proceso).
- Cuando cambien datos de contacto/garantía institucionales.
- Cadencia sugerida: revisión trimestral, o ante cualquier cambio material en precios/catálogo que vuelva obsoleta una respuesta "general" de este paquete.

## Cómo refrescar (proceso manual, no un script)

1. Releer los archivos fuente listados en la tabla de arriba.
2. Actualizar el/los documentos de este paquete afectados, revalidando que no se haya colado ningún precio o SKU.
3. Actualizar la fecha de esta tabla si corresponde.
4. Volver a copiar la carpeta a Drive y re-subir a Meta los archivos que cambiaron (ver `00-README.md`).
