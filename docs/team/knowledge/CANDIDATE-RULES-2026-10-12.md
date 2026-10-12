# Reglas Candidatas Destiladas — 2026-10-12

**Origen**: 45 correcciones humanas analizadas en `Log Cotizaciones` vía Grok-3 (xAI).  
**Protocolo**: G4 (permanecen como `status: "candidate"` hasta promoción o caducidad el 2026-10-26).  
**Ubicación canónica**: [`bmc-sheet-quote-pipeline/knowledge/lessons.json`](file:///Users/matias/bmc-sheet-quote-pipeline/knowledge/lessons.json) y reflejado en [`bmc-sheet-quote-pipeline/knowledge/KNOWLEDGE.md`](file:///Users/matias/bmc-sheet-quote-pipeline/knowledge/KNOWLEDGE.md) (enlazado desde `~/.ialfred/kb/bmc-brain-KNOWLEDGE.md`).

---

## Selección de Reglas Candidatas para IAlfred / Equipo

### 1. `[geometria]` · conf=0.85 · ID: `79a7d426-3c1e-466e-ae13-10d895901bbf`
- **Trigger**: `consulta menciona 'medidas en chat' o 'medidas en WhatsApp' o 'planos en wpp'`
- **Regla**: NO preguntar medidas exactas ni geometría; registrar como 'pendiente extraer de chat/WPP' y proceder con familia/espesor/color/estructura inferidos (Blanco/metal). Usar medidas ya definidas en contexto previo si existen.
- **Razón**: Los humanos no re-preguntan medidas cuando el cliente ya las envió por WhatsApp o en un plano; infieren defaults y dejan la extracción pendiente para no frustrar al cliente.

### 2. `[escenario]` · conf=0.85 · ID: `310fca7e-c1c0-4900-b2e4-280b92496e69`
- **Trigger**: `consulta menciona Isodec/Isopanel sin tipoEst explícito y contexto paneles sueltos o presupuesto libre`
- **Regla**: Inferir tipoEst=metal por default. NO preguntar estructura salvo contexto de obra con hormigón o indicación contraria.
- **Razón**: BMC comercializa 95%+ de paneles fijados sobre estructura metálica. Preguntar el tipo de estructura en un presupuesto libre solo agrega fricción.

### 3. `[escenario]` · conf=0.80 · ID: `aa6ee5cf-247c-46a6-acf8-148474d98ca0`
- **Trigger**: `consulta menciona 'completo' + familia techo/pared sin tipoEst`
- **Regla**: Inferir tipoEst=metal; incluir kit de materiales (fijaciones+remates) pero NO mano de obra. NO preguntar estructura.
- **Razón**: El equipo BMC no cotiza jornales de instalación; "completo" siempre se resuelve como kit de perfilería, tornillos y fijaciones sobre estructura metálica estándar.

### 4. `[general]` · conf=0.85 · ID: `e5325d8b-afc4-4075-96e4-65925b782977`
- **Trigger**: `consulta menciona link MLU o artículo MercadoLibre`
- **Regla**: Marcar HITL + no auto-send. Extraer familia/espesor del link; pedir zona y confirmar sentido de paneles si aplica. NO cotizar automáticamente.
- **Razón**: Los leads originados por artículos de Mercado Libre requieren revisión humana antes de emitir presupuesto para evitar discrepancias con la publicación.

---

## Estado en el Pipeline
- **En producción**: 27 reglas activas (en tab `Conocimiento` y `lessons.json`).
- **En staging / G4**: Estas 4 reglas quedan registradas en `lessons.json`, visibles para IAlfred en `~/.ialfred/kb/` y listas para ser tenidas en cuenta en las próximas corridas o promovidas a `active` cuando el equipo lo valide.
