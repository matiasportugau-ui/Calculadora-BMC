# Cómo funciona: Ventas → Logística (Phase A)

**URL prod:** https://calculadora-bmc.vercel.app/logistica  
**Sheet Ventas:** `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA` (gid `926747636`)

## Flujo operador (orden)

1. Abrí **Logística** (nav superior) o ve directo a `/logistica`.
2. En el tab **Formulario**, bloque **🔍 Buscar cliente en Ventas**:
   - Escribí nombre, pedido, tel o dirección en el input.
   - Clic **Buscar** (filtra filas) o **Cargar actuales** (lista operativa).
3. Debería verse algo como `Última lectura: N filas en pestaña actual.`
4. Clic en un resultado de la lista (**+ Parada** / fila del cliente).
5. Se rellenan **Datos del Envío / parada**:
   - Cliente ← col **I NOMBRE**
   - Dirección ← col **J**
   - Tel ← col **P CONTACTO**
   - PDF ← col **K ENCARGO** (link Drive)
   - Fecha entrega ← col **H FECHA ENTREGA**
6. **Autocarga de paneles** (automática al agregar):
   - Si el PDF de Drive no se puede bajar en el browser, el sistema lee el **nombre del archivo ENCARGO**.
   - Ej.: `…-Isopanel-100-mm-Isodec-100-mm-….pdf` → líneas ISOPANEL 100 mm e ISODEC 100 mm (cantidad default **1**; ajustá a mano si hace falta).
   - Mensaje típico: *Autocarga OK…* o *Inferido desde nombre de archivo ENCARGO…*
7. Revisá paneles en la parada y el diagrama (vista isométrica / 3D).
8. Opcional: **☁ Guardar en nube** / **Autosave nube** / **Borradores** (P5b ya en prod).

## Si sigue sin paneles

- El ENCARGO no trae nombres de producto en la URL → abrí el PDF y cargá líneas a mano, o usá **Reintentar autocarga**.
- Hard refresh (`Cmd+Shift+R`) si ves UI vieja.
- Drive `/view` ya no depende solo del browser: el cliente usa **proxy** `POST /api/envios/adjunto-fetch` (requiere `VITE_BMC_API_AUTH_TOKEN` + API).

## Autocarga — prioridad (2026-08-07)

1. **Admin Cotizaciones** multi-clave (pedido / nombre / teléfono) — auto solo si match único y fuerte  
2. **PDF** (proxy API → texto)  
3. **Nombre de archivo ENCARGO** (Isopanel-100-mm…)  
4. **Texto de fila Ventas** / ENCARGO free-text  
5. Manual

## Lista Ventas limpia

- “Cargar actuales” / Buscar **filtran basura** (encabezados, `PEDIDO` como ENCARGO, sin nombre ni pedido real).
- Toasts siempre con etiqueta: cliente, `#pedido`, o `fila N` — nunca `para .`.

## Qué se arregló en Phase A (#890) + A/C/B goal

| Antes | Ahora |
|-------|--------|
| Índices legacy (nombre≈col H) | Mapa Ventas 2.0 (I/J/K/P/H) |
| PDF Drive fallaba → 0 paneles | Fallback **filename ENCARGO** + **proxy adjunto** |
| Mensaje confuso / `para .` | `labelVentasCandidate` + filtro candidatos |
| Sin Admin | `adminQuoteMatch` + opcional `/api/cotizaciones` |

## Verificación técnica

- Unit: `node tests/ventasSheetMap.test.js`, `node tests/adminQuoteMatch.test.js`, `node tests/cargoFromEncargo.test.js`
- Evidence: `docs/sdd/bmc-envios/evidence/autocarga-training-2026-08-07.md`
- Prod chunk `BmcLogisticaApp-*.js` contains `ENCARGO filename` + `Buscar cliente en Ventas`
