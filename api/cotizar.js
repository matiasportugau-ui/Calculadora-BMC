// /api/cotizar.js - Vercel Serverless Function
// Recibe parámetros de calculadora y devuelve cotización en JSON

import { calcTotalesSinIVA } from "../src/utils/calculations.js";
import { setListaPrecios } from "../src/data/constants.js";
import { bomToGroups, applyOverrides } from "../src/utils/helpers.js";
import { executeScenario } from "../src/utils/scenarioCalc.js";

export default function handler(req, res) {
  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido. Use POST." });
  }

  try {
    const {
      scenario = "solo_techo",
      listaPrecios = "web",
      techo = {},
      pared = {},
      camara = {},
      flete = 0,
      overrides = {},
    } = req.body;

    // Validar que hay datos mínimos
    if (!scenario) {
      return res.status(400).json({ error: "Falta 'scenario'" });
    }

    // Activar lista de precios
    setListaPrecios(listaPrecios);

    // Execute scenario using shared logic
    const { results, error } = executeScenario({ scenario, techo, pared, camara });

    if (error) {
      return res.status(400).json({ error });
    }
    if (!results) {
      return res.status(400).json({ error: "No se pudo calcular cotización" });
    }

    // Armar grupos BOM
    let groups = bomToGroups(results);
    if (flete > 0) {
      groups.push({
        title: "SERVICIOS",
        items: [
          {
            label: "Flete",
            sku: "FLETE",
            cant: 1,
            unidad: "servicio",
            pu: flete,
            total: flete,
          },
        ],
      });
    }
    groups = applyOverrides(groups, overrides);

    // Calcular totales finales
    const allItems = [];
    groups.forEach((g) => g.items.forEach((i) => allItems.push(i)));
    const grandTotal = calcTotalesSinIVA(allItems);

    // Respuesta JSON
    return res.status(200).json({
      success: true,
      scenario,
      listaPrecios,
      results: {
        paneles: results.paneles,
        autoportancia: results.autoportancia || results.techoResult?.autoportancia,
        warnings: results.warnings || [],
      },
      bom: groups,
      totals: {
        subtotalSinIVA: grandTotal.subtotalSinIVA,
        iva: grandTotal.iva,
        totalFinal: grandTotal.totalFinal,
      },
    });
  } catch (error) {
    console.error("Error en /api/cotizar:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      message: error.message,
    });
  }
}
