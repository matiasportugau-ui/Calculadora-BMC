# Design Proposal — KPI Report (Inicio)

**Fecha:** 2026-03-16  
**Objetivo:** UX para bloque "KPI Report — Inicio" con 5 KPIs + objetivo mensual para equilibrio.

---

## 1. Principios (time-saving first)

- **Vista ejecutiva:** Un vistazo para ver estado general sin scroll.
- **Cards compactas:** Mismo patrón que Resumen financiero y Stock E-Commerce.
- **Moneda por defecto:** Usar $ o primera disponible; sin selector en Inicio (evitar fricción).
- **Equilibrio visual:** Estado meta vs real con color semántico (verde/amarillo/rojo).

---

## 2. Layout propuesto

```
┌─────────────────────────────────────────────────────────────────────────┐
│ KPI Report — Inicio                                                      │
│ Resumen ejecutivo: pagos, entregas, stock y objetivo mensual.            │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│ │ Total        │ │ Esta semana  │ │ Entregas     │ │ Bajo stock   │      │
│ │ pendiente    │ │ (vencim.)    │ │ esta semana  │ │ (<5)         │      │
│ │ $ 1.2M       │ │ $ 340K       │ │ 12           │ │ 8            │      │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Objetivo mensual — Equilibrio                                         │ │
│ │ Meta: $ 2.5M  │  Real: $ 1.8M  │  Pagos mes: $ 800K  │  En meta 75%  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Especificación

| Elemento | Tipo | Contenido | Estilo |
|----------|------|-----------|--------|
| Fila 1 | 4 kpi-cards | Total pendiente, Esta semana, Entregas, Bajo stock | Reutilizar .kpi-card existente |
| Fila 2 | 1 card ancha | Objetivo mensual: meta, real, pagos, equilibrio | .kpi-equilibrio (nueva clase) |
| Equilibrio | Badge | "En meta", "Por debajo", "Por encima" | status-pill success/warning/danger |

---

## 4. Estados de equilibrio

| Condición | Label | Clase |
|-----------|-------|-------|
| real >= meta | En meta | status-pill--success |
| real >= meta * 0.8 | Cerca | status-pill--current |
| real < meta * 0.8 | Por debajo | status-pill--late |

---

## 5. Ubicación

- **Sección:** Primera sección visible (#inicio).
- **Orden:** Antes de "Resumen financiero" (#finanzas).
- **Nav:** Inicio ya apunta a #inicio; el bloque debe estar ahí.

---

## 6. Degradación

- Si /api/kpi-report no disponible: mostrar skeleton o mensaje "Sin datos".
- Si falta Metas_Ventas: equilibrio = "Sin meta"; real y pagos sí se muestran.
- Si falta Ventas: realAcumulado = 0.

---

## 7. Checklist

- [ ] 4 cards en fila (grid responsive)
- [ ] Card equilibrio con meta, real, pagos, estado
- [ ] Colores semánticos para equilibrio
- [ ] Una sola llamada al cargar: GET /api/kpi-report
