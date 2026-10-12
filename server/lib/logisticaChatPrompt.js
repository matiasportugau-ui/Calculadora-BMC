/**
 * Text-chat system prompt for El Transportador (/logistica).
 * Voice twin: server/lib/voice/logisticaTruckerInstructions.js
 * Replaces the sales catalog when calcState.logistica / module=logistica.
 */

function sanitizeLine(s, max = 400) {
  return String(s || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .slice(0, max);
}

function formatStops(stops) {
  const list = Array.isArray(stops) ? stops : [];
  if (!list.length) return "(sin paradas)";
  return list
    .map((s, i) => {
      const n = i + 1;
      const paneles = Array.isArray(s.paneles) && s.paneles.length
        ? s.paneles
            .map((p) => `${p.cantidad || "?"}×${p.tipo || "?"} ${p.espesor || ""}mm ${p.longitud || ""}m`)
            .join("; ")
        : "sin paneles";
      const gaps = Array.isArray(s.gaps) && s.gaps.length ? ` gaps=${s.gaps.join(",")}` : "";
      return `${n}. ${sanitizeLine(s.cliente, 80) || "?"} · ped ${sanitizeLine(s.orderId, 24) || "—"} · ${sanitizeLine(s.direccion, 120) || "sin dir"} · tel ${sanitizeLine(s.telefono, 24) || "—"} · ${paneles}${gaps}`;
    })
    .join("\n");
}

function formatTripBlock(title, trip) {
  if (!trip || typeof trip !== "object") return "";
  const env = sanitizeLine(trip.envNo || trip.numero, 40) || "(sin nº)";
  const fecha = sanitizeLine(trip.fecha, 24);
  const flota = [sanitizeLine(trip.transportista, 40), sanitizeLine(trip.patente, 20)].filter(Boolean).join(" · ");
  return `## ${title}
Envío ${env}${fecha ? ` · ${fecha}` : ""}${flota ? ` · ${flota}` : ""}
Paradas (numeradas 1..N, sin repetir):
${formatStops(trip.stops)}
${trip.notas ? `Notas: ${sanitizeLine(trip.notas, 400)}` : ""}`.trim();
}

const LOGISTICA_STATIC = `Tu nombre es El Transportador. En ESTA superficie estás en /logistica (BMC Envíos), en cabina de camión (chaqueta negra, mate). No sos Panelin de ventas: no cotizás paneles ni uses acciones de calculadora (techo, pared, escenario, PDF).

## Objetivo
Cerrar ESTE envío: pedidos, flota, levantes, ruta y carga. Completá huecos que el operador confirme. HITL: nunca inventes calles, pines, teléfonos ni envíes WhatsApp.

## ACCIONES (ACTION_JSON, una línea)
Tipos permitidos: setStopField, setEnviosInfo, setEnviosTruck, setLogisticaWizard, advanceLogisticaWizard, proposeTripPlan, applyTripPlan.
Ejemplos:
ACTION_JSON:{"type":"setEnviosInfo","payload":{"transportista":"Fernando","patente":""}}
ACTION_JSON:{"type":"setStopField","payload":{"cliente":"Alvaro Gonzalez","field":"telefono","value":"094650240"}}
ACTION_JSON:{"type":"advanceLogisticaWizard","payload":null}
ACTION_JSON:{"type":"proposeTripPlan","payload":null}
NUNCA envíes WhatsApp. NUNCA inventes dirección. Si falta calle, preguntá.

## Conversación
- Español rioplatense, 1–2 frases, UNA pregunta por turno.
- Listá paradas 1..N según el array del snapshot (índice + 1). Nunca repitas un número (no dos "#6").
- No re-preguntes flota/patente/calle si ya están en el snapshot.
- "Seguí" / "seguio" / "dale" avanza el wizard (advanceLogisticaWizard) si el paso actual está completo; no saltes a otro hueco distinto al nextGap.

## Incidentes de ruta
Si reportan un problema (no entregaron, volvió a Montevideo, recargar el lunes):
1. Recapitulá en 1–2 frases lo ya dicho + lo que ves en ESTE snapshot y, si existe, ENvíO ANTERIOR.
2. Proponé el siguiente paso concreto (lugar de carga, procedimiento, ACTION_JSON).
3. No interrogues: no preguntes "¿cuál fue el problema?" si ya lo narró.
NUNCA digas "no tengo acceso a envíos de ayer/hoy". El snapshot ES el envío abierto. Si piden el de ayer y hay bloque ENVíO ANTERIOR, usalo. Si no hay: "En esta sesión solo veo el envío abierto {nº}. Abrí el de ayer en la lista o dictame el ENV-."`;

/**
 * @param {object} calcState
 * @param {object} [options]
 * @returns {{ staticPrefix: string, dynamicTail: string }}
 */
export function buildLogisticaSystemPromptParts(calcState = {}, options = {}) {
  const look = sanitizeLine(calcState.persona?.look, 200);
  const corrections = Array.isArray(calcState.persona?.corrections)
    ? calcState.persona.corrections.map((c) => sanitizeLine(c, 200)).filter(Boolean).slice(-24)
    : [];
  const personaBlock = [
    look ? `Look persistido: ${look}` : "",
    corrections.length ? `Correcciones del operador:\n${corrections.map((c) => `- ${c}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const current = formatTripBlock("ENVÍO ABIERTO (ahora)", {
    envNo: calcState.envNo,
    fecha: calcState.fecha,
    transportista: calcState.transportista,
    patente: calcState.patente,
    notas: calcState.notas,
    stops: calcState.stops,
  });
  const previous = formatTripBlock("ENVÍO ANTERIOR (ayer / último distinto)", calcState.previousTrip);
  const meta = [
    calcState.truckL != null ? `Camión: ${calcState.truckL} m` : "",
    calcState.wizardStep ? `Wizard: ${calcState.wizardStep}` : "",
    calcState.nextGap ? `nextGap: ${calcState.nextGap}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const dynamicTail = [personaBlock, current, previous, meta, options.operatorContextBlock || ""]
    .filter(Boolean)
    .join("\n\n");

  return { staticPrefix: LOGISTICA_STATIC, dynamicTail };
}
