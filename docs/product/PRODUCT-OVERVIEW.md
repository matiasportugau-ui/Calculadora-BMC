# Calculadora BMC / Wolfboard — Estado actual del producto

> **Documento maestro de presentación** — recorrido navegado de la aplicación tal
> como está hoy, anclado en capturas reales. Sirve de línea base ("estado actual")
> para el posterior análisis de mejoras. Es **descriptivo**: los candidatos a mejora
> son sólo viñetas breves por módulo.

| | |
|---|---|
| **Fecha de captura** | 2026-06-13 |
| **Versión** | `calculadora-bmc` v3.1.5 |
| **Commit** | `238e510` |
| **Entorno** | Producción — Frontend `https://calculadora-bmc.vercel.app` (Vercel), API `panelin-calc` (Cloud Run, `us-central1`) |
| **Método** | Navegación con Playwright (Chromium headless) como usuario real; ver `scripts/product-tour.spec.ts` |
| **Datos** | Sólo demo, prefijo `[DEMO-TOUR]`. Cliente demo: *Cliente Demo Tour*, tel. `+598 00 000 000`, mail `demo@bmcuruguay.test` |

### Convención de tags

Cada afirmación se clasifica:

- **`[hecho confirmado]`** — observado directamente en la app durante el recorrido.
- **`[inferencia]`** — deducido del comportamiento o del código del repo, no visto al 100 %.
- **`[duda abierta]` / `[NOT OBSERVED]`** — no fue alcanzable o no se pudo verificar en la UI.

### Privacidad (repo público)

El repositorio es **público**. Ninguna captura con datos reales de clientes (nombres,
teléfonos, correos, montos identificables) se commitea. Las vistas con PII real
(Cockpit ML/WhatsApp, Canales, Administrador de Cotizaciones, TrakTiMe) se capturan
en `docs-private/` (gitignored) y se referencian aquí como
**`[PII — imagen local, no commiteada]`**.

### Resumen de módulos

| # | Módulo | Ruta | Estado del recorrido |
|---|--------|------|----------------------|
| 1 | Wolfboard | `/hub` | _pendiente pase autenticado_ |
| 2 | Calculadora | `/` | ✅ 11 pasos + presupuesto + PDF |
| 3 | LogistikBMC | `/logistica` | _pendiente pase autenticado_ |
| 4 | Panelín (avatar IA) | _sin ruta propia_ | _pendiente pase autenticado_ |
| 5 | Cockpit Mercado Libre & WhatsApp | `/hub/ml`, `/hub/wa` | _pendiente pase autenticado_ |
| 6 | Canales | `/hub/canales` | _pendiente pase autenticado_ |
| 7 | Administrador de Cotizaciones | `/hub/cotizaciones` | _pendiente pase autenticado_ |
| 8 | TrakTiMe | `/hub/traktime` | _pendiente pase autenticado_ |
| 9 | Analytics | `/hub/admin/analytics` | _pendiente pase autenticado_ |
| 10 | Wolf Debug | `/hub/bugs` | _pendiente pase autenticado_ |

---

## 2. Calculadora

**Ruta:** `/` (pública, sin login) · **Componente:** `PanelinCalculadoraV3`

### (a) Propósito

Cotizador guiado de paneles aislantes para techo y/o fachada. Conduce al operador
por un **wizard de 11 pasos** (escenario *Solo Techo* en este recorrido) y produce un
presupuesto con BOM (lista de materiales) y total en USD, exportable a PDF, WhatsApp,
Drive y planillas. `[hecho confirmado]`

### (b) Navegación narrada (cotización demo `[DEMO-TOUR]`)

El recorrido completa una cotización demo: escenario **Solo Techo**, familia
**ISODEC EPS** (seleccionada por defecto), dimensiones **10 m × 8 paneles → 89.6 m²**,
estructura **Metal**, un accesorio perimetral asignado, y datos del cliente demo.

**Paso 1 — Escenario de obra.** Se elige el tipo de obra: *Solo Techo*, *Solo Fachada*,
*Techo + Fachada*, *Cámara Frigorífica* o *Presupuesto libre*. El visor derecho muestra
una vista previa del panel y el selector de lista de precios (Precio BMC / Precio Web).

![Paso 1 — Escenario](assets/02-calculadora/01-paso-01-escenario.png)

**Paso 2 — Familia de panel de techo.** Grilla de familias (ISODEC EPS, ISODEC PIR,
ISOROOF 3G, ISOROOF FOIL 3G, Isoroof Colonial, ISOROOF PLUS 3G). ISODEC EPS aparece
preseleccionada; el visor describe la familia y enlaza a la tienda BMC.

![Paso 2 — Familia](assets/02-calculadora/02-paso-02-familia-panel.png)

**Paso 3 — Espesor de techo.** Selección del espesor del panel (mm) disponible para la
familia elegida.

![Paso 3 — Espesor](assets/02-calculadora/03-paso-03-espesor.png)

**Paso 4 — Color de techo.** Selección de color/terminación del panel.

![Paso 4 — Color](assets/02-calculadora/04-paso-04-color.png)

**Paso 5 — Dimensiones.** Toggle **Metros (largo × ancho)** ↔ **Paneles (cantidad)**.
Con largo 10 m y 8 paneles de ancho, la planta 2D del panel derecho calcula
**10 × 8.96 m = 89.6 m²** en tiempo real. Permite agregar otra medida (mismo cuerpo) u
otro cuerpo de techo, y el toggle "2 Aguas (cumbrera central)".

![Paso 5 — Dimensiones](assets/02-calculadora/05-paso-05-dimensiones.png)

**Paso 6 — Pendiente.** Configuración de la pendiente/inclinación del techo.

![Paso 6 — Pendiente](assets/02-calculadora/06-paso-06-pendiente.png)

**Paso 7 — Estructura.** Material de apoyo (**Metal / Hormigón / Madera / Combinada**) y
grilla de fijación; la planta 2D muestra los ejes de apoyo y los puntos de fijación.
Resumen de superficie (89.6 m²) y perímetro exterior (37.92 m).

![Paso 7 — Estructura](assets/02-calculadora/07-paso-07-estructura.png)

**Paso 8 — Accesorios perimetrales.** La planta 2D resalta las bandas del perímetro de
cada zona; al tocar un lado se elige gotero, babeta, canalón o perfil. El botón
**Siguiente queda deshabilitado hasta asignar al menos un accesorio** (o desactivar la
sección con el toggle). `[hecho confirmado]`

![Paso 8 — Accesorios perimetrales](assets/02-calculadora/08-paso-08-accesorios-perimetrales.png)

**Paso 9 — Selladores.** Lista auto-calculada de selladores (silicona, cinta butilo)
con cantidades y subtotales en USD, según la geometría.

![Paso 9 — Selladores](assets/02-calculadora/09-paso-09-selladores.png)

**Paso 10 — Flete.** Costo de flete en USD (280 por defecto) y un costo interno de flete
opcional (sin IVA).

![Paso 10 — Flete](assets/02-calculadora/10-paso-10-flete.png)

**Paso 11 — Datos del proyecto.** Formulario de cliente (pestañas *Empresa* / *Cliente
Final*): razón social, RUT, teléfono, dirección, nombre de referencia. Se completó con
el cliente demo `[DEMO-TOUR] Cliente Demo Tour`. Cierra con el botón verde
**✓ Cotización lista**.

![Paso 11 — Datos del proyecto](assets/02-calculadora/11-paso-11-datos-proyecto.png)

**Presupuesto / BOM.** Tras *Cotización lista* se revela el presupuesto con precios: BOM
por grupos, subtotales y **total con IVA = USD 5.638,86**, junto a los botones de
exportación (WhatsApp, PDF Cliente, Interno, Drive, Costeo, TSV Sheets) y el selector de
diseño de PDF.

![Presupuesto / BOM](assets/02-calculadora/12-paso-12-presupuesto-bom.png)

**Exportación a PDF.** *PDF Cliente* abre el modal **Confirmar cotización** con cliente,
teléfono, total y el nombre del archivo PDF. (El recorrido **no** confirma la descarga ni
realiza envíos.)

![PDF — Confirmar cotización](assets/02-calculadora/13-paso-13-pdf-presupuesto.png)

### (c) Inventario de features visibles

- Wizard de 11 pasos con indicador `N/11` e hilo de migas de la cotización (código
  `BMC-2026-####`). `[hecho confirmado]`
- Visor visual del panel + planta 2D con cotas en tiempo real. `[hecho confirmado]`
- Selector de lista de precios **Precio BMC / Precio Web**. `[hecho confirmado]`
- BOM por grupos con totales en USD e IVA aplicado al total. `[hecho confirmado]`
- Barra superior: Config, Tutorial, Plano, Drive, Borradores, Guardar, Limpiar,
  Imprimir, selector de modo y avatar **Panelín**. `[hecho confirmado]`
- Exportaciones: WhatsApp, PDF Cliente, Interno (costeo), Drive, Costeo, TSV Sheets, con
  selector de diseño de PDF. `[hecho confirmado]`

### (d) Dependencias observadas (endpoints en network)

```
GET  /api/auth/me            (401 anónimo — esperado)
POST /api/auth/refresh       (401 anónimo — esperado)
GET  /api/quotes/counter     (próximo número de cotización)
GET  /api/agent/ai-options   (opciones del asistente)
POST /api/vitals             (telemetría web-vitals)
```

La calculadora **funciona de forma anónima** (sin login): el cálculo es client-side y
sólo telemetría/identidad fallan con 401, sin bloquear el flujo. `[hecho confirmado]`

### (e) Estado observado

- Flujo completo de 11 pasos sin errores bloqueantes; el presupuesto y el PDF se generan
  correctamente. `[hecho confirmado]`
- El paso *Accesorios perimetrales* **bloquea Siguiente** hasta asignar un accesorio:
  comportamiento esperado pero puede confundir (no hay aviso explícito del bloqueo). `[hecho confirmado]`
- Sin login, `/api/auth/me` y `/api/auth/refresh` devuelven 401 (no afecta el cálculo). `[hecho confirmado]`

### (f) Candidatos a mejora (breve)

- Mensaje explícito en el paso de accesorios cuando *Siguiente* está bloqueado por falta
  de asignación.
- Atajo "saltar a presupuesto" para usuarios expertos que repiten cotizaciones simples.
- Persistir el último escenario/familia usados como default por operador.
