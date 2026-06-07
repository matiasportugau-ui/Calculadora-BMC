/**
 * workflows.js
 *
 * DEFINICIÓN FORMAL DE LOS FLUJOS EXISTENTES EN LA APLICACIÓN BMC / PANELIN
 *
 * Este archivo es la fuente de verdad para los tutoriales interactivos.
 * Los flujos aquí definidos reflejan los procesos reales que existen hoy en el producto
 * (basado en código, AdminCotizacionesModule, walkthrough de 31 pasos y flujos de calculadora).
 *
 * Cada flujo está diseñado para guiar al usuario de forma secuencial cuando "Modo Tutorial" está activado.
 */

export const TUTORIAL_WORKFLOWS = {
  // ============================================================
  // FLUJO 1: GESTIÓN DE COTIZACIONES ENTRANTES (Principal para Ventas)
  // ============================================================
  'admin-cotizaciones-gestion': {
    id: 'admin-cotizaciones-gestion',
    title: 'Gestionar Cotizaciones Entrantes',
    description: 'Flujo completo del Admin de Cotizaciones: desde la llegada de leads hasta marcar como enviadas y sincronizar con CRM.',
    category: 'Ventas / Operaciones',
    estimatedMinutes: 7,
    source: 'AdminCotizacionesModule + 31-step walkthrough',
    steps: [
      {
        id: '01-landing',
        target: 'div.adminCot',
        title: 'Llegar al Módulo de Cotizaciones',
        content: 'Este es el tablero operativo principal para todas las consultas que llegan por WhatsApp, Mercado Libre y Email. Lee directamente de la planilla.',
        placement: 'center',
      },
      {
        id: '02-live-indicator',
        target: 'topbar-live',
        title: 'Indicador de Estado en Vivo',
        content: 'Verde = todo bien y datos cargados. Amarillo = procesando (batch IA, sync, etc.). Rojo = hay un problema de token o conexión.',
        placement: 'bottom',
      },
      {
        id: '03-kpis',
        target: 'kpi-pendientes',
        title: 'KPIs Críticos',
        content: 'Pendientes = acción requerida. Con Error = IA falló. ≥14 días = riesgo alto de perder la oportunidad. Estos son tus indicadores de prioridad.',
        placement: 'bottom',
      },
      {
        id: '04-command-palette',
        target: 'topbar-cmdk',
        title: 'Paleta de Comandos (⌘K)',
        content: 'Presioná Cmd/Ctrl + K en cualquier momento para acceder rápido a todas las acciones: Generar IA, Sincronizar CRM, Exportar, Cambiar vista, etc.',
        placement: 'bottom',
      },
      {
        id: '05-saved-views',
        target: null,
        title: 'Vistas Guardadas (Tanda 1)',
        content: 'Usá las vistas rápidas: "Mis Leads", "Urgentes (7d+)", "Sin movimiento", "En Borrador". Son filtros inteligentes para no perderte oportunidades.',
        placement: 'center',
      },
      {
        id: '06-batch-ia',
        target: 'TOOLBAR_BATCH_GENERATE',
        title: 'Generar Respuestas con IA en Lote',
        content: 'El botón más importante del día. Procesa todas las consultas pendientes con Claude. Usá "Forzar" para reprocesar las que fallaron.',
        placement: 'bottom',
        action: 'Recomendado: correrlo al menos 1-2 veces por día',
      },
      {
        id: '07-table-row',
        target: null,
        title: 'Lista de Cotizaciones',
        content: 'Cada fila es una consulta entrante. Podés filtrar, buscar y ordenar. El color indica el estado de salud de la oportunidad.',
        placement: 'top',
      },
      {
        id: '08-open-drawer',
        target: 'row-edit-drawer',
        title: 'Abrir el Drawer de Detalle',
        content: 'Hacé click en cualquier fila para abrir el detalle completo: consulta original, sugerencia de IA, historial y acciones.',
        placement: 'right',
      },
      {
        id: '09-drawer-actions',
        target: 'drawer-aprobar',
        title: 'Acciones en el Drawer',
        content: 'Podés: Editar la respuesta de IA, Aprobar, Marcar como Enviada, o abrir el Borrador híbrido si existe.',
        placement: 'left',
      },
      {
        id: '10-mark-sent',
        target: 'drawer-marcar-enviada',
        title: 'Marcar como Enviada',
        content: 'Cuando respondiste al cliente (por WA o email), marcá la fila como enviada. Esto la saca del embudo de pendientes y actualiza los KPIs.',
        placement: 'left',
      },
      {
        id: '11-crm-sync',
        target: 'toolbar-sync-crm',
        title: 'Sincronizar con CRM',
        content: 'Mantén alineado todo con la planilla CRM_Operativo. Ideal hacerlo después de aprobar o marcar enviadas varias filas.',
        placement: 'bottom',
      },
    ],
  },

  // ============================================================
  // FLUJO 2: CREAR COTIZACIÓN DESDE CERO (Calculadora)
  // ============================================================
  'crear-cotizacion-completa': {
    id: 'crear-cotizacion-completa',
    title: 'Crear una Cotización Completa',
    description: 'Flujo end-to-end desde la calculadora: definir escenario → paneles → BOM → totales → PDF / WhatsApp.',
    category: 'Cotizaciones Técnicas',
    estimatedMinutes: 5,
    source: 'PanelinCalculadoraV3',
    steps: [
      {
        id: '01-open-calculator',
        target: null,
        title: 'Abrir la Calculadora BMC',
        content: 'Este es el corazón técnico del sistema. Acá definís el proyecto y generás el presupuesto preciso con precios actualizados de la Matriz.',
        placement: 'center',
      },
      {
        id: '02-scenario',
        target: 'calc-scenario-select',
        title: 'Definir el Escenario',
        content: 'Techo, Pared, Cámara, Cubierta, etc. Esto cambia las fórmulas de cálculo, recomendaciones de espesor y accesorios.',
        placement: 'bottom',
      },
      {
        id: '02b-main',
        target: 'calc-main',
        title: 'Interfaz principal',
        content: 'Esta es la zona central de la calculadora donde se configuran todos los parámetros.',
        placement: 'center',
      },
      {
        id: '03-dimensions',
        target: 'calc-dimensions',
        title: 'Cargar Medidas y Zonas',
        content: 'Ingresá m², altura, número de zonas y pendientes. El sistema calcula automáticamente la cantidad de paneles necesarios.',
        placement: 'right',
      },
      {
        id: '04-panel-selection',
        target: 'calc-panel-family',
        title: 'Elegir Familia y Espesor',
        content: 'Seleccioná el tipo de panel según requerimiento térmico, mecánico o estético. Los precios se actualizan en tiempo real desde la Matriz.',
        placement: 'bottom',
      },
      {
        id: '05-bom-review',
        target: 'calc-bom-preview',
        title: 'Revisar el Despiece (BOM)',
        content: 'Acá ves todos los ítems: paneles, fijaciones, perfiles, selladores, etc. Podés aplicar descuentos por ítem o globales.',
        placement: 'left',
      },
      {
        id: '06-totals-conditions',
        target: 'calc-totals',
        title: 'Totales, IVA y Condiciones',
        content: 'Se calcula el total neto + 22% IVA. Agregá notas comerciales, validez de oferta y condiciones de pago.',
        placement: 'top',
      },
      {
        id: '07-generate-pdf',
        target: 'calc-generate-pdf',
        title: 'Generar PDF Profesional',
        content: 'Elegí el layout (simple-carbon es el más usado), agregá logo y datos de contacto, y generá el documento listo para el cliente.',
        placement: 'top',
      },
      {
        id: '08-send-whatsapp',
        target: 'calc-wa-export',
        title: 'Enviar por WhatsApp',
        content: 'El botón de WhatsApp abre directamente el chat con el número del cliente (o uno nuevo) con el PDF adjunto y mensaje pre-cargado.',
        placement: 'bottom',
      },
    ],
  },

  // ============================================================
  // FLUJO 3: RESPUESTA RÁPIDA + CIERRE
  // ============================================================
  'respuesta-rapida-cierre': {
    id: 'respuesta-rapida-cierre',
    title: 'Respuesta Rápida y Cierre',
    description: 'Flujo de alta velocidad: procesar una consulta entrante, responder y cerrarla el mismo día.',
    category: 'Ventas / Alta Velocidad',
    estimatedMinutes: 4,
    steps: [
      {
        id: '01-identify',
        target: 'kpi-pendientes',
        title: 'Identificar consulta pendiente',
        content: 'Usá los filtros o la vista "Urgentes" para encontrar consultas que requieren respuesta hoy.',
      },
      {
        id: '02-batch-or-single',
        target: 'TOOLBAR_BATCH_GENERATE',
        title: 'Generar IA (o responder manual)',
        content: 'Si hay varias, usá el batch. Si es una sola y urgente, abrí el drawer y editá la sugerencia de IA directamente.',
      },
      {
        id: '03-approve',
        target: 'drawer-aprobar',
        title: 'Aprobar la respuesta',
        content: 'Revisá que la respuesta sea correcta y técnica. Aprobala para que quede registrada como lista para enviar.',
      },
      {
        id: '04-send-and-close',
        target: 'drawer-marcar-enviada',
        title: 'Enviar y Marcar como Enviada',
        content: 'Respondé por el canal correspondiente (WA, email, ML) y marcá inmediatamente como enviada para limpiar el tablero.',
      },
    ],
  },

  // ============================================================
  // FLUJO 4: SEGUIMIENTO POST-COTIZACIÓN (Futuro / Orquestador)
  // ============================================================
  'seguimiento-post-cotizacion': {
    id: 'seguimiento-post-cotizacion',
    title: 'Seguimiento Post-Cotización',
    description: 'Usar el orquestador + follow-ups para no perder oportunidades después de enviar un presupuesto.',
    category: 'Cierre y Seguimiento',
    estimatedMinutes: 3,
    steps: [
      {
        id: '01-after-send',
        target: null,
        title: 'Después de enviar el presupuesto',
        content: 'El sistema puede crear automáticamente un seguimiento programado (5-7 días) para contactar al cliente.',
      },
      {
        id: '02-followup-list',
        target: null,
        title: 'Ver seguimientos pendientes',
        content: 'Usá el módulo de Follow-ups o el comando `npm run followup due` para ver qué clientes tenés que contactar hoy.',
      },
      {
        id: '03-register-outcome',
        target: null,
        title: 'Registrar resultado del seguimiento',
        content: 'Anotá si el cliente avanzó, pidió cambios, rechazó o está pensando. Esto alimenta el aprendizaje del orquestador.',
      },
    ],
  },
};

export const WORKFLOW_IDS = Object.keys(TUTORIAL_WORKFLOWS);

export function getWorkflow(id) {
  return TUTORIAL_WORKFLOWS[id] || null;
}

/**
 * Categorías de flujos (útil para agrupar en la UI del toggle)
 */
export const WORKFLOW_CATEGORIES = [
  'Ventas / Operaciones',
  'Cotizaciones Técnicas',
  'Ventas / Alta Velocidad',
  'Cierre y Seguimiento',
];
