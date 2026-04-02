# Plan de mejora de rendimiento macOS — ejecución profesional

Referencias oficiales Apple (prioridad sobre foros): [Si el Mac va lento](https://support.apple.com/guide/mac-help/if-your-mac-runs-slowly-mchlp1731/mac), [Liberar espacio](https://support.apple.com/en-us/HT206996), [Optimizar almacenamiento](https://support.apple.com/guide/mac-help/optimize-storage-space-mac-sysp4ee93ca4/mac), [Monitor de Actividad](https://support.apple.com/guide/activity-monitor/welcome/mac). Complemento desarrollo: [Energy Efficiency Guide for Mac Apps](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/index.html).

---

## Cómo usar este documento

1. Ejecutar **solo lectura** (desde la raíz del repo): `npm run mac:storage-audit` o `bash scripts/mac-storage-audit-readonly.sh`.
2. Marcar checkboxes en orden; **no saltar la fase de disco** si el volumen de arranque está casi lleno.
3. Cualquier borrado: confirmación explícita + preferir Papelera; ver [`drive-space-optimizer`](../drive-space-optimizer/SKILL.md).

---

## Fase 0 — Línea base (15 min)

| Paso | Acción | Listo |
|------|--------|-------|
| 0.1 | Anotar: modelo Mac, macOS, RAM | [ ] |
| 0.2 | Ajustes → General → **Almacenamiento**: espacio libre en volumen de arranque | [ ] |
| 0.3 | Definir síntoma: ¿global, una app, tras dormir, beach ball? | [ ] |

**Criterio:** saber si el foco es disco, RAM, app o hardware.

---

## Fase 1 — Disco (prioridad si hay menos de ~10–15% libre)

| Paso | Acción | Listo |
|------|--------|-------|
| 1.1 | Revisar recomendaciones en **Almacenamiento** (optimizar, iCloud según política) | [ ] |
| 1.2 | Vaciar o mover **Descargas**, medios pesados, instaladores `.dmg` | [ ] |
| 1.3 | Apps no usadas: desinstalar desde `/Applications` o App Store | [ ] |
| 1.4 | Papelera; en Mail: vaciar borradores/papelera si aplica | [ ] |
| 1.5 | Backups locales viejos de iPhone (Finder / dispositivo / administrar backups) | [ ] |
| 1.6 | Re-ejecutar `mac-storage-audit-readonly.sh` y comparar GB libres | [ ] |

**Criterio:** margen holgado en SSD de arranque; sistema y swap con aire.

---

## Fase 2 — Procesos y memoria

| Paso | Acción | Listo |
|------|--------|-------|
| 2.1 | **Monitor de Actividad**: CPU (¿un proceso al 100%?), Memoria (presión roja), Energía, Disco | [ ] |
| 2.2 | Cerrar apps no usadas; Forzar cierre solo si “No responde” | [ ] |
| 2.3 | Si persiste: informe/diagnóstico según [guía Activity Monitor](https://support.apple.com/guide/activity-monitor/run-system-diagnostics-actmntr2225/mac) | [ ] |

---

## Fase 3 — Arranque y software

| Paso | Acción | Listo |
|------|--------|-------|
| 3.1 | Ajustes → General → **Elementos de inicio**: desactivar lo no esencial | [ ] |
| 3.2 | Reducir íconos/agents en barra de menú que disparen red/CPU | [ ] |
| 3.3 | **Actualización de software** (macOS + apps críticas) | [ ] |
| 3.4 | Reinicio completo | [ ] |

---

## Fase 4 — Mantenimiento disco (Apple)

| Paso | Acción | Listo |
|------|--------|-------|
| 4.1 | **Utilidad de Discos** → SOS en el volumen según guía actual | [ ] |

Si SOS informa errores graves: respaldo y soporte Apple.

---

## Fase 5 — Aislamiento (si sigue mal)

| Paso | Acción | Listo |
|------|--------|-------|
| 5.1 | **Modo seguro** (buscar en soporte Apple el método para tu Mac) | [ ] |
| 5.2 | **Usuario de prueba** nuevo: si ahí va bien → problema en la cuenta actual | [ ] |
| 5.3 | **Diagnósticos Apple** si sospecha hardware | [ ] |

---

## Auditoría priorizada (solo medición)

Orden sugerido de investigación tras el script:

1. Espacio total libre en `/` (si crítico → Fase 1 antes que tuning).
2. `~/Downloads`, `~/Library/Caches`, `~/Library/Logs` (caches/logs: revisar antes de borrar; preferir UI o mover a Papelera).
3. Proyectos con `node_modules`, Docker, VMs, Xcode DerivedData (candidatos “cuidado”).
4. iCloud “optimizar” vs archivos solo en nube — decisión de negocio, no solo técnica.

---

## Comunidades (secundario)

[Apple Support Community](https://discussions.apple.com/): útil para casos raros; contrastar siempre con el artículo oficial equivalente.
