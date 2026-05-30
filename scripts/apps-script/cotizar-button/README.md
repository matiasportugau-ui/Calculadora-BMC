# Cotizar Button - Apps Script

Este es el código inicial del botón **"Cotizar"** para la planilla "2.0 - Administrador de Cotizaciones".

## Archivos

- `Code.gs` → Código principal (funciones + lógica) — **canónico**
- `Sidebar.html` → Interfaz del panel lateral
- `archive/` → Snapshots de iteración anteriores (no usar en producción)

## Backend

El Sidebar llama `POST /api/internal/presup/run` en panelin-calc (ver `CONFIG.ORCHESTRATOR_ENDPOINT`). Completar `BACKEND_BASE_URL` con la URL canónica de Cloud Run antes de probar en la planilla.

## Cómo instalar (pasos)

1. Abre la planilla **2.0 - Administrador de Cotizaciones**.
2. Ve a **Extensiones → Apps Script**.
3. Borra todo el contenido del archivo `Code.gs` por defecto.
4. Copia y pega todo el contenido de `Code.gs` de esta carpeta.
5. Crea un nuevo archivo HTML llamado `Sidebar.html` y pega el contenido correspondiente.
6. **Paso crítico:** Ejecuta primero la función `setupCotizarColumns` (está disponible en el menú "⚡ Cotizaciones 2.0" después de guardar).
   - Sigue las confirmaciones de seguridad.
   - Esto agrega las columnas de Borrador y Revisión al final de la hoja "Admin.".
7. Una vez que sepas los números reales de columna que se crearon, actualiza el objeto `CONFIG` en `Code.gs` con todos los valores (ver sección de CONFIG más abajo).
8. Guarda el proyecto.
9. Recarga la planilla. Debería aparecer el menú **⚡ Cotizaciones 2.0**.

## Próximos pasos recomendados

- Conectar correctamente la generación de PDF real (actualmente hay un placeholder).
- Definir mejor el texto de la explicación que va en columna J.
- Agregar manejo de errores más robusto.
- Agregar logging en una pestaña separada.

## Configuración obligatoria (CONFIG)

Después de correr `setupCotizarColumns`, debes completar el objeto `CONFIG` en `Code.gs` con los valores reales:

- `TAB_NAME`
- Todas las columnas nuevas (`COL_BORRADOR_PDF`, `COL_BORRADOR_EXPLICACION`, etc.)
- `BACKEND_BASE_URL`
- `PDF_DRIVE_FOLDER_ID`
- Método de autenticación (si aplica)

**Nunca dejes los valores en `null`** una vez que sepas los números reales de columna.

## Documentación completa

Ver documentación completa en:
- `docs/google-sheets-module/COTIZAR-BUTTON-REQUIRED-COLUMNS.md` ← **Mapeo actualizado de columnas necesarias**
- `docs/google-sheets-module/COTIZAR-BUTTON-WORKFLOW.md`
- `docs/google-sheets-module/COTIZAR-BUTTON-STATES-AND-COLUMNS.md`
- `docs/google-sheets-module/COTIZAR-BUTTON-BORRADOR-EXPLICACION.md`
- **UI spec final + propuesta de producción:** `docs/google-sheets-module/preview-sidebar-cotizar.html` + `COTIZAR-BUTTON-SIDEBAR-PRODUCTION-PROPOSAL.md`

El archivo `preview-sidebar-cotizar.html` es la referencia visual y de interacción que debe replicar el Sidebar.html real.
