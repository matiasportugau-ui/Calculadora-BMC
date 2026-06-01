# Cotizar Button — Required Column Mapping (Source Sheet)

**Sheet:** "2.0 - Administrador de Cotizaciones"  
**ID:** `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0`  
**Main operational tab:** "Admin." (header typically on row 2, data from ~row 8)  
**Purpose:** Define exactly which columns the Cotizar Sidebar (hybrid Borrador → Revisión → Oficial model) requires on the **live source sheet**.

---

## 1. Current Known Structure (from integration audit)

From the integration work (`INTEGRACION-ADMIN-COTIZACIONES.md`):

**Key columns observed in "Admin." tab (source of truth at time of integration):**

| Letter (approx) | Header (source)          | Notes |
|-----------------|--------------------------|-------|
| —               | Asig.                    | Responsable |
| —               | Estado                   | Current values: Pendiente, Asignado, Listo, Enviado, CONTACTAR, etc. |
| —               | Fecha                    | Date |
| —               | Cliente                  | Client name |
| —               | Orig.                    | WA / EM / LL / ML / CL |
| —               | Telefono-Contacto        | Phone |
| —               | Direccion / Zona         | Location |
| **I**           | **Consulta**             | **Primary input** for Cotizar (free text) |
| —               | RUTA DE ACCESO           | Notes |
| —               | Relleno, Largo, Ancho, Color, Terminations, etc. | Technical specs (many columns) |

**Important:** The Cotizar design documents standardized on these three for the feature:
- **I = Consulta** (confirmed input)
- **J = Respuesta AI** (output explanation — may be new or repurposed)
- **K = Link Presupuesto** (official PDF link — must remain untouched by the Cotizar button)

---

## 2. Columns Required by the Cotizar Sidebar Feature

### 2.1 Base / Existing Columns (used by the feature)

| Column | Letter (design) | Role in Cotizar | Notes |
|--------|-----------------|------------------|-------|
| Consulta | **I** | Input | Raw customer request. Sent to orchestrator. |
| Respuesta AI | **J** | Primary output field | Will hold "Borrador Explicación" initially. Can be promoted or overwritten on approval. |
| Link Presupuesto | **K** | Official PDF only | **Never written by Cotizar button**. Reserved for "Aprobado Oficial" step. |
| Estado | C (or wherever it lives) | Workflow state | Must support new values (see below). |

### 2.2 New Columns Required (Hybrid Borrador Model)

These must be added to the "Admin." tab (recommended at the far right, after column K or in a clearly separated group).

#### Borrador (Temporary) Group — Written by the Cotizar button

| Column Name                  | Suggested Letter | Type     | Who writes                  | Purpose |
|-----------------------------|------------------|----------|-----------------------------|---------|
| **Borrador PDF**            | BA (or next available) | URL     | System (Cotizar)           | Link to the generated PDF (temporary) |
| **Borrador Explicación**    | BB               | Text (long) | System (Cotizar)        | Buyer-facing explanation (professional template). This is what the live preview shows. |
| **Fecha Generación Borrador** | BC             | Date/Time | System                    | When the automatic draft was created |
| **Generado Por**            | BD               | Email / Text | System (`Session.getActiveUser()`) | Backoffice user who clicked Cotizar |
| **Modo**                    | BE               | Text    | System                     | `Normal` or `Speed` |
| **Duración (seg)**          | BF               | Number  | System                     | How long the orchestrator call took (optional but recommended) |

#### Review & Officialization Group — Written manually or on approval

| Column Name               | Suggested Letter | Type     | Who writes     | Purpose |
|---------------------------|------------------|----------|----------------|---------|
| **Revisado Por**          | BG               | Email / Text | Backoffice (manual) | Who reviewed and approved the draft |
| **Fecha Revisión**        | BH               | Date/Time | Backoffice     | When it was approved/rejected |
| **Comentario de Revisión**| BI               | Text     | Backoffice     | Notes (e.g. "Faltaba altura", corrections requested) |

**K (Link Presupuesto)** remains the **official** PDF column and is only written during the "Aprobado Oficial" action.

---

## 3. Estado Column — Required New Values

The existing "Estado" column must support these additional values for the hybrid flow:

| New Value                | Meaning                              | Set by          |
|--------------------------|--------------------------------------|-----------------|
| **Borrador Automático**  | Cotizar button created a draft       | System only     |
| **En Revisión**          | Backoffice is reviewing (optional)   | Backoffice      |
| **Aprobado Oficial**     | Draft approved → official PDF in K   | Backoffice only |
| **Rechazado**            | Draft rejected                       | Backoffice      |

Existing values (Pendiente, Asignado, Enviado, etc.) should continue to work.

---

## 4. Recommended Additional Artifact (Future / Nice to Have)

- New tab: **"Log Cotizaciones"** (or "Historial Cotizaciones Automáticas")
  - Columns example: Timestamp, Usuario, Fila, WBK-ID (if exists), Modo, Duración, PDF Borrador, Resultado, TraceId / RequestId, Comentario

This is mentioned in the proposal but is **secondary** for Fase 1 MVP.

---

## 5. Actionable Next Steps for Implementation

1. On the live sheet ("Admin." tab), add the 9 new columns listed above (BA–BI or your chosen letters/numbers).
2. Decide and document the **exact 1-indexed column numbers** (or final letters) for all new borrador + review fields.
3. Confirm the exact tab name (commonly "Admin." or "Admin").
4. Provide these values to unblock the implementation agent:
   - Tab name
   - All new column indices (Borrador PDF, Borrador Explicación, Fecha Generación Borrador, Generado Por, Modo, Duración, Revisado Por, Fecha Revisión, Comentario de Revisión)
   - Full backend URL
   - PDF_DRIVE_FOLDER_ID
   - Auth mechanism for the orchestrator call

---

## 6. References

- `COTIZAR-BUTTON-STATES-AND-COLUMNS.md` — Original column proposal
- `COTIZAR-BUTTON-SIDEBAR-PRODUCTION-PROPOSAL.md` — Fase 1 requirements
- `INTEGRACION-ADMIN-COTIZACIONES.md` — Real current structure of the source sheet
- `goal-prompt-implement-cotizar-sidebar-production-v2.md` — Current execution target for the implementation agent

---

**Status:** This mapping is the consolidated view as of 2026-05-29 for the Cotizar Sidebar project. Update this file when the exact column positions are decided on the live sheet.

Once the user provides the precise numbers from the live sheet, the implementation agent can proceed with full confidence.