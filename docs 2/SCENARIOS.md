# 📋 Escenarios y Reglas de Visibilidad

## Los 4 Escenarios

### 🏠 Solo Techo (`solo_techo`)
Cubierta con ISODEC o ISOROOF. El escenario más común para barbacoas, tinglados, y cubiertas.

**Familias:** ISODEC_EPS, ISODEC_PIR, ISOROOF_3G, ISOROOF_FOIL, ISOROOF_PLUS

### 🏢 Solo Fachada (`solo_fachada`)
Paredes y cerramientos con ISOPANEL o ISOWALL. Para galpones, locales, naves.

**Familias:** ISOPANEL_EPS, ISOWALL_PIR

### 🏗 Techo + Fachada (`techo_fachada`)
Proyecto completo: cubierta + cerramientos. Requiere selección de panel de techo Y panel de pared.

**Familias:** Todas (7 familias)

### ❄️ Cámara Frigorífica (`camara_frig`)
Cerramientos térmicos para frío. Calcula paredes (4) + techo automáticamente desde dimensiones internas.

**Familias:** ISOPANEL_EPS, ISOWALL_PIR

**Lógica especial:**
```javascript
perímetro = 2 × (largo_int + ancho_int)
paredes = calcParedCompleto({ perímetro, alto: alto_int, esquinas: 4 ext + 0 int })
techo = calcTechoCompleto({ largo: largo_int, ancho: ancho_int, sin bordes, sin canalón })
```

## Reglas de Visibilidad (VIS)

| Sección UI | solo_techo | solo_fachada | techo_fachada | camara_frig |
|------------|:----------:|:------------:|:-------------:|:-----------:|
| **Bordes techo** | ✅ | ❌ | ✅ | ❌ |
| **Largo × Ancho** | ✅ | ❌ | ✅ | ❌ |
| **Alto × Perímetro** | ❌ | ✅ | ✅ | ❌ |
| **Esquineros** | ❌ | ✅ | ✅ | ✅ |
| **Aberturas** | ❌ | ✅ | ✅ | ✅ |
| **Dimensiones cámara** | ❌ | ❌ | ❌ | ✅ |
| **Autoportancia** | ✅ | ❌ | ✅ | ❌ |
| **Canalón / Got. Sup** | ✅ | ❌ | ✅ | ❌ |
| **Perfil 5852** | ❌ | ✅ (opt) | ✅ (opt) | ❌ |

## Implementación en Código

```javascript
const VIS = {
  solo_techo:    { borders: true, largoAncho: true, altoPerim: false, esquineros: false,
                   aberturas: false, camara: false, autoportancia: true, canalGot: true, p5852: false },
  solo_fachada:  { borders: false, largoAncho: false, altoPerim: true, esquineros: true,
                   aberturas: true, camara: false, autoportancia: false, canalGot: false, p5852: true },
  techo_fachada: { borders: true, largoAncho: true, altoPerim: true, esquineros: true,
                   aberturas: true, camara: false, autoportancia: true, canalGot: true, p5852: true },
  camara_frig:   { borders: false, largoAncho: false, altoPerim: false, esquineros: true,
                   aberturas: true, camara: true, autoportancia: false, canalGot: false, p5852: false },
};
```

## Sistema de Overrides

Permite editar manualmente cantidad o precio unitario de cualquier item del BOM.

### Identificador de Línea
```javascript
lineId = "GRUPO_TITULO-índice"
// Ejemplo: "FIJACIONES-0", "PERFILERÍA_TECHO-2"
```

### Aplicar Override
```javascript
overrides = {
  "FIJACIONES-0": { field: "cant", value: 12, reason: "manual", ts: "2026-03-04..." },
  "PANELES-0": { field: "pu", value: 40.00, reason: "descuento especial" }
}
```

### Efecto
- Si `field === "cant"`: nuevo total = value × pu original
- Si `field === "pu"`: nuevo total = cant × value
- Item se marca con `isOverridden: true` y fondo amarillo
- Badge "Modificado" + botón revertir

## Presets de Obra

Opciones rápidas para "Descripción de obra":
Vivienda, Barbacoa, Depósito comercial, Galpón industrial, Local comercial, Oficinas, Ampliación / Reforma, Nave logística, Taller, Cerramiento / Anexo, Tinglado / Cobertizo, Cámara frigorífica

## Opciones de Borde (solo techo)

### Frente
- `gotero_frontal` — Gotero simple
- `gotero_frontal_greca` — Gotero greca
- `none` — Sin perfil

### Fondo
- `gotero_frontal` — Gotero frontal
- `babeta_adosar` — Muro (adosar)
- `babeta_empotrar` — Muro (empotrar)
- `cumbrera` — Cumbrera
- `none` — Sin perfil

### Laterales (Izq / Der)
- `gotero_lateral` — Gotero lateral
- `gotero_lateral_camara` — Cámara
- `babeta_adosar` — Encuentro muro
- `none` — Sin perfil
