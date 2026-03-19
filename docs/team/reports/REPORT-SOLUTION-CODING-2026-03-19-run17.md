# Report Solution/Coding — 2026-03-19 (run 17)

**Run:** Full team run (Invoque full team)
**Handoff para:** Solution team, Coding team

---

## Resumen

Run ejecutado para preparar deploy de la Calculadora. Contexto: User quiere deployar esta versión de la calc. Cambios recientes (2026-03-19): Calculadora UI (accesorios on roof preview, costo/margen/ganancia columns, Cargar desde MATRIZ, Enter key, display fixes).

---

## Cambios Calculadora (2026-03-19)

| Elemento | Descripción |
|----------|-------------|
| **RoofBorderSelector** | Accesorios perimetrales seleccionables sobre vista previa del techo (zonas integradas) |
| **Columnas costo/margen/ganancia** | Costo, % Margen y Ganancia en tabla de resultados |
| **Cargar desde MATRIZ** | Botón en Config para costo + venta desde MATRIZ de COSTOS y VENTAS 2026 |
| **Enter key** | Enter para avanzar en wizard (Siguiente) |
| **Display título dimensiones** | Corrección padding |
| **Costo en items** | Costo añadido a items de cálculo (pared, selladores, perfiles) |

---

## Estado por área (run 17)

- **Mapping:** DASHBOARD-INTERFACE-MAP vigente; planilla-inventory actualizado (MATRIZ, BMC_MATRIZ_SHEET_ID).
- **Dependencies / Service map:** Calculadora actualizada con BMC_MATRIZ_SHEET_ID, /api/actualizar-precios-calculadora; MATRIZ-PRECIOS-CALCULADORA.md referenciado.
- **Contract:** 4/4 PASS (GET /api/kpi-financiero, proximas-entregas, audit, kpi-report) — runtime verificado.
- **Networks:** Deploy options documentadas (Cloud Run, Vercel, Netuy VPS).

---

## Opciones de deploy para la Calculadora

| Opción | Descripción | Pros | Contras | Próximos pasos |
|--------|-------------|------|---------|----------------|
| **Cloud Run (panelin-calc)** | API + calc en mismo servicio | Ya integrado; escala automático | Requiere Dockerfile; secrets env | Dockerfile.bmc-dashboard; gcloud run deploy |
| **Vercel** | Frontend estático | Deploy rápido; CDN global | API separada (3001); VITE_API_URL apunta a producción | `npm run build` → dist/; vercel deploy |
| **Netuy VPS** | Full stack en VPS Uruguay | Datos en Uruguay; control total | Mantenimiento manual; PM2/nginx | git clone; npm install; PM2; nginx |

---

## Próximos pasos (Solution/Coding)

1. **Deploy Calculadora:** Elegir Cloud Run / Vercel / Netuy según preferencia (ver sección anterior).
2. **Pre-deploy:** `npm run build` (Vite); `npm run pre-deploy` (checklist).
3. **E2E validation:** Ejecutar checklist docs/team/E2E-VALIDATION-CHECKLIST.md post-deploy.
4. **CORS:** Restringir CORS en server/index.js antes de deploy productivo (IMPLEMENTATION-PLAN-POST-GO-LIVE).

---

*Generado por: Reporter (bmc-implementation-plan-reporter)*
