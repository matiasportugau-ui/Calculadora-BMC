# Launchpad X — Configuración completa con Ableton Live

Guía para vincular el Novation Launchpad X con Ableton Live.

---

## 1. Conexión física

1. Conecta el Launchpad X al Mac por **USB**.
2. Enciende el Launchpad (se ilumina al conectar).
3. **Importante:** No ejecutes `npm run launchpad` mientras uses Ableton — solo una app puede recibir MIDI del dispositivo a la vez.

---

## 2. Configuración en Ableton Live

### 2.1 Abrir preferencias MIDI

1. Abre **Ableton Live**.
2. Menú **Live** (o **Ableton Live**) → **Preferences** (o **Preferencias**).
3. Pestaña **Link / Tempo / MIDI** (o **Link / Tempo / MIDI**).

### 2.2 Activar el Launchpad X como Control Surface

En la sección **Control Surface**:

| Campo | Valor |
|-------|-------|
| **Input** | Launchpad X |
| **Output** | Launchpad X |
| **Control Surface** | Launchpad X (si aparece en el desplegable) |

Si no ves "Launchpad X" como Control Surface, elige **Launchpad** o **Novation Launchpad** según tu versión de Live.

### 2.3 Configurar puertos MIDI

En **MIDI Ports** (Input / Output):

| Dispositivo | Track | Sync | Remote |
|------------|-------|------|--------|
| **Launchpad X** (Input) | ✅ | ⬜ opcional | ✅ |
| **Launchpad X** (Output) | ✅ | ⬜ opcional | ✅ |

- **Track:** permite enviar/recibir notas MIDI.
- **Remote:** permite control remoto de parámetros de Live.
- **Sync:** sincronización de tempo (opcional).

### 2.4 Guardar

Cierra las preferencias. Ableton detectará el Launchpad automáticamente.

---

## 3. Modos del Launchpad X

El Launchpad X tiene varios modos. Para Ableton, los más útiles son:

| Modo | Uso en Ableton |
|------|-----------------|
| **Session** | Cuadrícula de clips (8x8), lanzar clips, grabar |
| **Drum** | Drum Rack — pads como instrumentos de batería |
| **Note** | Teclado cromático para melodías |
| **Custom** | Mapeos personalizados |

Para cambiar de modo: mantén presionado el botón de modo y usa los pads superiores, o consulta el manual de Novation.

---

## 4. Drum Rack (Drum Mode)

Para usar el Launchpad como pad de batería:

1. Crea un **Drum Rack** en una pista.
2. El Drum Rack debe estar en **MIDI Channel 2** o **All Channels**.
3. Pon el Launchpad en **Drum Mode** (o Note Mode si Live lo mapea automáticamente).
4. Los pads se mapean a las celdas del Drum Rack.

---

## 5. Session View (clips)

En **Session View**:

- Cada pad = un slot de clip.
- Pulsa un pad vacío para grabar.
- Pulsa un clip existente para reproducirlo.
- Los pads superiores suelen controlar stop de pista, solo, arm, etc.

---

## 6. Verificación rápida

1. Crea una pista MIDI con un instrumento o Drum Rack.
2. Arma la pista (botón rojo **Record**).
3. Toca pads del Launchpad — deberías oír sonido.
4. En Session View, los pads deberían iluminarse según el estado de los clips.

---

## 7. Cambiar entre BMC y Ableton

| Uso | Qué hacer |
|-----|-----------|
| **Ableton Live** | No ejecutes `npm run launchpad`. Usa solo Ableton. |
| **BMC Dev** | Cierra Ableton (o desactiva el Launchpad en Preferencias MIDI). Ejecuta `npm run launchpad`. |

Solo una aplicación puede usar el Launchpad a la vez.

---

## 8. Referencias

- [Novation — Setup Launchpad X with Ableton Live](https://support.novationmusic.com/hc/en-gb/articles/360019882359)
- [Using Novation controllers with Drum Mode](https://support.novationmusic.com/hc/en-gb/articles/360012386459)
- Manual de usuario Launchpad X (PDF en novationmusic.com)
