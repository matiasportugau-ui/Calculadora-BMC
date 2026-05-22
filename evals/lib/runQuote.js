import {
  calcTechoCompleto,
  calcParedCompleto,
  calcTotalesSinIVA,
} from "../../src/utils/calculations.js";
import { setListaPrecios } from "../../src/data/constants.js";

const VALID_ESCENARIOS = new Set([
  "solo_techo",
  "solo_fachada",
  "techo_fachada",
  "camara_frig",
]);

function runOpcion(opcion) {
  const escenario = opcion.escenario;
  if (!VALID_ESCENARIOS.has(escenario)) {
    return { error: `Escenario inválido: ${escenario}` };
  }
  if (escenario === "solo_techo") return calcTechoCompleto(opcion.techo);
  if (escenario === "solo_fachada") return calcParedCompleto(opcion.pared);
  if (escenario === "techo_fachada") {
    const rT = opcion.techo ? calcTechoCompleto(opcion.techo) : null;
    const rP = opcion.pared ? calcParedCompleto(opcion.pared) : null;
    const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
    const totales = calcTotalesSinIVA(allItems);
    return { techoResult: rT, paredResult: rP, allItems, totales };
  }
  return { error: `Escenario ${escenario} aún no implementado en runner` };
}

export function runQuote(caseData) {
  const lista = caseData?.parsed_inputs?.lista === "web" ? "web" : "venta";
  setListaPrecios(lista);

  const opciones = caseData?.parsed_inputs?.opciones_solicitadas || [];
  const opciones_resultados = opciones.map((opcion) => {
    const result = runOpcion(opcion);
    const totales = result?.totales || (result?.allItems ? calcTotalesSinIVA(result.allItems) : null);
    return {
      label: opcion.label || `opcion-${opciones.indexOf(opcion) + 1}`,
      input: opcion,
      result: {
        error: result?.error || null,
        warnings: result?.warnings || [],
        totales,
        allItems: result?.allItems || [],
      },
    };
  });

  return {
    case_id: caseData.case_id,
    fila_planilla: caseData.fila_planilla,
    lista,
    opciones_resultados,
    generated_at: new Date().toISOString(),
  };
}
