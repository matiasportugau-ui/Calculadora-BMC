# Checklist QA — Calculadora Panelin (navegador)

Usar este documento en **pasadas manuales** o con un asistente que tenga **Browser** (Cursor IDE Browser, Playwright, etc.). Marcar cada ítem **OK** / **FAIL** y anotar navegador, fecha y URL base.

**URL recomendada (prod):** `https://panelin-calc-q74zutv7dq-uc.a.run.app/calculadora/`

**BASE canónica (evitar drift):** obtener con `gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format='value(status.url)'` y usar ese host sin barra final como `BASE` en los `curl` de abajo. Detalle: [`docs/procedimientos/PROCEDIMIENTO-PRODUCCION-OPERATIVA-100.md`](../procedimientos/PROCEDIMIENTO-PRODUCCION-OPERATIVA-100.md).

**Pre-check API (opcional, terminal):**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "BASE/calculadora/"
curl -sS "BASE/health"
```

Sustituir `BASE` por la URL sin barra final. Esperado: `200` y JSON `{"ok":true,...}`.

---

## A. Carga y shell

- [ ] **A1** La página carga sin pantalla en blanco (solo HTML).
- [ ] **A2** Se ve el encabezado / marca y los selectores de **escenario** y **modo Cliente / Vendedor**.
- [ ] **A3** Abrir **Config** (engranaje): el panel lateral abre y se cierra al hacer clic fuera o en cerrar.
- [ ] **A4** Pestañas **General**, **Precios**, **Fórmulas** son accesibles dentro de Config.
- [ ] **A5** Consola del navegador: sin errores rojos críticos al cargar (advertencias de terceros pueden ignorarse si no rompen flujo).

---

## B. Modo Cliente — Solo techo

- [ ] **B1** Seleccionar **Solo techo** y **Cliente**.
- [ ] **B2** Elegir familia, espesor y color; completar largo / ancho razonables.
- [ ] **B3** Aparecen resultados (paneles, m², advertencias si las hay) sin mensaje de error bloqueante.
- [ ] **B4** Alternar **Precio BMC** vs **Precio Web**: cambian totales o al menos etiqueta de lista.
- [ ] **B5** **Flete** distinto de cero: aparece línea de servicio y afecta total.
- [ ] **B6** Bordes / opciones perimetrales (gotero, canalón si aplica) modifican BOM o totales de forma coherente.
- [ ] **B7** **Excluir** un ítem de la BOM: desaparece del total y figura en “items excluidos” si la UI lo lista.

---

## C. Modo Cliente — Solo fachada

- [ ] **C1** Escenario **Solo fachada**: familia pared + espesor + color.
- [ ] **C2** Alto y perímetro (o equivalente) producen BOM de pared.
- [ ] **C3** Aberturas / esquinas (si se usan) no rompen el cálculo.

---

## D. Modo Cliente — Techo + fachada

- [ ] **D1** Completar datos de techo y de pared.
- [ ] **D2** BOM combina ambos; totales son suma coherente de categorías visibles.

---

## E. Cámara frigorífica

- [ ] **E1** Escenario **Cámara frigorífica** (o nombre equivalente en UI).
- [ ] **E2** Ingresar largo/ancho/alto **interiores**; se calcula perímetro de pared y techo asociado.
- [ ] **E3** No hay NaN ni totales vacíos con datos mínimos válidos.

---

## F. Presupuesto libre

- [ ] **F1** Escenario **Presupuesto libre**.
- [ ] **F2** Agregar líneas desde **catálogo** (paneles / perfiles / accesorios según UI).
- [ ] **F3** Ajustar cantidades y verificar subtotales.
- [ ] **F4** Línea extra manual (descripción + precio si la UI lo permite).
- [ ] **F5** **Flete** en presupuesto libre suma al total.

---

## G. Modo Vendedor (wizard)

- [ ] **G1** Activar **Vendedor**; el flujo paso a paso aparece para **Solo techo** (u otro escenario con wizard).
- [ ] **G2** No permite avanzar sin completar pasos obligatorios (lista, proyecto, medidas, flete según pasos).
- [ ] **G3** Tecla **Enter** avanza cuando el paso es válido (si está implementado en ese escenario).
- [ ] **G4** Al terminar, los resultados coinciden en esencia con el mismo caso en modo Cliente.

---

## H. PDF y WhatsApp

- [ ] **H1** Botón **PDF** o **Vista previa**: abre modal o vista imprimible.
- [ ] **H2** **Imprimir / guardar como PDF** desde el diálogo del navegador genera documento legible (texto, totales, condiciones).
- [ ] **H3** **WhatsApp** o **WA**: abre `wa.me` o copia texto con resumen y totales.
- [ ] **H4** En **móvil** (o viewport estrecho): barra inferior **WA / PDF** visible y usable.

---

## I. Historial local (Budget Log)

- [ ] **I1** **Guardar** presupuesto en historial: aparece nueva entrada con código.
- [ ] **I2** **Cargar** desde historial restaura escenario y totales esperados.
- [ ] **I3** **Exportar JSON** (si existe): archivo descargable válido.
- [ ] **I4** **Borrar** una entrada o **limpiar** historial funciona y persiste tras recargar la página (donde aplique localStorage).

---

## J. Google Drive

- [ ] **J1** Botón / flujo **Drive** visible.
- [ ] **J2** **Iniciar sesión** Google: completa OAuth sin error de `redirect_uri` / `origin` (requiere Client ID y orígenes correctos en consola Google).
- [ ] **J3** **Guardar** en Drive: mensaje de éxito o confirmación.
- [ ] **J4** **Listar** y **cargar** una cotización guardada restaura el estado.
- [ ] **J5** **Eliminar** (si se prueba en entorno de prueba): pide confirmación y elimina.

*Si OAuth no está configurado en el entorno, marcar J2–J5 como N/A y documentar.*

---

## K. Config → Precios (MATRIZ / CSV)

- [ ] **K1** **Cargar desde MATRIZ** (botón en PricingEditor): con API y Sheets OK, muestra mensaje de éxito o recuento de actualizaciones; con API caída, error entendible.
- [ ] **K2** **Importar CSV** local con columnas válidas: actualiza filas; duplicados de `path` muestran advertencia.
- [ ] **K3** **Búsqueda** y **edición** de una celda de precio reflejan cambio en la cotización abierta tras cerrar Config (o tras invalidar caché).
- [ ] **K4** **Ajuste porcentual masivo** en selección: precios cambian en bloque.
- [ ] **K5** **Reset** de overrides restaura valores base.

---

## L. Config → Fórmulas

- [ ] **L1** Abrir editor de fórmulas / factores de dimensionado.
- [ ] **L2** Guardar un cambio menor (en entorno de prueba) y verificar que la BOM o cantidades reaccionan o que no hay error al guardar.

---

## M. Responsive y accesibilidad básica

- [ ] **M1** **320–400px** ancho: formulario usable (scroll, sin solapamiento crítico).
- [ ] **M2** **Desktop** 1280px: columnas y BOM legibles.
- [ ] **M3** Contraste y foco: botones principales activables con teclado donde sea razonable.

---

## N. Regresión rápida tras deploy

- [ ] **N1** `npm run smoke:prod` (desde CI o máquina operador) en verde.
- [ ] **N2** Misma versión de **build** en Cloud Run que la esperada (revisión / etiqueta si se documenta en deploy).

---

## Registro de corrida (plantilla)

| Campo | Valor |
|-------|--------|
| Fecha | |
| URL base | |
| Navegador / versión | |
| Escenario probado (B–F) | |
| Fallos (ID + breve) | |
| Capturas / enlaces | |

---

*Documento alineado a `docs/calculadora/README.md`. Actualizar ambos si se agregan flujos nuevos en `PanelinCalculadoraV3_backup.jsx`.*
