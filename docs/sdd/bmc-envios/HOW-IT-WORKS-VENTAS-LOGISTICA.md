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

## Qué se arregló en Phase A (#890)

| Antes | Ahora |
|-------|--------|
| Índices legacy (nombre≈col H) | Mapa Ventas 2.0 (I/J/K/P/H) |
| PDF Drive fallaba → 0 paneles | Fallback **filename ENCARGO** |
| Mensaje confuso | Nombre real del cliente en el toast |

## Verificación técnica

- Unit: `node tests/ventasSheetMap.test.js`, `node tests/cargoFromEncargo.test.js`
- Prod chunk `BmcLogisticaApp-*.js` contains `ENCARGO filename` + `Buscar cliente en Ventas`
