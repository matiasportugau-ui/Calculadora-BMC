# DGI — Documento de Ingesta para Claude

**Propósito:** Proveer a Claude el contexto completo y estructurado sobre el dominio DGI/fiscal de BMC Uruguay y METALOG SAS, para que cualquier agente o conversación pueda operar con mínimo onboarding.  
**Fuentes:** `DGI-DEFENSA-EQUIPO-Y-SISTEMA-METALOG.md`, `SKILL.md`, `reference.md`, `FISCAL-PROTOCOL-STATE-RANKING.md`, `examples.md`.  
**Fecha de ingesta:** 2026-04-05. Validar normativa con profesional habilitado antes de actuar.

---

## BLOQUE 1 — Entidades y contexto operativo

### Empresa bajo análisis

| Campo | Valor |
|-------|-------|
| Razón social | METALOG SAS |
| RUT | `120403430012` |
| Tipo societario | SAS (Sociedad por Acciones Simplificada) |
| Régimen tributario | IRAE general (igual que SRL a efectos tributarios) |
| Expediente activo | `2026 05 005 17 07 54` — validar siempre en DOMEL/expediente electrónico |
| Período observado | Diciembre 2024 (01/12/2024) |
| Proyecto relacionado | BMC Uruguay — `calculadora-bmc.vercel.app` |

### Monto y composición del ajuste DGI

| Concepto | Monto aprox. (UYU) | % del total |
|----------|--------------------|-------------|
| IVA régimen no CEDE | ~1.544.000 | ~95% |
| IRAE saldo/anticipos | residual | ~3% |
| IP anticipo | residual | ~2% |
| **Total** | **~1.625.265** | 100% |

### Tipo de actuación

- **Vista Art. 46 — Código Tributario:** instancia previa a resolución definitiva.
- Actuación 3 del expediente.
- Plazo típico: **15 días hábiles** desde notificación para presentar descargos.
- Prueba usada por DGI: movimientos débito/crédito y formularios **1050** y **2178** del período 12/24.

---

## BLOQUE 2 — Marco normativo mínimo (resumen operativo)

### Código Tributario — Vista (Art. 46)
- Abre instancia previa a resolución definitiva.
- Plazo de respuesta: 15 días hábiles (registrar fecha de notificación desde día 1).
- Resultado posible: descargo técnico, rectificativa, pago, o combinación.

### IVA — Regla base de conciliación DGI
```
IVA débito (CFE emitidos/ventas)
- IVA crédito (CFE recibidos/compras)
= Saldo IVA del período
```
Puntos críticos:
- Facturas emitidas sin nota de crédito ante anulación/devolución.
- Créditos fiscales no reconocidos por error de RUT, emisión o proveedor observado.
- Desfasajes entre fecha de CFE y período declarado.
- Notas de crédito mal vinculadas a la factura origen.

### IRAE — SAS
- Tributa igual que SRL.
- Umbral régimen ficto: **4.000.000 UI** — revisar impacto en anticipos/liquidación.

### Impuesto al Patrimonio (IP)
- Revisar alta y valuación de activos.
- Exoneraciones posibles bajo COMAP sobre bienes elegibles.

### Formularios clave
| Formulario | Uso |
|------------|-----|
| **1050** | Declaración jurada IVA mensual |
| **2178** | Declaración jurada IRAE / anticipos |

### CFE — Comprobante Fiscal Electrónico
- Fuente oficial de conciliación DGI.
- Se exportan desde DGI Servicios en Línea (emitidos y recibidos).
- Campos mínimos: tipo, serie, número, fecha, RUT contraparte, neto, IVA, total.

---

## BLOQUE 3 — Beneficios e instrumentos disponibles (SAS Uruguay)

| Instrumento | Para qué sirve | Prueba requerida |
|-------------|----------------|------------------|
| COMAP (Dec. 329/025) | Exoneraciones por inversión elegible (IRAE/IP) | Proyecto de inversión + soporte de ejecución |
| IRAE ficto | Simplificación/cambio de base según umbral | Control de ingresos en UI y régimen vigente |
| Régimen software | Exoneración de renta de software (condicional) | Sustancia económica, personal calificado, actividad en UY |
| BROU | Financiamiento pyme/capital de trabajo | Carpeta económico-financiera y destino |
| ANDE | Fortalecimiento pyme y apoyo técnico | Perfil empresa y proyecto |
| ANII | Apoyo a innovación y desarrollo | Proyecto I+D+i y plan de resultados |
| INEFOP | Subsidios/capacitación de personal | Programa formativo y elegibilidad |

---

## BLOQUE 4 — Flujo de trabajo estándar (6 pasos)

```
[ ] 1. Recolectar y validar inputs del período
[ ] 2. Normalizar estructura de datos DGI / facturación / banco
[ ] 3. Conciliar IVA débito, crédito y anticipos
[ ] 4. Detectar inconsistencias y clasificar causas
[ ] 5. Emitir reporte ejecutivo + detalle técnico
[ ] 6. Preparar borrador de defensa (si hay Vista Art. 46)
```

### Paso 2 — Modelo de tres columnas

| Col A: DGI | Col B: Sistema interno | Col C: Banco/caja |
|------------|------------------------|-------------------|
| CFE emitidos/recibidos | Ventas, NC, compras registradas | Extractos BROU (opcional) |

Normalizar: tipo comprobante, serie, número, fecha, RUT emisor/receptor, neto, IVA, total.

### Paso 4 — Etiquetas de causa (usar siempre estas)

| Etiqueta | Significado |
|----------|-------------|
| `venta_sin_respaldo` | Venta registrada en DGI sin CFE correspondiente interno |
| `nc_faltante_o_mal_vinculada` | Nota de crédito ausente o no asociada a factura origen |
| `credito_fiscal_observado` | DGI no reconoce el crédito fiscal por RUT/emisión/proveedor |
| `desfase_periodo` | CFE y período declarado no coinciden |
| `anticipo_no_imputado` | Anticipo pagado no aplicado en la liquidación |
| `dato_incompleto` | Información insuficiente para clasificar |

---

## BLOQUE 5 — Inputs requeridos por período

### Desde DGI (Servicios en Línea)
1. CFE emitidos del período → Excel/CSV.
2. CFE recibidos del período → Excel/CSV.
3. Formularios precargados: **1050** y **2178** (PDF/Excel/capturas).
4. Expediente completo: Providencia actuación 3, Informe actuación n.º 1, anexos, actas.
5. Notificaciones y fecha de cómputo de plazo.

Convención de nombres: `fuente_rut_YYYYMM_tipo.ext`  
Ejemplo: `dgi_120403430012_202412_cfe_emitidos.csv`

### Desde sistema de facturación (ej. Factura Express)
1. Ventas emitidas del período.
2. Notas de crédito emitidas (con referencia a factura origen).
3. Compras registradas (si el sistema las tiene).

### Desde banco (BROU — opcional)
- Extractos del período para validar trazabilidad cobros/pagos.
- Usar como capa de validación secundaria, **nunca** como reemplazo de CFE.

### Legal/proceso
- Copia del acta de notificación.
- Poderes de representación vigentes.

---

## BLOQUE 6 — Checklist rápido para análisis de Vista

1. Fecha exacta de notificación y fecha límite (15 días hábiles).
2. Período observado y tributos impactados.
3. Diferencia principal cuantificada (normalmente IVA).
4. CFE emitidos no conciliados.
5. Notas de crédito faltantes o mal vinculadas.
6. Créditos fiscales observados/no reconocidos.
7. Anticipos no imputados o mal aplicados.
8. Carpeta de evidencia por hallazgo (archivo fuente + explicación).

---

## BLOQUE 7 — Equipo humano obligatorio

| Rol | Responsabilidad |
|-----|-----------------|
| Representante / director de METALOG | Decisiones, firma de poderes, prioridad de negocio |
| **Contador matriculado** | DJ, rectificativas, cuadros 1050/2178, coordinación con sistema de facturación |
| **Abogado tributario** | Plazos, forma del descargo, cedulón/notificación, recursos o acuerdos |

> Los agentes Claude organizan y analizan información. **No reemplazan** la presentación ni la responsabilidad legal/contable.

---

## BLOQUE 8 — Equipo de agentes (mapa a este caso)

| Agente | Rol en contexto DGI |
|--------|---------------------|
| `bmc-fiscal` / `bmc-dgi-impositivo` | Conciliación, etiquetado de diferencias, checklist de descargo técnico |
| `bmc-implementation-plan-reporter` | Plan por fases, entregables, handoff a contador/abogado |
| `bmc-orchestrator` | Coordina paralelos (export CFE + export interno) y series (conciliar → narrativa descargo) |
| `billing-error-review` | Si el ajuste IVA involucra duplicados, NC mal aplicadas o inconsistencias de facturación |
| `bmc-security` | Gestión de `.env`, credenciales DGI, no subir PDFs con datos sensibles a repos públicos |

---

## BLOQUE 9 — Sistema de archivos estable (estructura recomendada)

```
DGI_METALOG/
  expediente-2026-05-005-17-07-54/
    00_actas_y_notificaciones/
    10_dgi_exports/
    20_interno_facturacion/
    30_conciliaciones/
    40_descargos_borradores/
    99_README.md   ← qué hay en cada subcarpeta y última fecha
```

### Proceso mensual (15–30 min)
1. Export DGI CFE emitidos/recibidos del mes cerrado.
2. Export del sistema de facturación del mismo mes.
3. Ejecutar conciliación (`scripts/conciliar_cfe.py`).
4. Guardar un Excel/PDF de "cierre IVA" con totales y diferencias = 0 o explicadas.
5. Respaldar DJ presentadas.

---

## BLOQUE 10 — Orden de trabajo inmediato (semana actual)

| Paso | Responsable | Acción |
|------|-------------|--------|
| 1 | Contador + abogado | Fijar **plazo exacto** y **forma** de presentación |
| 2a | Contador | Bajar expediente completo de DOMEL |
| 2b | Interno | Exportar CFE emitidos/recibidos 12/2024 |
| 2c | Contador | DJ, 1050 y 2178 del período |
| 3 | Fiscal (agente + humano) | Conciliar IVA; tabla por línea del informe de liquidación |
| 4 | Fiscal + contador | Borrador de descargo con anexos numerados |
| 5 | Contador + abogado | Revisión dual antes de enviar |

---

## BLOQUE 11 — Reglas de operación para Claude

1. **No inventar** normativa, montos ni estados del expediente.
2. **Diferenciar** hechos verificados vs hipótesis (marcar explícitamente).
3. **Un paso `in_progress`** a la vez durante ejecución.
4. **Enfocar primero** en el período notificado; luego expandir a colindantes si el informe los cruza.
5. **No dar asesoramiento legal definitivo** — siempre incluir disclaimer profesional.
6. **Citar fuentes** documentales usadas (archivo, período, portal).
7. **No commitear** PDF del expediente ni credenciales al repo.
8. **No hardcodear** RUT ni sheet IDs en código de producción.

---

## BLOQUE 12 — Formato de salida obligatorio

Cuando Claude actúe en contexto DGI, responder en este orden:

1. **Hallazgos críticos** (priorizados por monto/riesgo)
2. **Evidencia y trazabilidad** (archivos/períodos usados)
3. **Escenarios de acción** (con riesgos asociados)
4. **Próximo paso operativo** (quién, qué, cuándo)
5. **Disclaimer profesional**

---

## BLOQUE 13 — Artefactos internos disponibles

| Artefacto | Ruta | Uso |
|-----------|------|-----|
| Skill fiscal principal | `.cursor/skills/bmc-dgi-impositivo/SKILL.md` | Flujo estándar y reglas de conciliación |
| Referencia normativa | `.cursor/skills/bmc-dgi-impositivo/reference.md` | Normativa resumida y guía de extracción |
| Script conciliación | `.cursor/skills/bmc-dgi-impositivo/scripts/conciliar_cfe.py` | Apoyo a conciliación con CSV normalizados |
| Script extracción | `.cursor/skills/bmc-dgi-impositivo/scripts/extraer_cfe_mensual.py` | Extracción mensual CFE |
| Ejemplos de uso | `.cursor/skills/bmc-dgi-impositivo/examples.md` | Casos de uso y formato de entrega |
| Ranking criticidad | `docs/team/fiscal/FISCAL-PROTOCOL-STATE-RANKING.md` | Niveles Crítico/Alto/Medio/Bajo |
| Este documento | `docs/team/fiscal/DGI-CLAUDE-INGESTA.md` | Ingesta consolidada para onboarding |

---

## Disclaimer

Documento de trabajo interno BMC. No sustituye dictamen de contador ni abogado tributario. Toda presentación formal ante DGI debe ser validada por profesionales habilitados. Normativa citada vigente al 2026-04-05 — verificar ante cambios regulatorios.
