// panelLayoutVerification.js — Verificación cruzada plano ↔ BOM
// Depende de: (ninguno — función pura)
// Consumido por: componentes del wizard donde calcPanelesTecho() esté disponible
// ISO 129 / IRAM 4513 compliance: no aplica (utilidad de validación)

/**
 * Verifica que el output de `buildPanelLayout` coincida con el output de `calcPanelesTecho`.
 *
 * IMPORTANTE: Esta función NO se llama dentro de `RoofPreview` porque `calcPanelesTecho`
 * requiere el objeto panel completo + espesor, datos no disponibles en ese componente.
 * Llamar desde el wizard padre donde ambos resultados estén disponibles.
 *
 * @param {import('./panelLayout.js').PanelLayoutResult} layout
 * @param {{ cantPaneles: number, areaTotal: number, anchoTotal: number }} calcResult
 *   Resultado de calcPanelesTecho(panel, espesor, largo, ancho)
 * @returns {{ isValid: boolean, errors: object[], warnings: object[], summary: string }}
 */
export function verifyLayoutVsBom(layout, calcResult) {
  if (!layout || !calcResult) {
    return {
      isValid: false,
      errors: [{ type: 'MISSING_DATA', msg: 'Layout o calcResult no disponible' }],
      warnings: [],
      summary: '✗ Datos insuficientes para verificar',
    };
  }

  const errors = [];
  const warnings = [];

  // 1. Cantidad de paneles
  // Nota: calcPanelesTecho usa Math.ceil sin epsilon; buildPanelLayout usa Math.ceil - 1e-9.
  // En múltiplos exactos (ej: 5.6 / 1.12) pueden diferir por 1. Esta es la discrepancia
  // que buildPanelLayout corrige — si aparece aquí, es una señal de que calcPanelesTecho
  // debería adoptar la misma fórmula.
  if (layout.nPaneles !== calcResult.cantPaneles) {
    errors.push({
      type: 'PANEL_COUNT_MISMATCH',
      plano: layout.nPaneles,
      bom: calcResult.cantPaneles,
      msg: `Plano muestra ${layout.nPaneles} paneles pero BOM cotiza ${calcResult.cantPaneles}`,
    });
  }

  // 2. Área total (tolerancia 0.01 m² para redondeos de precios)
  const areaDiff = Math.abs(layout.area - calcResult.areaTotal);
  if (areaDiff > 0.01) {
    warnings.push({
      type: 'AREA_MISMATCH',
      plano: layout.area,
      bom: calcResult.areaTotal,
      msg: `Área del plano (${layout.area.toFixed(2)} m²) difiere del BOM (${calcResult.areaTotal.toFixed(2)} m²)`,
    });
  }

  // 3. La cadena cubre el ancho pedido.
  // Distinguir "layout vacío por inputs inválidos" de "cadena no cubre ancho":
  // si panels.length === 0, buildPanelLayout recibió parámetros inválidos (au/largo/ancho ≤ 0);
  // en ese caso el error es de datos, no de cobertura.
  if (!layout.isValid) {
    if (layout.panels.length === 0) {
      errors.push({
        type: 'NO_LAYOUT_DATA',
        msg: 'El layout no tiene paneles — verificar que au, largo y ancho sean mayores a cero',
      });
    } else {
      errors.push({
        type: 'CHAIN_UNDERFLOW',
        suma: layout.anchoTotal,
        input: layout.inputAncho,
        msg: `Suma de cadena (${layout.anchoTotal.toFixed(3)} m) no cubre el ancho pedido (${layout.inputAncho} m)`,
      });
    }
  }

  // 4. Ancho total (calcPanelesTecho devuelve anchoTotal = n * au, que puede exceder input)
  const anchoDiff = Math.abs(layout.anchoTotal - calcResult.anchoTotal);
  if (anchoDiff > layout.au + 1e-6) {
    warnings.push({
      type: 'TOTAL_WIDTH_MISMATCH',
      plano: layout.anchoTotal,
      bom: calcResult.anchoTotal,
      msg: `Ancho total plano (${layout.anchoTotal.toFixed(3)} m) difiere del BOM (${calcResult.anchoTotal.toFixed(3)} m) más de un panel`,
    });
  }

  const isValid = errors.length === 0;
  const summary = isValid
    ? warnings.length === 0
      ? '✓ Plano y cotización coinciden'
      : `⚠ ${warnings.length} advertencia(s)`
    : `✗ ${errors.length} error(es) de consistencia`;

  return { isValid, errors, warnings, summary };
}
