/**
 * Chat API — uso opcional (p. ej. desde el dashboard o integración GPT).
 * Si el frontend usa Vite + Express, el chat puede vivir en server/routes/chat.js
 * y este archivo quedar como stub para un futuro deploy en Vercel/Next.
 */

export const dynamic = "force-dynamic";

export type ChatRequestBody = {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type ChatResponseBody = {
  reply: string;
  error?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return Response.json(
        { reply: "", error: "message is required" } satisfies ChatResponseBody,
        { status: 400 }
      );
    }

    // Placeholder: respuestas cortas según palabras clave (sin LLM).
    // Para integrar un LLM: llamar a OpenAI/Vertex desde aquí o desde server/routes.
    let reply = "";
    if (/\b(precio|presupuesto|cotizaci[oó]n)\b/i.test(message)) {
      reply = "Podés armar tu cotización en la calculadora (techo, fachada o cámara frigorífica) y luego imprimir o guardar el presupuesto.";
    } else if (/\b(techo|fachada|c[aá]mara)\b/i.test(message)) {
      reply = "En Modo Vendedor tenés el wizard paso a paso para solo techo, solo fachada, techo+fachada o cámara frigorífica. Elegí el escenario y completá los pasos.";
    } else if (/\b(hola|ayuda|help)\b/i.test(message)) {
      reply = "Hola. Puedo ayudarte con dudas sobre la calculadora BMC: precios, escenarios (techo, fachada, cámara) o cómo usar el wizard.";
    } else {
      reply = "Por ahora respondo solo sobre la calculadora BMC (precios, escenarios, wizard). ¿En qué te ayudo?";
    }

    return Response.json({ reply } satisfies ChatResponseBody, { status: 200 });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    return Response.json(
      { reply: "", error } satisfies ChatResponseBody,
      { status: 500 }
    );
  }
}
