# Calculadora Panelin BMC — Uso y capacidades

Documentación orientada a **usuarios comerciales** y a **QA / deploy**. Para criterios de cotización y trazabilidad de fuentes, ver [`docs/team/knowledge/Calc.md`](../team/knowledge/Calc.md).

---

## 1. Dónde corre la app

| Entorno | URL / comando | Notas |
|--------|----------------|-------|
| **Producción (Cloud Run)** | `https://panelin-calc-q74zutv7dq-uc.a.run.app/calculadora/` | Misma base sirve la SPA y la API (`VITE_SAME_ORIGIN_API` en imagen Docker). |
| **Frontend en Vercel** (si aplica) | Según proyecto Vercel | Requiere `VITE_API_URL` apuntando a la API Cloud Run. Ver [`docs/VERCEL-CALCULADORA-SETUP.md`](../VERCEL-CALCULADORA-SETUP.md). |
| **Desarrollo local** | `npm run dev` (Vite, típ. puerto 5173) + `npm run start:api` (puerto 3001) | La calculadora llama a `http://localhost:3001` salvo `VITE_API_URL`. |

**Salud del backend:** `GET /health` en la misma base (JSON con `ok`, Sheets, tokens ML, etc.).

---

## 2. Componente en código (importante para soporte)

- La app principal (`src/App.jsx`) monta **`PanelinCalculadoraV3_backup.jsx`** como calculadora canónica.
- Existe una variante monolítica **`PanelinCalculadoraV3.jsx`** con funciones extra de documentación interna (p. ej. vistas **Cliente / Costeo**, avisos de margen) descritas en [`docs/team/PROJECT-STATE.md`](../team/PROJECT-STATE.md). No es la que carga `App.jsx` hasta que se cambie el import.

---

## 3. Qué hace la calculadora (resumen)

Cotizador de **paneles sandwich** (techo y/o pared) y **cámaras frigoríficas**, con **lista de materiales (BOM)** agrupada, **totales en USD sin IVA + IVA 22%**, exportación a **PDF** y texto para **WhatsApp**, **historial local** de presupuestos y **Google Drive** (guardar/cargar proyectos `.bmc.json`). Opcionalmente **presupuesto libre** con líneas manuales y catálogo.

Los precios base viven en datos del frontend; se pueden **actualizar desde la MATRIZ** vía API o importar CSV en **Config → Precios**.

---

## 4. Modos de uso

### 4.1 Modo Cliente vs Modo Vendedor

- **Cliente:** formulario completo visible según escenario (más rápido para quien ya conoce los campos).
- **Vendedor:** asistente por **pasos (wizard)** — obliga a completar lista de precios, proyecto, medidas y flete en orden (según escenario). Útil para demos guiadas.

### 4.2 Lista de precios activa

- **Precio BMC** (`venta`): lista administración / directo.
- **Precio Web** (`web`): lista pública tienda.

El presupuesto y el PDF indican qué lista está activa. Los importes de ítems son **USD sin IVA**; el total muestra **IVA 22%** aplicado al conjunto según la lógica actual de la pantalla.

---

## 5. Escenarios de proyecto

| Escenario | Contenido principal |
|-----------|---------------------|
| **Solo techo** | Cubierta (ISODEC / ISOROOF, etc.), largo/ancho, bordes perimetrales, opciones canalón / gotero, estructura, selladores. |
| **Solo fachada** | Pared: familia, espesor, alto, perímetro, esquinas, aberturas, fijaciones, opciones (sellado, 5852, cinta, silicona, etc.). |
| **Techo + fachada** | Combina techo y pared en un solo presupuesto. |
| **Cámara frigorífica** | Dimensiones **interiores**; deriva perímetro y altura de pared y propone techo acorde. |
| **Presupuesto libre** | Sin motor de paños: líneas por **catálogo** (paneles, perfiles, fijaciones, selladores, extras) más importes manuales; incluye **flete** y servicios. |

Cada escenario muestra u oculta secciones (bordes, autoportancia, cámara, etc.) según reglas internas.

---

## 6. Familias de producto (referencia)

- **Techo:** ISODEC EPS/PIR, ISOROOF 3G, ISOROOF FOIL 3G, Isoroof Colonial, ISOROOF PLUS 3G (según datos en `src/data/constants.js`).
- **Pared:** ISOPANEL EPS, ISOWALL PIR, ISOFRIG PIR.

Cada familia tiene **espesores**, **colores** (con mínimos de área cuando aplica), **ancho útil (au)** y reglas de **autoportancia** vs **largo comercial** — ver skill [`.cursor/skills/bmc-calculadora-specialist/SKILL.md`](../../.cursor/skills/bmc-calculadora-specialist/SKILL.md).

---

## 7. BOM, ajustes y exclusiones

- La BOM se agrupa por categorías (paneles, perfilería, fijaciones, selladores, servicios, etc.).
- **Excluir ítem:** quita una línea del total sin borrar el cálculo base (útil para ajustes comerciales).
- **Overrides** de precio unitario (cuando la UI lo permite) recalculan subtotales.
- **Flete:** valor en USD s/IVA; puede mostrarse con dirección del proyecto en la etiqueta.
- Opciones avanzadas de techo **ISODEC PIR** (BOM comercial / varilla): ver [`docs/team/PROJECT-STATE.md`](../team/PROJECT-STATE.md) y tests en `tests/validation.js`.

---

## 8. Exportación e impresión

- **PDF:** genera HTML de cotización; **vista previa** en modal e **imprimir / guardar PDF** desde el navegador. Según escenario puede incluir **segunda página** con esquemas (techo/fachada) y resumen.
- **WhatsApp:** copia texto plano con resumen (escenario, totales, condiciones según plantilla).
- **Barra inferior (móvil):** accesos rápidos WA / PDF.

---

## 9. Historial de presupuestos (local)

- Guardar cotización en el **historial local** del navegador (Budget Log).
- Cargar, duplicar, exportar JSON, borrar entradas o limpiar todo.
- Código de presupuesto tipo **`BMC-...`** para correlación con CRM / Drive.

---

## 10. Google Drive

- Requiere **OAuth** con **Client ID** de Google configurado en build (`VITE_GOOGLE_CLIENT_ID`) y orígenes autorizados para el dominio donde corre la SPA.
- **Guardar:** sube estado del proyecto (incl. escenario, listas, overrides, exclusiones, etc.).
- **Cargar / listar / eliminar** carpetas de cotizaciones en la carpeta configurada en `src/utils/googleDrive.js`.

Si el usuario no inicia sesión, el resto de la calculadora sigue funcionando.

---

## 11. Config (engranaje “Config”)

Panel lateral con pestañas:

1. **General** — preferencias persistidas vía `calculatorConfig` (defaults de lista, flete, etc.).
2. **Precios** — **PricingEditor**:
   - Cargar precios desde **`GET /api/actualizar-precios-calculadora`** (CSV MATRIZ en servidor con Sheets configurado).
   - Importar CSV local (columnas `path`, costo, venta, web según formato).
   - Búsqueda, edición por fila, selección múltiple, **ajuste porcentual masivo**, reset de overrides.
   - Detección de **paths duplicados** en CSV (advertencia).
3. **Fórmulas** — **DimensioningFormulasEditor**: parámetros de dimensionado (espaciamientos, factores) usados por el motor en `calculations.js` / `dimensioningFormulas.js`.

Tras guardar precios o fórmulas se invalida la caché de pricing y se refrescan los totales.

---

## 12. API relacionada (no es la pantalla, pero alimenta precios y GPT)

- **`/api/actualizar-precios-calculadora`** — CSV para sincronizar MATRIZ → calculadora.
- Rutas **`/calc/*`** — cotizaciones, OpenAPI, informes (consumo GPT / integraciones). Ver [`docs/api/AGENT-CAPABILITIES.json`](../api/AGENT-CAPABILITIES.json).

La resolución de la base URL en el cliente está en [`src/utils/calcApiBase.js`](../../src/utils/calcApiBase.js).

---

## 13. Verificación automática rápida (sin navegador)

```bash
npm run smoke:prod
```

Comprueba `health`, `capabilities`, CSV MATRIZ, y (si está configurado) sugerencias CRM. Variable opcional: `BMC_API_BASE` / `SMOKE_BASE_URL`.

---

## 14. Checklist manual en navegador

Para una pasada humana o asistente con **Browser**, usar el documento dedicado:

**[`BROWSER-QA-CHECKLIST.md`](./BROWSER-QA-CHECKLIST.md)**

Incluye casillas por escenario, PDF, Drive, Config/MATRIZ y responsive.

---

## 15. Referencias de código y tests

| Área | Archivo |
|------|---------|
| UI principal | `src/components/PanelinCalculadoraV3_backup.jsx` |
| Motor techo/pared | `src/utils/calculations.js` |
| BOM / grupos | `src/utils/helpers.js` |
| Constantes paneles | `src/data/constants.js` |
| Pricing runtime | `src/data/pricing.js`, `src/utils/pricingOverrides.js` |
| Tests | `tests/validation.js` — `npm test` |

---

## 16. Limitaciones y buenas prácticas

- **IVA y totales:** confirmar en el PDF/WhatsApp si el cliente debe ver explícito “con IVA” / “sin IVA” según política comercial.
- **Ancho vs cantidad de paneles:** si el ancho no es múltiplo de `au`, validar con el cliente si se agrega un panel extra o se ajusta cobertura (ver `Calc.md`).
- **Drive y OAuth:** fallos de red o consentimiento se muestran en panel; no bloquean el cálculo local.

---

*Última revisión documental: 2026-03-26.*
