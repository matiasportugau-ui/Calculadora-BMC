# DGI — Equipo de recolección, defensa y sistema estable (METALOG SAS)

**Propósito:** Definir quién pide qué, con qué orden, y cómo dejar un **sistema repetible** (no solo este expediente).  
**Alcance:** METALOG SAS, RUT `120403430012`, expediente `2026 05 005 17 07 54` (referencia operativa; validar siempre en DOMEL/expediente electrónico).

**Disclaimer:** Documento de trabajo interno BMC. No sustituye dictamen de contador ni abogado.

---

## 1. Lectura de la situación (síntesis)

| Elemento | Contenido operativo |
|----------|---------------------|
| Trámite | **Vista** por **Art. 46** del Código Tributario — otorgamiento de vista (actuación 3), plazo típico **15 días hábiles** para defensa / revisión del legajo (confirmar en el acto y en expediente). |
| Origen del monto | **Control extensivo** — informe de liquidación (documento de trabajo) con foco **período 01/12/2024** (diciembre 2024). |
| Montos (orden de magnitud) | Total ~**1.625.265** UYU; **~95%** corresponde a **IVA régimen no CEDE**; el resto IRAE saldo/anticipos e IP anticipo. |
| Prueba que usa DGI | Referencias a movimientos **débito-crédito** y formularios **1050** y **2178** período **12/24** (y números de movimiento citados en el informe). |
| Notificación física | Acta/cédulón si no hubo recepción personal — **validar con asesor** cómo corre el plazo y la prueba de notificación. |
| Incertidumbre a cerrar | Fecha exacta de **inicio de plazo** si hay discrepancia entre acta (anotaciones manuscritas de año) y fechas del sistema; resolver solo con expediente oficial y profesional. |

---

## 2. Equipo mínimo (humanos, obligatorio)

| Rol | Responsabilidad |
|-----|-----------------|
| **Representante / director de METALOG** | Decisiones, firma de poderes, prioridad de negocio, contacto con estudio. |
| **Contador matriculado** | DJ, rectificativas, cuadros 1050/2178, coordinación con sistema de facturación, formato de presentación ante DGI. |
| **Abogado tributario (o estudio con práctica DGI)** | Plazos, forma del descargo, cedulón/notificación, recursos o acuerdos según estrategia. |

Sin estos tres pilares, el “equipo de agentes” solo organiza información; **no reemplaza** presentación ni responsabilidad legal.

---

## 3. Equipo BMC (agentes y roles del repo) — mapa a este caso

Invocación sugerida: **Orquestador** coordina; no hace falta “full team” completo: solo los roles que aportan a **fiscal + datos + informe**.

| Rol §2 (PROJECT-TEAM-FULL-COVERAGE) | Qué aporta aquí |
|-------------------------------------|----------------|
| **Fiscal** (`bmc-dgi-impositivo`) | Modelo de conciliación DGI ↔ facturación ↔ banco; etiquetado de diferencias; checklist de descargo técnico. |
| **Reporter** (`bmc-implementation-plan-reporter`) | Plan por fases, entregables, handoff a contador/abogado, criterios de “listo”. |
| **Orchestrator** | Orden paralelo/serie: p. ej. paralelo “export CFE + export interno”; serie “conciliar → narrativa descargo”. |
| **Billing** (`billing-error-review`) | Si el ajuste IVA involucra duplicados, NC mal aplicadas o inconsistencias de facturación administrativa. |
| **Security** (`bmc-security-reviewer`) | Manejo de `.env`, credenciales DGI, no subir PDFs con datos sensibles a repos públicos. |
| **Parallel/Serial** | Decidir qué tareas humanas van en paralelo (contador baja expediente mientras interno exporta CFE). |
| **MATPROMT** (opcional) | Si se hace un “run” documental: prompts por rol para una sesión enfocada en DGI. |

**SIM / PANELSIM:** no central para defensa DGI salvo que el error vincule datos de CRM/ventas; usar solo si hay puente demostrable.

---

## 4. Qué información recabar (checklist por fuente)

### 4.1 DGI (Servicios en línea + expediente)

- Expediente completo: **Providencia actuación 3**, **Informe de actuación n.º 1**, anexos, actas.
- Notificaciones y **fecha** que use DGI para el cómputo.
- Exports oficiales **CFE emitidos y recibidos** (diciembre 2024 y, si el informe cruza meses, meses colindantes).
- Declaraciones **IVA** y **rectificativas** del período; capturas/PDF de **1050** y **2178** 12/24.
- Estado de **DOMEL** y constancias si aplican.

### 4.2 Interno (facturación / ERP / planillas)

- Ventas emitidas, **NC**, anulaciones; compras registradas; libro que use el contador para 1050/2178.
- Archivo de **numeración** y **vínculo NC–factura origen**.

### 4.3 Banco (opcional pero útil)

- Extractos del período para **grandes desfasajes** cobro/pago vs imputación IVA (capa de validación, no sustituto de CFE).

### 4.4 Legal / proceso

- Copia del **acta de notificación** y registro de **quién** puede representar (poderes).

---

## 5. Sistema estable para el futuro (diseño recomendado)

Objetivo: que **cada mes** y ante cualquier fiscalización haya **misma estructura de datos**, sin improvisar.

### 5.1 Carpeta y nombres (fuera del repo o repo privado)

```
DGI_METALOG/
  expediente-2026-05-005-17-07-54/
    00_actas_y_notificaciones/
    10_dgi_exports/
    20_interno_facturacion/
    30_conciliaciones/
    40_descargos_borradores/
    99_README.md   # qué hay en cada subcarpeta y última fecha
```

Convención de archivo: `fuente_rut_YYYYMM_tipo.csv` (alineado al skill `bmc-dgi-impositivo`).

### 5.2 Proceso mensual (15–30 min)

1. Export DGI CFE emitidos/recibidos del mes cerrado.  
2. Export del sistema de facturación del mismo mes.  
3. Ejecutar conciliación (ver §5.3).  
4. Guardar **un** Excel/PDF de “cierre IVA” con totales y diferencias = 0 o explicadas.  
5. Respaldar DJ presentadas.

### 5.3 Herramientas ya en este repo

| Artefacto | Uso |
|-----------|-----|
| Skill **bmc-dgi-impositivo** | Flujo estándar y etiquetas de causa de diferencia. |
| `scripts/conciliar_cfe.py` | Apoyo a conciliación cuando tengas CSV normalizados. |
| Tabla maestra defensa | “DGI dice X / nosotros Y / prueba Z” por línea del informe. |

### 5.4 Mejora futura (opcional, si querés automatizar más)

- Script que lea dos CSV (DGI + interno) y liste solo **filas divergentes** (sin subir secretos al remoto).  
- Plantilla Markdown de **descargo** con secciones fijas (hechos, derecho, prueba, petitorio) rellenada por Fiscal + revisada por abogado.

### 5.5 Qué no hacer

- No commitear PDF del expediente ni credenciales.  
- No hardcodear RUT/sheet IDs en código de producción.  
- No confiar solo en “opinión” sin **CFE + DJ** alineados.

---

## 6. Orden de trabajo sugerido (esta semana)

1. **Contador + abogado:** fijar **plazo** y **forma** de presentación.  
2. **Paralelo:** bajar expediente completo; exports CFE 12/2024; DJ y 1050/2178.  
3. **Fiscal (agente + humano):** conciliar IVA; tabla por línea del informe de liquidación.  
4. **Borrador descargo** con anexos numerados.  
5. **Revisión dual** contable + legal antes de enviar.

---

## 7. Enlaces internos

- Skill: `.cursor/skills/bmc-dgi-impositivo/SKILL.md`  
- Referencia operativa: `.cursor/skills/bmc-dgi-impositivo/reference.md`  
- Ranking protocolo fiscal: `docs/team/fiscal/FISCAL-PROTOCOL-STATE-RANKING.md` (si existe)

---

*Última actualización del documento: 2026-03-24.*
