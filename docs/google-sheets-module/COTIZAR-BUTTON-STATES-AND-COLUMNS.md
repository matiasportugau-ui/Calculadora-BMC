# Cotizar Button — Modelo de Estados y Columnas (Propuesta v1)

**Fecha:** 2026-05-29  
**Contexto:** Decisión del usuario:
- Solo Backoffice
- Flujo obligatorio: Borrador → Revisión Humana → Oficial
- Modo por defecto: Seguro / Controlado (más lento)
- Opción de activar **Speed Mode**

---

## 1. Principios de Diseño

- La columna **K (Link Presupuesto)** siempre representa el **presupuesto oficial** enviado al cliente.
- Nunca se escribe directamente en K desde el botón "Cotizar".
- Todo lo generado automáticamente pasa primero por un estado de **borrador** con revisión humana.
- Se mantiene trazabilidad completa (quién generó, cuándo, en qué modo).
- El sistema debe ser fácil de auditar.

---

## 2. Estados Propuestos (para la columna "Estado")

Se propone evolucionar la columna de Estado con los siguientes valores:

| Estado | Significado | Quién puede ponerlo | Notas |
|--------|-------------|---------------------|-------|
| **Pendiente** | Aún no se trabajó | Sistema / Backoffice | Estado inicial actual |
| **Asignado** | Asignada a alguien | Backoffice | Estado actual |
| **Borrador Automático** | Se generó un borrador con el botón "Cotizar" | Solo el sistema (vía botón) | Nuevo |
| **En Revisión** | El backoffice está revisando el borrador | Backoffice | Nuevo (opcional, se puede saltar) |
| **Aprobado Oficial** | El backoffice aprobó el borrador y se convirtió en presupuesto oficial | Solo Backoffice (acción manual) | Nuevo |
| **Enviado** | Ya se envió al cliente (oficial) | Backoffice | Estado actual |
| **Rechazado** | Se rechazó el borrador o la cotización | Backoffice | Nuevo |
| **Cancelado** | Se canceló la oportunidad | Backoffice | Opcional |

**Recomendación:** Mantener los estados existentes y agregar los nuevos. No romper flujos actuales.

---

## 3. Columnas Nuevas Recomendadas

Se propone agregar las siguientes columnas (preferentemente al final de la hoja, después de la columna actual K o en una zona clara):

### Columnas de Borrador (temporales)

| Columna sugerida | Letra (propuesta) | Tipo | Descripción | Quién escribe |
|------------------|-------------------|------|-------------|---------------|
| **Borrador PDF** | Nueva (ej: BA) | URL | Link al PDF generado automáticamente (borrador) | Sistema (botón Cotizar) |
| **Borrador Explicación** | Nueva (ej: BB) | Texto largo | Explicación generada automáticamente para el comprador | Sistema (botón Cotizar) |
| **Fecha Generación Borrador** | Nueva (ej: BC) | Fecha/Hora | Cuándo se generó el borrador automático | Sistema |
| **Generado Por** | Nueva (ej: BD) | Email / Nombre | Quién del backoffice apretó el botón | Sistema (usando sesión de Google) |
| **Modo** | Nueva (ej: BE) | Texto | `Normal` o `Speed` | Sistema |
| **Duración (seg)** | Nueva (ej: BF) | Número | Tiempo que tardó en generar el borrador | Sistema (opcional) |

### Columnas de Revisión y Oficialización

| Columna sugerida | Letra (propuesta) | Tipo | Descripción | Quién escribe |
|------------------|-------------------|------|-------------|---------------|
| **Revisado Por** | Nueva (ej: BG) | Email / Nombre | Quién revisó y aprobó el borrador | Backoffice (manual) |
| **Fecha Revisión** | Nueva (ej: BH) | Fecha/Hora | Cuándo se aprobó/rechazó el borrador | Backoffice |
| **Comentario de Revisión** | Nueva (ej: BI) | Texto | Notas del revisor (ej: "Faltaba altura", "Corregir medidas") | Backoffice |
| **PDF Oficial** | **K** (actual) | URL | Link al presupuesto oficial enviado al cliente | Backoffice (al aprobar) |

**Nota importante:** La columna K actual se reserva exclusivamente para el PDF oficial. Los borradores van en la nueva columna "Borrador PDF".

---

## 4. Flujo Recomendado (State Machine)

```
Pendiente / Asignado
        ↓ (Backoffice hace clic en "Cotizar")
Borrador Automático
        ↓ (Backoffice revisa)
En Revisión (opcional)
        ↓
Aprobado Oficial  ←──┐
        ↓             │
   Escribe en K       │ (acción manual)
   (PDF Oficial)      │
        ↓             │
     Enviado          │
                      │
Rechazado  ←──────────┘
```

### Transiciones permitidas

- **Borrador Automático** solo puede pasar a:
  - En Revisión
  - Aprobado Oficial
  - Rechazado

- **Aprobado Oficial** solo lo puede poner un humano del backoffice (nunca el sistema automáticamente).

- Una vez que una fila llega a **Aprobado Oficial**, el botón "Cotizar" debería desactivarse o mostrar mensaje de "Ya fue oficializado".

---

## 5. Comportamiento del Speed Mode

| Aspecto | Modo Normal (por defecto) | Speed Mode (activable) |
|---------|---------------------------|------------------------|
| Modo del Orchestrator | `profundo` | `ligero` |
| Gates de calidad | Pricing Reviewer + Document Gatekeeper completos | Solo gates básicos |
| Tiempo estimado | Más lento | Más rápido |
| Costo | Más alto | Más bajo |
| Nivel de detalle en explicación J | Alto | Medio |
| ¿Requiere revisión humana? | Sí (obligatoria) | Sí (obligatoria) |
| ¿Se marca diferente? | No | Sí ("Speed" en columna Modo) |

**Recomendación de UX:**
- En el Sidebar, checkbox o toggle:  
  `☐ Modo Rápido (Speed Mode) - Menos detalle, más velocidad`

---

## 6. Reglas de Validación antes de permitir "Cotizar"

Antes de ejecutar el orchestrator, el sistema debería chequear:

- La fila tiene texto en la columna **Consulta** (mínimo 30-50 caracteres recomendados).
- La fila **no** está ya en estado `Aprobado Oficial` o `Enviado`.
- (Opcional) La fila no tiene ya un borrador generado en las últimas X horas (para evitar spam).

---

## 7. Propuesta de Nombres Finales de Columnas

Sugerencia de nombres claros para agregar:

- `Borrador PDF`
- `Borrador Explicación`
- `Fecha Borrador`
- `Generado Por`
- `Modo (Normal/Speed)`
- `Revisado Por`
- `Fecha Revisión`
- `Comentario Revisión`

Estas columnas pueden agruparse visualmente en la planilla (con color de fondo o sección).

---

## 8. Próximos Pasos Sugeridos

1. **Aprobar o ajustar** este modelo de estados + columnas.
2. Definir exactamente qué texto va en "Borrador Explicación" vs qué texto va cuando se aprueba.
3. Decidir si queremos una columna de "Score de Confianza" del borrador (futuro).
4. Empezar a implementar el Sidebar + lógica del botón.

---

**Estado de este documento:** Propuesta inicial lista para revisión y ajuste.

---

¿Querés que ajuste algo de este modelo (estados, nombres de columnas, flujo, etc.) o damos por bueno este esquema y pasamos a definir el texto de la explicación + el comportamiento exacto del botón?