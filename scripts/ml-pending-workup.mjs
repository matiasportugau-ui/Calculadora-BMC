#!/usr/bin/env node
/**
 * ml-pending-workup.mjs — Preguntas ML sin responder: checklist + borrador + precio/Matriz.
 * No publica respuestas en Mercado Libre (solo lectura + sugerencia).
 *
 * Uso:
 *   npm run start:api
 *   npm run ml:pending-workup
 *
 * Opciones: --json  (salida JSON en stdout)
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config();

import { createTokenStore } from "../server/tokenStore.js";
import { createMercadoLibreClient } from "../server/mercadoLibreClient.js";
import { config } from "../server/config.js";
import {
  buildMatrizInforme,
  findMatrizPrice,
  generateResponse,
  autoCategoria,
} from "../server/ml-crm-sync.js";
import { analyzeQuotationGaps } from "../server/ml-quotation-gaps.js";

const JSON_MODE = process.argv.includes("--json");

async function main() {
  const tokenStore = createTokenStore({
    storageType: config.tokenStorage,
    filePath: config.tokenFile,
    gcsBucket: config.tokenGcsBucket,
    gcsObject: config.tokenGcsObject,
    encryptionKey: config.tokenEncryptionKey,
    logger: console,
  });
  const ml = createMercadoLibreClient({ config, tokenStore, logger: console });

  const tokens = await tokenStore.read();
  if (!tokens?.access_token) {
    console.error("No ML tokens — complete OAuth (/auth/ml/start) first.");
    process.exit(1);
  }

  let informe = null;
  try {
    informe = buildMatrizInforme();
  } catch {
    /* sin matriz local */
  }

  const sellerId = await ml.resolveSellerId();
  const qRes = await ml.requestWithRetries({
    method: "GET",
    path: "/questions/search",
    query: { seller_id: sellerId, status: "UNANSWERED", limit: 50 },
  });
  const questions = qRes.questions || [];

  const nicknames = {};
  const items = {};
  for (const q of questions) {
    const uid = q.from?.id;
    if (uid && !nicknames[uid]) {
      const u = await ml.requestWithRetries({ method: "GET", path: `/users/${uid}` }).catch(() => null);
      nicknames[uid] = u?.nickname || `ML#${uid}`;
    }
    if (q.item_id && !items[q.item_id]) {
      items[q.item_id] = await ml.requestWithRetries({ method: "GET", path: `/items/${q.item_id}` }).catch(() => null);
    }
  }

  const out = [];
  for (const q of questions) {
    const item = items[q.item_id] || {};
    const nickname = nicknames[q.from?.id] || `ML#${q.from?.id}`;
    const itemTitle = item.title || q.item_id || "";
    const priceML = item.price ?? null;
    const matrizMatch = informe ? findMatrizPrice(itemTitle, informe) : null;
    const hasPriceMismatch = priceML && matrizMatch && priceML !== matrizMatch.precio;
    const gaps = analyzeQuotationGaps(q, item);
    const draft = generateResponse(q, item, nickname, hasPriceMismatch);
    const draftIfPriceOk =
      hasPriceMismatch ? generateResponse(q, item, nickname, false) : draft;
    out.push({
      questionId: q.id,
      itemId: q.item_id,
      buyer: nickname,
      date: q.date_created,
      questionText: q.text,
      itemTitle,
      priceML,
      matrizFuente: matrizMatch?.fuente ?? null,
      matrizPrecio: matrizMatch?.precio ?? null,
      hasPriceMismatch,
      categoria: autoCategoria(itemTitle, q.text),
      gaps,
      draftSuggested: draft,
      draftIfPriceValidated: draftIfPriceOk,
    });
  }

  if (JSON_MODE) {
    console.log(JSON.stringify({ questions: out }, null, 2));
    return;
  }

  if (out.length === 0) {
    console.log("No hay preguntas UNANSWERED.");
    return;
  }

  for (const row of out) {
    console.log("---");
    console.log(`Q:${row.questionId} | ${row.itemId}`);
    console.log(`Comprador: ${row.buyer}`);
    console.log(`Pregunta: ${row.questionText}`);
    console.log(`Publicación: ${row.itemTitle}`);
    console.log(`Precio ML (m²): ${row.priceML ?? "—"} | Matriz: ${row.matrizFuente ?? "—"} — ${row.matrizPrecio ?? "—"}`);
    if (row.hasPriceMismatch) {
      console.log("⚠ PRECIO: revisar ML vs Matriz antes de publicar respuesta.");
    }
    console.log(`Categoría (auto): ${row.categoria}`);
    console.log("Puntos faltantes / bloqueos:");
    if (row.gaps.missingPoints.length === 0) {
      console.log("  (ninguno detectado por heurística)");
    } else {
      for (const m of row.gaps.missingPoints) console.log(`  - ${m}`);
    }
    if (row.gaps.warnings.length) {
      console.log("Advertencias:");
      for (const w of row.gaps.warnings) console.log(`  - ${w}`);
    }
    console.log("Borrador sugerido (revisar antes de enviar):");
    console.log(row.draftSuggested || "(vacío por revisión precio — no publicar hasta validar)");
    if (row.hasPriceMismatch && row.draftIfPriceValidated) {
      console.log("Referencia si el precio ML/Matriz queda validado (no enviar tal cual sin revisión):");
      console.log(row.draftIfPriceValidated);
    }
  }
  console.log("---");
  console.log(`Total: ${out.length} pendiente(s). No se envió nada a ML.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
