# Evidence — tools manifest (R2/R6)

**Date:** 2026-07-23  
**Source of truth:** `server/lib/agentTools.js` → `AGENT_TOOLS`  
**Local count:** 55 (CONFIRMED 2026-07-23 via `node` import `AGENT_TOOLS`)  
**Prod count:** 55 (CONFIRMED 2026-07-23 `GET …/api/agent/tools-manifest` → `ok:true,count:55`)  
**Live OpenAPI:** `GET /api/agent/tools/openapi` (prod 200, OpenAPI 3.1.0, 55 tools in `x-agent-tools`)  
**Calc contract:** `docs/team/panelsim/AE-AGENT-CALC-CONTRACT.md`

> Child SDD `panelin-chat-agent` may lag on tool counts — **SoT is this file**.  
> Email tools CONFIRMED local: `email_panelsim_resumen`, `email_borrador_saliente`, `email_listar_hilos`, `email_leer_hilo`, `email_clasificar_mensaje`, `email_enviar`.

## Human-gate note

Tools with `user_confirmed` in schema (write path) marked **yes**. Runtime also uses intent classifier + `TOOLS_REQUIRING_AUTH` on MCP/exec-tool for a subset.

## Tool inventory (local HEAD)

| Tool | Description (truncated) | Key inputs | `user_confirmed` |
|------|--------------------------|------------|------------------|
| `calcular_cotizacion` | Calcula una cotización completa (BOM, área, cantidad de paneles, subtotal sin IVA, total con IVA 22%). Usar cuando el us… | scenario, listaPrecios, techo, pared, camara | no |
| `obtener_precio_panel` | Obtiene el precio exacto (USD/m² sin IVA) de un panel por familia, espesor y lista. También devuelve autoportancia, anch… | familia, espesor, lista | no |
| `listar_opciones_panel` | Lista todas las familias y espesores disponibles para techo o pared con precios web, venta y autoportancia. Usar cuando … | tipo, lista | no |
| `get_calc_state` | Devuelve el estado actual de la calculadora tal como lo envió el usuario: escenario, familia, espesor, zonas, pendiente,… | — | no |
| `generar_pdf` | Genera un PDF de cotización y devuelve una URL para compartir con el cliente. Llamar SOLO después de que calcular_cotiza… | scenario, listaPrecios, techo, pared, camara, flete, cliente | no |
| `obtener_escenarios` | Devuelve la lista canónica de escenarios de cotización con sus campos REQUERIDOS y OPCIONALES. Usar al inicio de cada co… | — | no |
| `obtener_catalogo` | Devuelve el catálogo completo de paneles (techo + pared) con familias, espesores válidos, colores permitidos, ancho útil… | lista | no |
| `obtener_informe_completo` | Dump completo de pricing + reglas de asesoría + fórmulas de cálculo + endpoints. Más pesado que catalogo, pero útil cuan… | lista | no |
| `presupuesto_libre` | Genera una cotización en formato BOM libre (líneas manuales): el usuario describe paneles + perfilería + fijaciones + se… | lista, librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, flete | no |
| `listar_cotizaciones_recientes` | Lista las cotizaciones generadas recientemente (registry persistente en GCS, sin TTL). Cada entrada incluye id, code, cl… | cliente, source, include_cancelled, limite, desde, hasta | no |
| `obtener_cotizacion_por_id` | Recupera el resumen + URL del PDF de una cotización por su pdf_id (UUID). Usar cuando el usuario referencia un id especí… | pdf_id | no |
| `aplicar_estado_calc` | Aplica datos extraídos de la conversación al estado live de la calculadora (auto-rellena el formulario). Emite las ACTIO… | scenario, listaPrecios, techo, pared, camara, flete, proyecto | no |
| `formatear_resumen_crm` | Formatea un bloque copy-pasteable listo para pegar en el CRM con los datos clave de la cotización: código, cliente, esce… | cliente, scenario, total, lista, pdf_url, drive_url, pdf_id, code | no |
| `guardar_en_crm` | Guarda la cotización en la planilla CRM_Operativo de BMC (Google Sheets). Crea una fila nueva con cliente, teléfono, tot… | cliente, telefono, ubicacion, scenario, lista, total, pdf_url, drive_url… | yes |
| `comparar_listas` | Calcula la MISMA cotización en lista web y lista venta y devuelve el delta (diferencia USD y %). Usar cuando el usuario … | scenario, techo, pared, camara | no |
| `buscar_cliente_crm` | Busca filas existentes en CRM_Operativo por nombre, teléfono o RUT antes de crear una nueva fila. Usar SIEMPRE antes de … | query, limite | no |
| `enviar_whatsapp_link` | Envía un mensaje de texto con el link de la cotización al WhatsApp del cliente vía WhatsApp Business Cloud API. REGLA OB… | to, pdf_url, cliente, total, scenario, text, user_confirmed | yes |
| `comparar_escenarios` | Calcula DOS escenarios distintos sobre el mismo proyecto y devuelve el delta. Usar cuando el usuario pregunta "¿cuánto e… | scenario_a, scenario_b, listaPrecios, techo, pared, camara | no |
| `cancelar_cotizacion` | Marca una cotización como cancelada en el registry persistente (no la borra). Usar cuando el cliente declina, los datos … | pdf_id, motivo, user_confirmed | yes |
| `obtener_pdf_html` | Devuelve el HTML crudo de una cotización por su pdf_id (no el link, sino el contenido). Útil cuando el agente necesita i… | pdf_id | no |
| `programar_seguimiento` | Programa un follow-up interno para el operador (recordatorio): "recordame en 3 días llamar a Juan", "agendá seguimiento … | title, detail, daysUntil, nextFollowUpAt, tags, user_confirmed | yes |
| `historial_cliente` | Devuelve el historial completo de un cliente: filas en CRM_Operativo + cotizaciones del registry, agrupadas y ordenadas … | cliente, limite | no |
| `recuperar_casos_similares` | Busca cotizaciones históricas similares usando búsqueda semántica (RAG sobre quote_embeddings en Postgres). Devuelve cas… | query, k, threshold | no |
| `leer_crm_taxonomia` | Lee la taxonomía de clasificación de una fila de CRM_Operativo (cols AL–AN): tipo de contacto (cliente/proveedor/lead/in… | row | no |
| `escribir_crm_taxonomia` | Escribe en CRM_Operativo las columnas AL–AN: tipo de contacto, tags (texto o lista) y notas libres. Solo actualiza los c… | row, tipo_contacto, tags, notas, user_confirmed | yes |
| `wa_lead_to_admin` | Crea una fila nueva en Admin 2.0 para un lead (WhatsApp u otro canal) cuando NO existe fila. Pasá consulta (obligatorio)… | consulta, telefono, cliente, origen, zona, campos_faltantes, user_confirmed | yes |
| `wolfboard_pendientes` | Lista filas pendientes del Wolfboard hub (Admin 2.0). scope=consulta (default) → solo filas con consulta del cliente; sc… | scope | no |
| `wolfboard_export` | Exporta el listado del Wolfboard hub como CSV (mismo criterio que wolfboard_pendientes). Usar cuando el operador pide "b… | scope | no |
| `wolfboard_sync` | Propaga las respuestas del Admin Wolfboard (col J) hacia CRM_Operativo (col AF), matcheando por consulta original. Opera… | user_confirmed | yes |
| `wolfboard_actualizar_fila` | Actualiza una fila específica del Admin Wolfboard. Permite escribir respuestaAI (col J), linkDrive (col K), estado (col … | rowNum, respuesta, linkDrive, estado, replaySnapshotUrl, user_confirmed | yes |
| `wolfboard_marcar_enviado` | Marca una fila Admin como enviada al cliente: la mueve al tab 'Enviados' y la borra del Admin. REQUIERE user_confirmed=t… | rowNum, user_confirmed | yes |
| `wolfboard_quote_batch` | Genera respuestas comerciales con IA (Claude Haiku) para todas las filas pendientes del Admin que tienen consulta válida… | force, user_confirmed | yes |
| `list_bug_reports` | Lista reportes recientes de bugs enviados por usuarios desde la interfaz (incluye logs capturados, ruta, severidad y URL… | limit, severity, routeContains | no |
| `email_panelsim_resumen` | Lee el resumen PANELSIM / bandeja IMAP (STATUS + reporte MD) para ver correos recientes relevantes a presupuestos. NO na… | reportMaxChars | no |
| `email_borrador_saliente` | Genera un BORRADOR de email (asunto + cuerpo) para pegar en Thunderbird/Gmail. NO envía correo. Usar cuando el operador … | hechos, role, tono, asunto_contexto | no |
| `email_listar_hilos` | Lista conversaciones Omni de canal email (bandeja unificada). Auth JWT con grant canales. NO controla Gmail DOM. Preferí… | limit, status | no |
| `email_leer_hilo` | Lee mensajes de un hilo Omni por conversation_id (abrir correo). Auth JWT canales requerida.… | conversation_id, limit | no |
| `email_clasificar_mensaje` | Clasifica texto de correo/consulta: consulta_cliente / alerta_admin / otro. Si suggestAdminLead, proponé wa_lead_to_admi… | text | no |
| `email_enviar` | ENVÍA respuesta en un hilo Omni email (Gmail/SMTP vía outbound). ACCIÓN DE ESCRITURA: REQUIERE confirmación explícita de… | conversation_id, text, user_confirmed | yes |
| `traktime_timer_current` | TraKtiMe: devuelve el timer en curso del usuario (si hay uno corriendo), con proyecto, inicio y segundos transcurridos. … | — | no |
| `traktime_timer_start` | TraKtiMe: inicia un timer para un proyecto (y tarea opcional). ACCIÓN DE ESCRITURA: requiere confirmación explícita del … | project_id, task_id, description, tags | no |
| `traktime_timer_stop` | TraKtiMe: detiene el timer activo del usuario y cierra la entrada. ACCIÓN DE ESCRITURA: requiere confirmación explícita.… | — | no |
| `traktime_list_entries` | TraKtiMe: lista las entradas de tiempo del usuario, filtrables por proyecto y rango de fechas. Lectura protegida.… | project_id, from, to, limit | no |
| `traktime_create_entry` | TraKtiMe: crea una entrada de tiempo cerrada (con inicio y fin explícitos), p. ej. para registrar trabajo pasado. ACCIÓN… | project_id, started_at, stopped_at, task_id, description, billable | no |
| `traktime_day_report` | TraKtiMe: reporte de jornada de un día (UY-local) — entradas ordenadas, gaps de coordinación/pausa, tiempo efectivo, spa… | date, user | no |
| `traktime_month_report` | TraKtiMe: reporte mensual de horas (para administración). Devuelve totales por día + rollup por cliente/proyecto y la UR… | month, user | no |
| `traktime_billable_report` | TraKtiMe: horas no facturadas agrupadas por proyecto+cliente con redondeo y monto USD (preview de facturación). Solo adm… | client_id, from, to | no |
| `traktime_suggest_entry` | TraKtiMe ('casi-automático'): reúne el contexto del usuario (timer en curso + entradas recientes + hora actual) para que… | lookback_hours | no |
| `traktime_activity_today` | TraKtiMe + ActivityWatch (opt-in, OFF por defecto): cuando el operador habilitó ActivityWatch, devuelve un resumen de la… | tz | no |
| `sheets_list_tabs` | Co-Work: lista las pestañas (tabs) de un workbook BMC allowlisted (admin = Wolfboard Admin, crm = CRM_Operativo). Usar c… | workbook | no |
| `sheets_read_range` | Co-Work: lee un rango A1 de un workbook allowlisted y devuelve values + headers. FUENTE DE VERDAD para números de planil… | workbook, range, maxRows | no |
| `sheets_find` | Co-Work: busca texto en un rango (case-insensitive) y devuelve filas hit con row number y preview. Usar para 'buscá a Ga… | workbook, range, query, maxHits | no |
| `sheets_get_pending_admin` | Co-Work: lista consultas pendientes del Admin (col I llena, col M vacía) con row + consulta. Equivalente a la cola de Ad… | — | no |
| `sheets_propose_write` | Co-Work: dry-run de escritura — devuelve el diff/values sanitizados SIN escribir. Usar antes de sheets_write_range para … | workbook, range, values | no |
| `sheets_write_range` | Co-Work: escribe values en un rango allowlisted. REQUIERE confirmación explícita del operador ("escribilo", "guardalo en… | workbook, range, values, user_confirmed | yes |
## Separate toolset — Chatwoot email agent

`server/lib/emailAgentTools.js` → `EMAIL_AGENT_TOOLS` (not counted in 55). Used by `/api/email-agent/chat`.

## MCP surface

- Script: `npm run mcp:panelin` → `scripts/mcp-panelin-http.mjs`
- Env names: `BMC_API_BASE`, `BMC_API_TOKEN`
- Protocol: list tools from manifest; invoke via `POST /api/agent/exec-tool`
