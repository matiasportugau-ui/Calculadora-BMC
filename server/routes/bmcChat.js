import { Router } from "express";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireWolfboardRead,
  requireWolfboardWrite,
} from "../middleware/requireWolfboardAuth.js";
import {
  getBmcChatInquiries,
  getBmcChatConversation,
  saveBmcChatConversation,
  clearBmcChatConversation,
  writeBmcChatInterpretation,
} from "../lib/bmcChatSheets.js";
import { interpretBmcChatInquiry } from "../lib/bmcChatGemini.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_HTML = join(__dirname, "../static/bmc-chat/index.html");

function resolveChatHtmlTemplate(config) {
  const candidates = [
    config.bmcChatHtmlPath,
    process.env.BMC_CHAT_HTML_PATH,
    DEFAULT_HTML,
  ].filter(Boolean);
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  return "<!DOCTYPE html><html><body><p>BMC Chat UI no disponible.</p></body></html>";
}

function parentOriginsForPostMessage(config) {
  const origins = new Set(config.corsOrigins || []);
  if (config.publicBaseUrl) {
    try {
      origins.add(new URL(config.publicBaseUrl).origin);
    } catch {
      // ignore invalid PUBLIC_BASE_URL
    }
  }
  return [...origins];
}

function buildChatHtml(config) {
  const template = resolveChatHtmlTemplate(config);
  const originsJson = JSON.stringify(parentOriginsForPostMessage(config));
  if (template.includes("__BMC_CHAT_PARENT_ORIGINS__")) {
    return template.replaceAll("__BMC_CHAT_PARENT_ORIGINS__", originsJson);
  }
  return template;
}

function envMissing503(res, name) {
  return res.status(503).json({ ok: false, error: `${name} not configured` });
}

function parseAdminRowIndex(config, req, res) {
  const row = Number(req.params.rowIndex);
  const minRow = config.wolfbAdminFirstDataRow || 2;
  if (!Number.isInteger(row) || row < minRow) {
    res.status(400).json({ error: "invalid rowIndex" });
    return null;
  }
  return row;
}

export default function createBmcChatRouter(config, logger) {
  const router = Router();
  let chatHtml;

  router.get("/", (_req, res) => {
    if (!chatHtml) chatHtml = buildChatHtml(config);
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(chatHtml);
  });

  router.get("/api/inquiries", requireWolfboardRead, async (req, res) => {
    if (!config.wolfbAdminSheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");
    try {
      const inquiries = await getBmcChatInquiries(config, logger);
      res.json(inquiries);
    } catch (err) {
      logger?.error({ err: err.message }, "[bmcChat] inquiries failed");
      res.status(503).json({ error: err.message });
    }
  });

  router.get("/api/conversation/:rowIndex", requireWolfboardRead, async (req, res) => {
    const row = parseAdminRowIndex(config, req, res);
    if (row == null) return;
    const convo = await getBmcChatConversation(config, row, logger);
    res.json(convo || { consulta: null, turns: [] });
  });

  router.post("/api/conversation/:rowIndex", requireWolfboardWrite, async (req, res) => {
    const row = parseAdminRowIndex(config, req, res);
    if (row == null) return;
    try {
      const ok = await saveBmcChatConversation(config, row, req.body, logger);
      res.json({ success: ok });
    } catch (err) {
      logger?.error({ err: err.message, row }, "[bmcChat] save conversation failed");
      res.status(503).json({ success: false, error: err.message });
    }
  });

  router.delete("/api/conversation/:rowIndex", requireWolfboardWrite, async (req, res) => {
    const row = parseAdminRowIndex(config, req, res);
    if (row == null) return;
    const ok = await clearBmcChatConversation(config, row, logger);
    res.json({ success: ok });
  });

  router.post("/api/interpret/:rowIndex", requireWolfboardWrite, async (req, res) => {
    const row = parseAdminRowIndex(config, req, res);
    if (row == null) return;
    try {
      const { consulta, conversation, newUserMessage } = req.body;
      if (!consulta) return res.status(400).json({ error: "consulta required" });
      if (!config.geminiApiKey) return envMissing503(res, "GEMINI_API_KEY");

      const interpretation = await interpretBmcChatInquiry(
        config,
        consulta,
        conversation || null,
        newUserMessage || "",
      );
      res.json(interpretation);
    } catch (err) {
      logger?.error({ err: err.message }, "[bmcChat] interpret failed");
      res.status(503).json({ error: err.message });
    }
  });

  router.post("/api/write/:rowIndex", requireWolfboardWrite, async (req, res) => {
    const row = parseAdminRowIndex(config, req, res);
    if (row == null) return;
    try {
      const { interpretation } = req.body;
      if (!interpretation) return res.status(400).json({ error: "interpretation required" });
      if (!config.wolfbAdminSheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

      const result = await writeBmcChatInterpretation(config, row, interpretation, logger);
      res.json(result);
    } catch (err) {
      logger?.error({ err: err.message }, "[bmcChat] write failed");
      res.status(503).json({ success: false, error: err.message });
    }
  });

  return router;
}
