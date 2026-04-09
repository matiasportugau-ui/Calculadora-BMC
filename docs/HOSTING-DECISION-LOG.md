# Hosting — Decision Log

**Propósito:** Documentar decisiones de infraestructura. Evita proponer opciones ya descartadas.

**Mantenimiento:** Actualizar cuando se tome una decisión de hosting, migración o configuración.

---

## Decisiones registradas

| Fecha | Decisión | Razón | Alternativas descartadas |
|-------|----------|-------|---------------------------|
| — | Cloud Run para panelin-calc | Escalado automático, integración GCP | — |
| — | VPS Netuy (opción) | Hosting Uruguay, control total | — |
| — | Puertos 3001, 3849, 5173 | 3001 API+Dashboard, 3849 standalone, 5173 Calculadora | — |
| — | ngrok puerto 4040 | OAuth redirect en dev | — |

---

## Restricciones conocidas

| Restricción | Motivo |
|-------------|--------|
| CORS en producción | No usar `*`; restringir orígenes |
| .env no en repo | Seguridad |
| Service account con scope mínimo | Principio de menor privilegio |

---

## Referencias

- HOSTING-EN-MI-SERVIDOR.md
- IMPLEMENTATION-PLAN-POST-GO-LIVE.md §Fase B
