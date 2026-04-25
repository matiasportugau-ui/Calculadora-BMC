# /bmc-claude-workspace — Multi-terminal Claude workspace

Crea (o reconecta a) el workspace de 5 terminales tmux del proyecto BMC,
cada una con Claude Code especializado y lista para recibir instrucciones
desde el conductor.

## Arquitectura

```
  0 🎯 conductor  — esta terminal. Shell con helpers bmc-send/bmc-read/bmc-broadcast
  1 🔵 calc       — Claude: calculadora BOM / pricing / constants
  2 🟢 server     — Claude: API Express / rutas / Sheets / WA
  3 🟡 tests      — Claude: gate lint+tests / Playwright
  4 🟣 ops        — Claude: git / Vercel deploy / Cloud Run / docs
```

## Qué hacer cuando se invoca

### Paso 1 — Detectar estado actual
```bash
tmux -S /tmp/bmc-tmux.sock has-session -t bmc 2>/dev/null && echo EXISTS || echo MISSING
```

### Paso 2A — Si la sesión NO existe: crearla
Ejecutar el script de setup:
```bash
bash scripts/bmc-claude-workspace.sh
```
El script crea las 5 ventanas, inicia `claude` en cada una, espera a que
arranque, envía el rol como primer mensaje, y adjunta al conductor.

### Paso 2B — Si la sesión YA existe: reconectar
```bash
bash scripts/bmc-claude-workspace.sh attach
```
O mostrar el estado actual:
```bash
bash scripts/bmc-claude-workspace.sh status
```

### Paso 3 — Cargar helpers en el conductor
```bash
source scripts/bmc-claude-workspace.sh env
```
Esto deja disponibles en la shell del conductor:
- `bmc-send <ventana> <mensaje>` — envía instrucción a un agente
- `bmc-read <ventana> [N]` — lee las últimas N líneas de una ventana
- `bmc-ask <ventana> <tarea>` — envía tarea con prefijo "TAREA DEL CONDUCTOR:"
- `bmc-broadcast <mensaje>` — envía a calc + server + tests + ops simultáneamente
- `bmc-list` — lista todas las ventanas
- `bmc-status` — tabla de estado con puertos

### Paso 4 — Reportar al usuario

Mostrar la tabla de ventanas creadas con sus colores y roles.
Mostrar los comandos de uso rápido.
Si hubo errores al iniciar alguna ventana, reportarlos y ofrecer reintento.

## Ejemplos de uso post-setup

```bash
# Encargar una tarea al agente de calculadora
bmc-send calc "Actualizá el precio de ISODEC EPS 100mm a $45/m² en constants.js"

# Leer qué hizo el agente de server en las últimas 50 líneas
bmc-read server 50

# Pedirle al agente de tests que corra el gate
bmc-ask tests "Corré npm run gate:local y reportá resultado"

# Broadcast: pedir a todos que lean PROJECT-STATE.md
bmc-broadcast "Leé docs/team/PROJECT-STATE.md y confirmá que estás al día"

# Deploy via agente ops
bmc-send ops "Push a main y verificá que CI pase. Si pasa, desplegá a Vercel."
```

## Navegación tmux

- `Ctrl+B 0` — ir al conductor
- `Ctrl+B 1` — ir a calc
- `Ctrl+B 2` — ir a server
- `Ctrl+B 3` — ir a tests
- `Ctrl+B 4` — ir a ops
- `Ctrl+B n/p` — siguiente / anterior

## Troubleshooting

- **Claude no inicia en una ventana**: `bmc-send <win> "q"` para salir y luego `bmc-send <win> "claude"` para reiniciar
- **Socket perdido**: `bash scripts/bmc-claude-workspace.sh kill` y volver a crear
- **Puerto en uso al iniciar dev**: el workspace NO inicia servidores — eso lo hace cada agente cuando se lo pedís
