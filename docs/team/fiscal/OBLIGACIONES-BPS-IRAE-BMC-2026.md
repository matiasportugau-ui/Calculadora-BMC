# Obligaciones BPS e IRAE — BMC Uruguay SAS
# Referencia operativa para agentes y equipo

**Elaborado:** 2026-04-24
**Revisión:** bmc-fiscal
**Alcance:** BMC Uruguay SAS (RUT a confirmar con contador) — período vigente 2026

---

## 1. Marco legal aplicable

### IRAE — Impuesto a las Rentas de las Actividades Económicas

- **Norma base:** Título IV, Ley 18.083 (Reforma Tributaria 2006) y sus decretos reglamentarios.
- **Tasa general:** 25% sobre la renta neta fiscal del ejercicio.
- **Sujeto pasivo:** Las SAS tributan IRAE en las mismas condiciones que una SRL (no existe tratamiento diferenciado para la forma jurídica SAS en lo impositivo; la reforma de la Ley 19.820 no modificó el régimen de IRAE).
- **Régimen ficto (opcional, si aplica):** Disponible cuando los ingresos del ejercicio son inferiores a 4.000.000 UI. En ese caso la renta ficta se calcula como porcentaje de los ingresos brutos según la actividad. El umbral debe verificarse anualmente con el contador.
- **Anticipos:** IRAE se liquida anualmente pero se pagan anticipos mensuales en BPS/DGI. El monto de cada anticipo es 1/12 del IRAE del ejercicio anterior (ajustado por UI).
- **Beneficios posibles a evaluar:** COMAP (Decreto 329/025), exoneración por actividad de software (si aplica a la renta del sistema/SaaS), y otros instrumentos listados en `.cursor/skills/bmc-dgi-impositivo/reference.md` §3.

### BPS — Banco de Previsión Social

- **Norma base:** Ley 16.713 (Sistema Provisional, 1995) y Decreto 113/996 y concordantes.
- **Aportes patronales:** A cargo de la empresa. Calculados sobre el total de remuneraciones del personal dependiente. Tasa efectiva aproximada 7,5% (industria y comercio) — confirmar con contador según actividad registrada en BPS.
- **Aportes personales:** Retenidos por la empresa sobre el salario del trabajador y volcados a BPS. Incluyen aportación jubilatoria (15%) y fondo de desempleo (0,125%), con escudos y topes según cada trabajador.
- **Declaración mensual:** La empresa declara nómina y rubros en BPS (planilla) y abona el total antes del vencimiento mensual (generalmente hasta el día 10 del mes siguiente).
- **FONASA y otras cargas:** BPS también centraliza la recaudación de FONASA (salud); el aporte varía según niveles salariales y si el trabajador tiene beneficiarios.

---

## 2. Qué rastrea actualmente el sistema Calculadora-BMC

El sistema **no rastrea** BPS ni IRAE. Lo que sí existe en la base de datos operativa:

| Campo | Ubicación | Qué representa | Relación fiscal |
|-------|-----------|---------------|-----------------|
| `COSTO SIN IVA` / `GANANCIA` | `bmcDashboard.js` → ventas | Margen bruto por venta | Insumo posible para base IRAE, pero no acumulado ni ajustado |
| `FACTURADO` / `NUM_FACTURA` | Esquema ventas | Flag boolean + número libre | No tiene estructura CFE; no permite conciliación DGI |
| `PRECIO_VENTA` / `COSTO_COMPRA` | Esquema pagos | Venta IVA inc. vs costo | Datos de rentabilidad operativa, no fiscal |
| `MONTO`, `MONEDA`, `ESTADO_PAGO` | Esquema pagos | Flujo de caja | No vinculados a declaración impositiva |
| IVA calculado en cotizaciones | `src/utils/calculations.js` | Precio al cliente IVA inc. | Cálculo de precio, no conciliación IVA DGI |

**No existen** en ninguna parte del sistema:
- Acumulación de IRAE (ni estimado, ni provisionado)
- Registro de anticipos BPS o IRAE pagados
- Nómina o datos de personal para calcular aportes BPS
- Estructura CFE (tipo, serie, número, RUT contraparte) que permita conciliar con DGI
- RUT de BMC Uruguay SAS registrado en el sistema

---

## 3. Por qué BPS no es tratable en el sistema (contexto)

BPS es una obligación de nómina. Este sistema gestiona cotizaciones y ventas de paneles de aislamiento, no nómina salarial. **No corresponde agregar lógica de BPS al calculador.** La fuente de verdad para BPS es la planilla mensual que declara el contador o el responsable de RRHH en el portal BPS. El sistema Calculadora-BMC no tiene ni debe tener acceso a datos de empleados o remuneraciones.

**Conclusión BPS:** La brecha es exclusivamente documental. No se requiere código. El equipo (y futuras corridas de bmc-fiscal) debe saber que BPS se gestiona externamente y no es responsabilidad del sistema.

---

## 4. Por qué IRAE sí tiene un camino posible en el sistema (sprint flag)

El `/kpi-report` (`GET /api/kpi-report`) ya acumula `realAcumulado` (suma de `GANANCIA` del mes corriente desde las pestañas de ventas). Los datos existen. Lo que falta:

1. Acumular `GANANCIA` por **ejercicio fiscal** (no solo por mes).
2. Aplicar una tasa indicativa (25% sobre renta neta) para mostrar una **provisión estimada de IRAE**.
3. Exponer ese valor en `/kpi-report` como `iraePrevision` con flag `disclaimer: "Estimado. Validar con contador."`.

**Esto es un sprint flag — no implementar ahora. Requiere:**
- Confirmación del contador de que `GANANCIA` (margen bruto) es aproximación razonable de base imponible, o identificar los ajustes necesarios (gastos no deducibles, deducciones fiscales).
- Definir el período fiscal de BMC Uruguay SAS (si coincide con año calendario o no).
- Decisión del operador de si quiere ver esa cifra en el dashboard.

**Etiqueta para sprint:** `[FISCAL-SPRINT] IRAE provisional en /kpi-report — acumular GANANCIA por ejercicio, exponer iraePrevision con disclaimer contable`

---

## 5. Acciones recomendadas (sin modificar código)

| Acción | Responsable | Plazo |
|--------|-------------|-------|
| Confirmar RUT de BMC Uruguay SAS y registrarlo en un `.env` variable o en este doc | Matías (operador) | Próxima sesión |
| Confirmar régimen IRAE vigente (real o ficto) y umbral de ingresos UI | Contador | Antes de la próxima declaración |
| Verificar que NUM_FACTURA en el sistema corresponde a numeración real de CFE emitidos en Factura Express | Operador | Al revisar ventas del período |
| Evaluar si COMAP aplica a inversiones en software/tecnología realizadas en 2025-2026 | Contador + bmc-fiscal | Ejercicio 2026 |
| Crear columna `IRAE_PREVISION` en hoja Metas_Ventas (manual, por contador) hasta que el sistema lo calcule | Contador | Opcional, corto plazo |

---

## 6. Lo que bmc-fiscal necesita para una auditoría completa (inputs externos)

Si en el futuro se requiere conciliación IVA/IRAE completa, los inputs necesarios son los descritos en `.cursor/skills/bmc-dgi-impositivo/SKILL.md`:

- CFE emitidos del período (exportar desde DGI Servicios en Línea)
- CFE recibidos del período
- Formularios 1050 y 2178 precargados
- Extractos BROU (opcional, para validación secundaria)
- RUT, razón social confirmados, período a analizar

Sin esos inputs, bmc-fiscal solo puede analizar los datos operativos internos (cotizaciones, ventas, pagos) — que son útiles pero no equivalen a conciliación DGI.

---

## 7. Referencias normativas

| Norma | Artículo relevante | Tema |
|-------|--------------------|------|
| Ley 18.083 | Título IV | IRAE — base, tasa, anticipos |
| Ley 16.713 | Arts. 1-60 | Sistema Previsional — aportes BPS |
| Decreto 113/996 | Todo | Reglamentación BPS aportes |
| Decreto 329/025 | Todo | COMAP — exoneraciones por inversión |
| Código Tributario | Art. 46 | Vista DGI — proceso de defensa |

---

**Disclaimer:** Este documento es referencia operativa interna para el equipo de agentes y el operador. No sustituye asesoramiento contable ni legal. Toda estrategia y presentación ante DGI o BPS debe ser validada por contador habilitado.
