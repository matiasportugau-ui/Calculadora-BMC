// /api/cotizar.js - Vercel Serverless Function
// Recibe parámetros de calculadora y devuelve cotización en JSON

import {
  calcTechoCompleto,
  calcParedCompleto,
  calcTotalesSinIVA,
} from "../src/utils/calculations.js";
import { setListaPrecios, PANELS_TECHO, PANELS_PARED } from "../src/data/constants.js";
import { bomToGroups, applyOverrides } from "../src/utils/helpers.js";

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

    let results = null;

    // Calcular según escenario
    if (scenario === "solo_techo") {
      if (!techo.familia || !techo.espesor) {
        return res
          .status(400)
          .json({ error: "Techo: falta familia o espesor" });
      }
      results = calcTechoCompleto(techo);
    } else if (scenario === "solo_fachada") {
      if (!pared.familia || !pared.espesor) {
        return res
          .status(400)
          .json({ error: "Pared: falta familia o espesor" });
      }
      results = calcParedCompleto(pared);
    } else if (scenario === "techo_fachada") {
      const rT =
        techo.familia && techo.espesor ? calcTechoCompleto(techo) : null;
      const rP =
        pared.familia && pared.espesor ? calcParedCompleto(pared) : null;

      if (!rT && !rP) {
        return res
          .status(400)
          .json({ error: "Techo y/o Pared: faltan datos" });
      }

      const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
      const totales = calcTotalesSinIVA(allItems);
      results = { ...rT, paredResult: rP, allItems, totales };
    } else if (scenario === "camara_frig") {
      if (!pared.familia || !pared.espesor) {
        return res
          .status(400)
          .json({ error: "Pared: falta familia o espesor" });
      }

      const perim = 2 * (camara.largo_int + camara.ancho_int);
      const rP = calcParedCompleto({
        ...pared,
        perimetro: perim,
        alto: camara.alto_int,
      });
      const rT = calcTechoCompleto({
        familia: pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS",
        espesor: pared.espesor,
        largo: camara.largo_int,
        ancho: camara.ancho_int,
        tipoEst: "metal",
        borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
        opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
        color: pared.color || "Blanco",
      });

      const allItems = [...(rP?.allItems || []), ...(rT?.allItems || [])];
      const totales = calcTotalesSinIVA(allItems);
      results = { ...rP, techoResult: rT, allItems, totales };
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
