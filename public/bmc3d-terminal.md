# BMC 3D Terminal

Abrir directamente:
```bash
open /Users/matias/calculadora-bmc/public/bmc3d-terminal.html
```

O mientras corres el dev server:
```
cd ~/calculadora-bmc
npm run dev
# luego visitar http://localhost:5173/bmc3d-terminal.html
```

## Atajos (terminal style)
- A → agregar pared
- R → agregar techo
- Q → Build + Quote instantáneo
- P → Export PDF
- Espacio → simular física (Rapier o fallback)
- Doble click → rotar panel seleccionado
- Drag → mover

Flags honrados:
--empathy "Entiendo tu necesidad en UY"
--physics rapier-collision
--mode sims-builder
--calc bmc-walls-roofs
--quote instant
--export pdf
--dev full

El prototipo usa:
- Three.js (r134 CDN)
- Rapier3D (compat)
- jsPDF para export cliente
- Lógica de cálculo simplificada pero fiel (pared + techo) basada en el motor real de src/utils/calculations.js

Sincronización bidireccional + integración React + @react-three/rapier real → siguiente paso.
