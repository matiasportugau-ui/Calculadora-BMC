# BMC Envíos / Logística — índice de la familia SDD

Documentación de diseño de la sección de logística: cotización de flete, `/logistica` (ops), `/conductor` (PWA) y todo lo que va desde una venta confirmada hasta la entrega firmada.

**Empezá por acá:** si venís a entender el sistema, leé [`SDD-LOGISTICA-REVISION-2026-08-08.md`](./SDD-LOGISTICA-REVISION-2026-08-08.md) — es el inventario as-built completo y el más reciente. El resto son documentos de profundidad por tema.

## Núcleo

| Archivo | Rol | Estado |
|---|---|---|
| [`SDD.md`](./SDD.md) | SDD padre: C4, ADRs, riesgos, glosario. Fuente de verdad de las decisiones | As-Built v1.8 |
| [`SDD-LOGISTICA-REVISION-2026-08-08.md`](./SDD-LOGISTICA-REVISION-2026-08-08.md) | **Inventario as-built completo** sección por sección: rutas, componentes, kernel puro, endpoints, tablas, tests, diagnóstico del visor, estado de geo, deuda del modelo de datos | As-Built v1.0 |
| [`TARGET.md`](./TARGET.md) | Definición de terminado por ola de trabajo | — |
| [`RECREATION-CHECKLIST.md`](./RECREATION-CHECKLIST.md) | Cómo recrear el módulo desde cero | — |

## Por tema

| Archivo | Rol | Estado |
|---|---|---|
| [`SDD-3D-VISOR.md`](./SDD-3D-VISOR.md) | Visor 3D de estiba + camión `TruckVisual`. Incluye el diagnóstico V1–V8 | Implementado, con fallos abiertos |
| [`SDD-GEO-MAPS.md`](./SDD-GEO-MAPS.md) | Diseño de geolocalización y mapas: Leaflet + OSM + OSRM, `DeliveryPoint`, `RoutePlan` | **TARGET — 0 % implementado** |
| [`SDD-ENVIO-WIZARD.md`](./SDD-ENVIO-WIZARD.md) | Wizard por etapas: Pedidos → Flota → Levantes → Ruta | Implementando |
| [`SDD-REPARTO-COORDINACION.md`](./SDD-REPARTO-COORDINACION.md) | Coordinación de reparto, `REP-YYYY-MM-DD-NNN`, FSM de estados | Implementado (MVP) |
| [`SDD-ETIQUETAS-BULTOS.md`](./SDD-ETIQUETAS-BULTOS.md) | Etiquetas de bulto y de encomienda para agencias, numeración k/N, A4 | **TARGET** |
| [`SDD-REMITO-CLIENTE.md`](./SDD-REMITO-CLIENTE.md) | Remito de entrega por cliente (POD firmable, dos copias) | **TARGET** |
| [`SDD-OPS-UX-WAVE.md`](./SDD-OPS-UX-WAVE.md) | Ola de UX operativa F1–F6 | Shipped |
| [`SDD-OPS-UX-WAVE-2.md`](./SDD-OPS-UX-WAVE-2.md) | Ola de UX operativa F7–F11 | Shipped |
| [`DESIGN-UI.md`](./DESIGN-UI.md) | Lenguaje visual Liquid Glass: tokens, superficies, accesibilidad | Contrato |

## Operación

| Archivo | Rol |
|---|---|
| [`HOW-IT-WORKS-VENTAS-LOGISTICA.md`](./HOW-IT-WORKS-VENTAS-LOGISTICA.md) | Runbook del operador: Ventas → Logística |

## Auditoría y evidencia

| Archivo | Rol |
|---|---|
| [`audit/AUDIT.md`](./audit/AUDIT.md) | Puntaje y hallazgos |
| [`audit/GAP-PLAN.md`](./audit/GAP-PLAN.md) | Brechas abiertas con severidad y responsable |
| [`audit/IDEAL-TARGET.md`](./audit/IDEAL-TARGET.md) | Qué significa 100 para este sistema |
| [`audit/SCORECARD.json`](./audit/SCORECARD.json) | Puntaje estructurado |
| [`evidence/INDEX.md`](./evidence/INDEX.md) | Índice de evidencia E-xx con comandos de reverificación |

## Relacionados fuera de esta carpeta

| Archivo | Rol |
|---|---|
| `docs/sdd/calculadora-bmc/SDD.md` | Plataforma: SPA, API, deploy, auth |
| `docs/team/SDD-CALCULADORA-FLETES.md` | Motor de tarifas de flete (legacy, superado por `SDD.md` de esta carpeta) |
| `docs/bmc-dashboard-modernization/logistica-carga-prototype/README.md` | Reglas de dominio de bultos: paneles máximos por paquete según espesor |

## Política de evidencia

Todos los documentos de esta familia etiquetan sus afirmaciones:

| Etiqueta | Significado |
|---|---|
| `CONFIRMED` | Verificado leyendo el archivo citado |
| `INFERRED` | Deducido de código o docs, no ejecutado |
| `TARGET` | Diseñado pero **no implementado** |

Si un documento describe algo que no existe todavía, tiene que decirlo. Un lector debe poder distinguir el sistema real del sistema deseado sin abrir el código.
