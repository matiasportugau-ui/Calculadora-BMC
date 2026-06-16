import { isAllowedModel } from "./aiProviderConfig.js";

const PUBLIC_REASONER_PROVIDERS = new Set(["claude", "gemini"]);

function toOptionalTrimmedString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function resolvePublicReasonerOptions(input = {}) {
  const reasonerProvider = toOptionalTrimmedString(input.reasonerProvider);
  const reasonerModel = toOptionalTrimmedString(input.reasonerModel);

  if (!reasonerProvider) {
    if (reasonerModel) {
      throw badRequest("El campo 'reasonerModel' requiere 'reasonerProvider'.");
    }
    return { reasonerProvider: null, reasonerModel: null };
  }

  if (!PUBLIC_REASONER_PROVIDERS.has(reasonerProvider)) {
    throw badRequest("Proveedor de razonamiento no soportado. Usá 'claude' o 'gemini'.");
  }

  if (!reasonerModel) {
    return { reasonerProvider, reasonerModel: null };
  }

  if (!isAllowedModel(reasonerProvider, reasonerModel)) {
    throw badRequest("Modelo de razonamiento no soportado para el proveedor indicado.");
  }

  return { reasonerProvider, reasonerModel };
}

export function buildReasonerCallOptions({
  reasonerProvider = null,
  reasonerModel = null,
  calcState = {},
} = {}) {
  const callOpts = {
    channel: "chat",
    calcState,
  };

  if (!reasonerProvider && reasonerModel) {
    throw new Error("reasonerModel requires reasonerProvider");
  }

  if (reasonerProvider) {
    callOpts.provider = reasonerProvider;
  }

  if (reasonerModel) {
    callOpts.override = {
      provider: reasonerProvider,
      model: reasonerModel,
    };
  }

  return callOpts;
}
