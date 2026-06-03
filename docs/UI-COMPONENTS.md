# 🎨 Biblioteca de Componentes UI — Panelin v3

## Design System

### Tokens de Color

| Token | Hex | Uso |
|-------|-----|-----|
| `bg` | `#F5F5F7` | Fondo general |
| `surface` | `#FFFFFF` | Tarjetas, inputs |
| `surfaceAlt` | `#FAFAFA` | Filas alternadas |
| `primary` | `#0071E3` | Acciones, selección |
| `primarySoft` | `#E8F1FB` | Fondo de items seleccionados |
| `brand` | `#1A3A5C` | Headers, titulos de grupo |
| `brandLight` | `#EEF3F8` | Fondo de grupos BOM |
| `success` | `#34C759` | Alertas OK, autoportancia OK |
| `warning` | `#FF9F0A` | Alertas de precaución |
| `danger` | `#FF3B30` | Errores, excede autoportancia |
| `border` | `#E5E5EA` | Bordes de inputs |
| `tp` | `#1D1D1F` | Texto primario |
| `ts` | `#6E6E73` | Texto secundario |
| `tt` | `#AEAEB2` | Texto terciario |

### Tipografía

Font family: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif`

Numeric: `fontVariantNumeric: "tabular-nums"` para alineación de columnas numéricas.

### Animaciones (CSS Keyframes)

| Nombre | Uso |
|--------|-----|
| `bmc-fade` | Transición de números animados |
| `bmc-shake` | Feedback en límites de stepper |
| `bmc-slideUp` | Entrada de toast notifications |

## Componentes

### 1. AnimNum
Anima cambios de valor numérico con fade.

{% raw %}
```jsx
<AnimNum value="36.40" style={{ fontSize: 28 }} />
```
{% endraw %}

### 2. CustomSelect
Dropdown custom con soporte para badges y sublabels.

{% raw %}
```jsx
<CustomSelect
  label="Familia"
  value="ISODEC_EPS"
  options={[{ value: "ISODEC_EPS", label: "ISODEC EPS", sublabel: "Techos" }]}
  onChange={setFamilia}
  showBadge
/>
```
{% endraw %}

### 3. StepperInput
Input numérico con botones +/- y shake en límites.

{% raw %}
```jsx
<StepperInput label="Largo (m)" value={6.0} onChange={setLargo}
  min={1} max={20} step={0.5} unit="m" decimals={2} />
```
{% endraw %}

### 4. SegmentedControl
Control segmentado tipo iOS con estados disabled.

{% raw %}
```jsx
<SegmentedControl
  value="web"
  onChange={setLista}
  options={[{ id: "venta", label: "Precio BMC" }, { id: "web", label: "Precio Web" }]}
  disabledIds={[]}
/>
```
{% endraw %}

### 5. Toggle
Switch on/off con label.

{% raw %}
```jsx
<Toggle label="Canalón" value={true} onChange={setInclCanalon} />
```
{% endraw %}

### 6. KPICard
Tarjeta de indicador clave con borde de color y número animado.

{% raw %}
```jsx
<KPICard label="Área" value="36.4m²" borderColor="#0071E3" />
```
{% endraw %}

### 7. ColorChips
Selector de color con chips visuales y tooltips de notas.

{% raw %}
```jsx
<ColorChips
  colors={["Blanco", "Gris", "Rojo"]}
  value="Blanco"
  onChange={setColor}
  notes={{ Gris: "Solo 100-150mm · +20 días" }}
/>
```
{% endraw %}

Colores mapeados: Blanco → `#FFFFFF`, Gris → `#8C8C8C`, Rojo → `#C0392B`

### 8. AlertBanner
Banner de alerta con 3 tipos.

{% raw %}
```jsx
<AlertBanner type="success" message="Autoportante ✓" />
<AlertBanner type="warning" message="Color requiere mínimo 500 m²" />
<AlertBanner type="danger" message="Largo excede autoportancia" />
```
{% endraw %}

### 9. Toast
Notificación flotante temporal (fixed, bottom-right).

{% raw %}
```jsx
<Toast message="Copiado al portapapeles" visible={true} />
```
{% endraw %}

### 10. TableGroup
Tabla colapsable de items BOM con subtotal en header.

{% raw %}
```jsx
<TableGroup
  title="FIJACIONES"
  items={[{ label: "Varilla 3/8\"", cant: 9, unidad: "unid", pu: 3.64, total: 32.76 }]}
  subtotal={156.42}
  collapsed={false}
  onToggle={() => toggleGroup("FIJACIONES")}
/>
```
{% endraw %}

Columnas: Descripción (2fr) | Cant. (0.6fr) | Unid. (0.6fr) | P.Unit. (0.8fr) | Total (0.8fr)

### 11. BorderConfigurator
Configurador visual de bordes de techo (grid 3×3 con selección por lado).

{% raw %}
```jsx
<BorderConfigurator
  borders={{ frente: "gotero_frontal", fondo: "cumbrera", latIzq: "gotero_lateral", latDer: "none" }}
  onChange={(side, value) => updateBorder(side, value)}
/>
```
{% endraw %}

Visual grid:
```
        [FONDO ▲]
[◄ IZQ] [PANELES] [DER ►]
       [FRENTE ▼]
```

### 12. ScenarioSelector (inline en Main)
Grid 2×2 de cards de escenario con iconos emoji.

### 13. OverrideEditor (sistema de overrides)
Inline editor para cant/precio con badge "Modificado" y botón revertir.

## Layout Principal

```
┌─────────────────────────────────────────────┐
│ HEADER: BMC Uruguay · Panelin v3.0  [🗑][🖨] │
├─────────────────────────────────────────────┤
│ PROGRESS: [Proyecto] [Panel] [Bordes] [Opc] │
├──────────────────┬──────────────────────────┤
│ LEFT (inputs)    │ RIGHT (results)          │
│ ┌──────────────┐ │ ┌──────────────────────┐ │
│ │Lista precios │ │ │ KPI: m² Pan Apy Fij │ │
│ ├──────────────┤ │ ├──────────────────────┤ │
│ │ Escenario    │ │ │ Alerts / Warnings    │ │
│ │ 🏠🏢🏗❄️     │ │ ├──────────────────────┤ │
│ ├──────────────┤ │ │ BOM Table (groups)   │ │
│ │ Proyecto     │ │ │ PANELES    $xxx.xx   │ │
│ ├──────────────┤ │ │ FIJACIONES $xxx.xx   │ │
│ │ Panel        │ │ │ PERFILERÍA $xxx.xx   │ │
│ │ fam+esp+col  │ │ ├──────────────────────┤ │
│ ├──────────────┤ │ │ ┌──────────────────┐ │ │
│ │ Dimensiones  │ │ │ │ Sub s/IVA  $xxxx │ │ │
│ ├──────────────┤ │ │ │ IVA 22%    $xxxx │ │ │
│ │ Bordes       │ │ │ │ TOTAL  USD $xxxx │ │ │
│ ├──────────────┤ │ │ └──────────────────┘ │ │
│ │ Estructura   │ │ ├──────────────────────┤ │
│ ├──────────────┤ │ │ Condiciones + banco  │ │
│ │ Opciones     │ │ ├──────────────────────┤ │
│ ├──────────────┤ │ │ [WhatsApp] [PDF]     │ │
│ │ Aberturas    │ │ ├──────────────────────┤ │
│ └──────────────┘ │ │ Transparencia ▾      │ │
│                  │ └──────────────────────┘ │
└──────────────────┴──────────────────────────┘
```
