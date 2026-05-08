# Política comercial unificada — Chat / ML / Shopify

> Fuente única de verdad: [`comercial-chat-ml-shopify.json`](./comercial-chat-ml-shopify.json).
> Cargada en runtime por `server/lib/policyLoader.js`; consumida por `chatPrompts.js`, scripts ML y plantillas Shopify.

## Por qué existe

Antes, las reglas de IVA, listas, validez y tono estaban duplicadas como strings inline en múltiples lugares:
prompts del agente, scripts de respuesta automática a Mercado Libre, plantillas Shopify. Cualquier cambio requería editar
N archivos y los canales divergían. Este doc + el JSON los unifican.

## Reglas vigentes (resumen humano)

| Tema | Regla |
|---|---|
| Moneda | USD siempre |
| IVA | 22 %, discriminado, dos decimales |
| Lista de precios | NO mencionar el nombre interno (`web` / `venta`) al cliente final |
| Validez de cotización | 48 h |
| Flete | NO incluido salvo aclaración explícita |
| Stock | Sujeto a confirmación |
| Tono Panelin (in-app chat) | Consultivo, rioplatense, sin "entiendo" |
| Tono ML | Directo, máx 600 chars |
| Tono Shopify | Informativo, máx 800 chars |

## Cómo modificarla

1. Editar `comercial-chat-ml-shopify.json` y bumpear `version` (formato fecha `YYYY-MM-DD`).
2. Correr `npm test` — `tests/policyLoader.test.js` valida shape y campos requeridos.
3. Si se agrega un campo nuevo, **también** actualizar:
   - El renderer de prompt en `server/lib/chatPrompts.js` para que lo lea (PR siguiente cuando aplique).
   - Los scripts ML / Shopify que correspondan.
4. Documentar el cambio en `docs/team/PROJECT-STATE.md`.

## Checklist pre-release (5 preguntas estándar)

Antes de mergear cualquier cambio que toque texto comercial, validar manualmente que las 5 preguntas
responden igual en in-app chat, ML y Shopify:

1. ¿La respuesta incluye IVA discriminado en USD?
2. ¿Se evita mencionar "lista web" / "lista venta" / "lista BMC" al cliente?
3. ¿Se aclara si flete está o no incluido?
4. ¿Se enuncia validez de la cotización (horas)?
5. ¿Se aclara que stock está sujeto a confirmación?

Si alguna respuesta diverge entre canales, el PR no se mergea.

## Anti-patterns (a evitar)

- Hardcodear "22 %" o "48 h" en un prompt nuevo. Leer del policy loader.
- Mencionar el nombre interno de la lista al cliente.
- Cambiar el JSON sin bumpear `version` — rompe la traza de cambios.
- Agregar lógica de negocio (cálculo de precio, descuentos) en este doc. Acá solo viven **políticas**, no fórmulas.

## Ver también

- [`docs/team/runbooks/PANELIN-IA-OPS.md`](../runbooks/PANELIN-IA-OPS.md) — operación Cloud Run del agente.
- [`docs/team/panelsim/PANELIN-IA-PREFLIGHT-DOSSIER.md`](../panelsim/PANELIN-IA-PREFLIGHT-DOSSIER.md) — dossier preflight del programa enterprise-ready.
