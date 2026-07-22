import assert from "node:assert/strict";
import {
  stripHistoryNoise,
  buildAgentChatRequestBody,
  isRoutineInfoNote,
} from "../src/hooks/useChat.js";
import { mapErrorMessage } from "../src/utils/chatErrors.js";

assert.equal(
  stripHistoryNoise("Hola\n_Se truncó el historial para mantener la calidad de la respuesta._\nRespuesta real"),
  "Hola\nRespuesta real",
);
assert.equal(stripHistoryNoise("L1\n\nL3"), "L1\n\nL3");
assert.equal(stripHistoryNoise("_Co-Work: analizando captura…_"), "");

const body = buildAgentChatRequestBody({
  history: [{ role: "assistant", content: "ok\n_note_" }],
  userText: "x",
  calcState: {},
  operatorContext: { defaults: { listaPrecios: "venta" } },
});
assert.equal(body.messages[0].content, "ok");

const err400 = { _status: 400, _serverMessage: "Historial demasiado largo (máx. 60 mensajes)." };
assert.match(mapErrorMessage(err400), /Limpiar chat/i);

assert.equal(isRoutineInfoNote("Usando gemini…"), true);
assert.equal(isRoutineInfoNote("Se truncó el historial para mantener la calidad de la respuesta."), true);
assert.equal(isRoutineInfoNote("Sheets no disponible — reintentá."), false);

console.log("chatHistoryNoise.test.js OK");
