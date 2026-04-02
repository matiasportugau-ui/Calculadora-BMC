# Informe de navegación — plantilla

**Uso:** el agente copia este archivo a `USER-NAV-REPORT-YYYY-MM-DD.md` (o con sufijo de sesión) y rellena cada sección. No borrar encabezados de sección.

---

## Checklist previo (antes de redactar)

- [ ] URL base de la app desplegada (p. ej. Vercel) indicada por el usuario
- [ ] Transcripción de audio o notas de voz disponible en el chat / apéndice
- [ ] Capturas de pantalla adjuntas (o referencia explícita si faltan)
- [ ] Commit, tag o nota de build si el usuario la aporta (opcional)

---

## Meta

| Campo | Valor |
|-------|--------|
| **Fecha** | YYYY-MM-DD |
| **URL desplegada** | |
| **Alcance de la sesión** | (ej.: calculadora, finanzas, dashboard completo) |
| **Dispositivo / navegador** | (si aplica) |
| **Build / commit** | (opcional) |

---

## Resumen ejecutivo

- …
- …
- …

---

## Mapa de sesión (rutas o pantallas, orden temporal)

1. …
2. …

---

## Hallazgos

Cada fila: ID estable, tipo, severidad, evidencia, actual vs esperado.

| ID | Tipo | Severidad | Ruta / pantalla | Evidencia | Comportamiento actual | Comportamiento esperado |
|----|------|-----------|-----------------|-----------|----------------------|-------------------------|
| NAV-YYYY-MM-DD-01 | bug \| missing \| UX \| copy \| performance | P0 \| P1 \| P2 | | Fig. N o NEEDS_CONFIRMATION | | |

**Leyenda tipos:** `bug` = fallo; `missing` = funcionalidad ausente; `UX` = flujo o usabilidad; `copy` = textos; `performance` = rendimiento.

---

## Propagación (por hallazgo o bloque temático)

Para cada ID (o grupo relacionado), indicar capas afectadas y riesgos en cadena.

| ID / tema | `src/` | `server/` | `docs/` | Sheets / datos | env / secrets | deploy (Vercel / Cloud Run) | Notas |
|-----------|--------|-----------|---------|----------------|---------------|----------------------------|-------|
| | | | | | | | |

Referencia de equipo y propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` (tabla de propagación).

---

## Backlog para implementación (ordenado)

Orden sugerido: dependencias primero; P0 antes que P1.

### NAV-YYYY-MM-DD-01 — Título corto

- **Prioridad:** P0 \| P1 \| P2
- **Pasos sugeridos:** (numerados, accionables)
- **Criterios de aceptación:** (testeables)
- **Depende de:** (IDs u otras tareas, o “ninguna”)

### NAV-YYYY-MM-DD-02 — …

---

## Riesgos y preguntas abiertas

- …
- Gates humanos (cm-0 / cm-1 / cm-2) si aplica: ver `docs/team/HUMAN-GATES-ONE-BY-ONE.md`

---

## Apéndice — transcripción / fuente

(Pegar transcripción literal o enlace al archivo / nota del usuario.)

```
```
