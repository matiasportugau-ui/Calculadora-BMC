# Inventory — Calculadora-BMC TruckVisual

| Path | Role |
|------|------|
| `src/components/logistica/TruckVisual.jsx` | Procedural cab/bed/wheels/driver + lights |
| `src/utils/logistica/truckAxles.js` | Pure `axleCount` (≤6 → 2, else 3) |
| `src/components/logistica/LogisticaCargoScene3d.jsx` | Scene wire + lighting + CargoBox |
| `src/components/BmcLogisticaApp.jsx` | Chip “Cabina BMC · click → luces 10s” |
| `tests/truckAxles.test.js` | Unit + structural wire |
| `public/panelin-character/body_base.png` | Panelín fallback texture |
| `public/bmo-mascot.png` | Preferred Panelín (optional; may be missing) |

**Do not touch:** packing utils, free-drag, bed mirror, `shiftX` math.
