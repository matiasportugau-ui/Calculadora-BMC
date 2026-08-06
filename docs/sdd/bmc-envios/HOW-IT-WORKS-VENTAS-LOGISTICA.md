# Cómo funciona: Ventas → Logística (Phase A–C)

**URL prod:** https://calculadora-bmc.vercel.app/logistica  
**Sheet Ventas:** `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA`  
**Tab activa:** `Ventas y Coordinaciones` (gid `926747636`)  
**Tab archivo (Entregado/Enviado):** `Ventas Realizadas y Entegadas` (o `Enviados` si existe)

## Columnas planilla 2.0 (SoT)

| Col | Letra | Campo |
|-----|-------|--------|
| I | — | NOMBRE cliente |
| J | — | DIRECCIÓN |
| K | — | ENCARGO (PDF Drive) |
| P | — | CONTACTO (tel) |
| F | F | ESTADO GRAL / notas ops + marcador `[LOGISTICA:…]` |
| H | H | FECHA ENTREGA (dd/mm/aaaa) — **no** G (G = TIPO) |

## Flujo operador (orden)

1. Abrí **Logística** → `/logistica`.
2. **🔍 Buscar cliente en Ventas** → **Buscar** o **Cargar actuales**.
   - *Cargar actuales* omite filas basura (`NOMBRE` de secciones BECAM/BROMYROS) y filas ya **Entregado/Enviado**.
3. En cada resultado:
   - Chip de estado (Por coordinar / Coordinado · dd/mm · Camión N / Con pendientes / …).
   - **Editor de estado** inline: cambiá estado → escribe planilla (F + H).
   - **Coordinado**: elegí fecha + **Camión 1..12** (cada nº se asocia a un transportista de la lista).
   - **Entregado / Enviado**: abre popup de confirmación (comentarios + remito firmado opcional) → mueve fila a tab archivo.
   - **×**: saca de la lista UI (no borra la planilla).
   - **+ Parada**: agrega al envío + autocarga paneles.
4. Autocarga paneles: filename ENCARGO si Drive no se puede bajar en el browser.
5. **☁ Guardar en nube** / autosave (P5b).

## Estados de la venta (alineados a planilla)

| Estado | Lista activa | Sheet |
|--------|--------------|--------|
| Por coordinar | sí | limpia/actualiza marcador F; fecha H vacía |
| Coordinado (dd/mm + Camión N) | sí | F marcador + H fecha |
| Con pendientes | sí | F marcador; queda visible |
| Entregado | **no** (sale) | confirm popup → archivo tab + remito Drive |
| Enviado | **no** (sale) | igual, mode=enviado |

## Agentes (Panelin / IAlfred)

Tools en `server/lib/agentTools.js`:

| Tool | Uso |
|------|-----|
| `logistica_buscar_ventas` | Buscar cliente/pedido (read) |
| `logistica_actualizar_estado` | por_coordinar / coordinado / con_pendientes (`user_confirmed`) |
| `logistica_confirmar_entrega` | entregado/enviado + move + remito (`user_confirmed`) |

## Verificación técnica

```bash
node tests/saleState.test.js
node tests/ventasSheetMap.test.js
node tests/coordinationStatus.test.js
node tests/ventasSearchFilter.test.js
node tests/cargoFromEncargo.test.js
```

API:

- `POST /api/ventas/logistica-fecha-entrega` → col **H**
- `POST /api/ventas/logistica-estado` → F + H
- `POST /api/ventas/logistica-entregado` → confirm + archive + remito
