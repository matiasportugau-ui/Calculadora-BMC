# Interactive Tutorial System (Modo Tutorial)

Sistema de tutoriales interactivos dentro de la app para guiar a los usuarios a través de los flujos principales de trabajo cuando activan el "Modo Tutorial".

## Objetivo

Permitir que el equipo de ventas y operadores aprendan los flujos clave de forma guiada, directamente sobre la interfaz real, sin necesidad de documentación externa o videos.

## Arquitectura

- **TutorialProvider**: Maneja el estado global (modo activado, workflow activo, paso actual, progreso guardado en localStorage).
- **TutorialOverlay**: Renderiza el spotlight + tarjeta de instrucciones usando Portal. Soporta targets vía `data-tutorial-id`.
- **workflows.js**: Definición declarativa de todos los flujos existentes (fuente de verdad).
- **Launchers**: Botones contextuales en los módulos principales + botón flotante global.

## Flujos Actuales Documentados

Ver `workflows.js` y `FLOWS.md` para la definición completa y actualizada de los flujos existentes:

- `admin-cotizaciones-gestion` → Gestión de cotizaciones entrantes (el más importante para ventas)
- `crear-cotizacion-completa` → Flujo completo de la calculadora
- `respuesta-rapida-cierre` → Versión rápida de respuesta + cierre
- `seguimiento-post-cotizacion` → Seguimiento post-envío (en desarrollo)

## Cómo Instrumentar Nuevos Elementos

Agrega el atributo `data-tutorial-id` en los componentes relevantes:

```jsx
<div data-tutorial-id="mi-elemento-clave">
  ...
</div>
```

Luego agrégalo como `target` en el paso correspondiente dentro de `workflows.js`.

También puedes reutilizar los anchors existentes del sistema de ayuda (`data-help-id`).

## Cómo Agregar un Nuevo Flujo

1. Define el flujo en `workflows.js` con pasos claros (title, content, target, placement).
2. Agrega los `data-tutorial-id` necesarios en la UI.
3. Actualiza `FLOWS.md`.
4. (Opcional) Agrega un launcher específico en el módulo correspondiente.

## Estado Actual (Producción) — Junio 2026

**Estado**: ✅ **Listo para producción**

- Sistema integrado correctamente en `App.jsx` (dentro de BmcAuthProvider + overlay global).
- Cobertura completa de los dos flujos principales para el equipo de ventas:
  - Admin de Cotizaciones (`admin-cotizaciones-gestion`) — altamente instrumentado.
  - Calculadora principal (`crear-cotizacion-completa`) — instrumentado.
- Launchers contextuales + botón flotante global + soporte de eventos custom.
- Persistencia en localStorage (modo + progreso por workflow).
- Comportamiento graceful: si falta un `data-tutorial-id`, la tarjeta se muestra centrada.
- Sin impacto en performance cuando el modo está desactivado.
- Documentación completa (este README + `FLOWS.md` + workflows.js + entrada en PROJECT-STATE.md).

**Feature Flag de Producción**:
- `VITE_FEATURE_TUTORIAL_MODE=false` oculta el botón flotante (el sistema sigue cargado pero inactivo por defecto).
- Para desactivar completamente: quitar los imports y el render condicional en `App.jsx`.

Recomendado para la ventana de pruebas del equipo de ventas: dejar `true` (default).

**Verificación realizada**:
- Lint sin errores críticos en los archivos del sistema.
- Atributos `data-tutorial-id` verificados en componentes reales.
- Launchers funcionales en los dos módulos principales.

## Verificación

Para verificar que todo funciona:

1. Activa el Modo Tutorial (botón flotante abajo a la derecha).
2. Lanza cualquiera de los flujos principales.
3. Confirma que el spotlight resalta correctamente los elementos con `data-tutorial-id`.

## Notas de Producción

- No tiene impacto en performance cuando el modo está desactivado.
- Totalmente cliente-side (sin llamadas a backend).
- Compatible con el sistema de ayuda existente (`HelpProvider` / anchors).
- Se puede desactivar fácilmente quitando el `TutorialProvider` y `TutorialOverlay` de `App.jsx` si fuera necesario.

## Mantenimiento

- Mantener `workflows.js` sincronizado con los cambios reales de UI.
- Cuando se agreguen nuevos flujos importantes, documentarlos aquí y en `FLOWS.md`.
- Actualizar los `data-tutorial-id` cuando se refactoricen componentes.

---

**Última actualización**: Junio 2026  
**Responsable**: Implementación del sistema de tutorial interactivo para preparación del equipo de ventas.
