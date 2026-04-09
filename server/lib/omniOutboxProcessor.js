import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { downloadWhatsAppMedia } from "./omniWaMedia.js";
import { uploadBufferToGcs } from "./omniGcs.js";

/**
 * @param {import("pg").Pool} pool
 * @param {object} config
 * @param {object} logger
 */
export async function claimNextOmniOutboxJob(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `select id, job_type, payload, attempts from omni_outbox
       where status = 'pending' and next_run_at <= now()
       order by id asc
       for update skip locked
       limit 1`,
    );
    if (!rows.length) {
      await client.query("COMMIT");
      return null;
    }
    const job = rows[0];
    await client.query(
      `update omni_outbox set status = 'processing', attempts = attempts + 1, updated_at = now() where id = $1`,
      [job.id],
    );
    await client.query("COMMIT");
    return job;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function completeOmniJob(pool, id, errMsg) {
  if (errMsg) {
    await pool.query(
      `update omni_outbox set status = 'failed', last_error = $2, updated_at = now() where id = $1`,
      [id, String(errMsg).slice(0, 2000)],
    );
  } else {
    await pool.query(`update omni_outbox set status = 'done', updated_at = now() where id = $1`, [id]);
  }
}

/**
 * @param {import("pg").Pool} pool
 * @param {object} config
 * @param {object} logger
 * @param {{ id: number, job_type: string, payload: object }} job
 */
export async function processOmniOutboxJob(pool, config, logger, job) {
  const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;

  if (job.job_type === "wa_media_download") {
    const attachmentId = payload.attachmentId;
    if (!attachmentId) throw new Error("missing attachmentId");

    const { rows } = await pool.query(
      `select oa.id, oa.whatsapp_media_id, oa.media_kind, oa.mime_type, om.channel
       from omni_attachments oa
       join omni_messages om on om.id = oa.message_id
       where oa.id = $1`,
      [attachmentId],
    );
    const att = rows[0];
    if (!att || !att.whatsapp_media_id) throw new Error("attachment not found");

    if (att.channel !== "whatsapp") {
      throw new Error("wa_media_download only for whatsapp channel");
    }

    const token = config.whatsappAccessToken;
    if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN missing");

    const { buffer, mimeType } = await downloadWhatsAppMedia({
      mediaId: att.whatsapp_media_id,
      accessToken: token,
      graphVersion: config.metaGraphVersion,
    });

    const maxB = config.omniMaxAttachmentBytes || 25 * 1024 * 1024;
    if (buffer.length > maxB) throw new Error("attachment too large");

    let gcsUri = "";
    if (config.omniGcsBucket) {
      const ext =
        mimeType.includes("pdf") ? "pdf" :
        mimeType.includes("audio") || mimeType.includes("ogg") ? "ogg" :
        mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" :
        mimeType.includes("png") ? "png" : "bin";
      const objectPath = `omni/wa/${payload.messageId || "m"}/${attachmentId}.${ext}`;
      gcsUri = await uploadBufferToGcs({
        bucket: config.omniGcsBucket,
        objectPath,
        buffer,
        contentType: mimeType,
      });
    }

    await pool.query(
      `update omni_attachments set gcs_uri = $2, mime_type = coalesce(mime_type, $3), byte_size = $4,
        processing_status = 'downloaded', updated_at = now() where id = $1`,
      [attachmentId, gcsUri || null, mimeType, buffer.length],
    );

    const kind = att.media_kind || "";
    if (kind === "audio" || mimeType.startsWith("audio/")) {
      await pool.query(`insert into omni_outbox (job_type, payload, status, next_run_at) values ($1, $2::jsonb, 'pending', now())`, [
        "wa_media_transcribe",
        JSON.stringify({ attachmentId, messageId: payload.messageId }),
      ]);
    } else if (kind === "document" || mimeType.includes("pdf")) {
      await pool.query(`insert into omni_outbox (job_type, payload, status, next_run_at) values ($1, $2::jsonb, 'pending', now())`, [
        "wa_media_pdf_text",
        JSON.stringify({ attachmentId }),
      ]);
    } else if ((kind === "image" || mimeType.startsWith("image/")) && config.omniImageExtractEnabled && config.openaiApiKey) {
      await pool.query(`insert into omni_outbox (job_type, payload, status, next_run_at) values ($1, $2::jsonb, 'pending', now())`, [
        "wa_media_image_caption",
        JSON.stringify({ attachmentId }),
      ]);
    }

    logger?.info?.({ attachmentId }, "[omni] wa_media_download ok");
    return;
  }

  if (job.job_type === "wa_media_transcribe") {
    const attachmentId = payload.attachmentId;
    const { rows } = await pool.query(
      `select oa.gcs_uri, oa.mime_type from omni_attachments oa where oa.id = $1`,
      [attachmentId],
    );
    const att = rows[0];
    if (!config.openaiApiKey) {
      await pool.query(
        `update omni_attachments set processing_status = 'failed', error = $2 where id = $1`,
        [attachmentId, "OPENAI_API_KEY missing for STT"],
      );
      return;
    }
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: config.openaiApiKey });

    let filePath = "";
    try {
      if (att.gcs_uri && att.gcs_uri.startsWith("gs://")) {
        const { Storage } = await import("@google-cloud/storage");
        const storage = new Storage();
        const rest = att.gcs_uri.replace(/^gs:\/\//, "");
        const [b, ...op] = rest.split("/");
        const objectPath = op.join("/");
        const [bbuf] = await storage.bucket(b).file(objectPath).download();
        filePath = path.join(os.tmpdir(), `omni-stt-${attachmentId}.ogg`);
        await fs.promises.writeFile(filePath, bbuf);
      } else {
        throw new Error("missing gcs_uri for transcribe");
      }

      const tr = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
      });
      const text = tr.text || "";
      await pool.query(
        `update omni_attachments set extracted_text = $2, processing_status = 'processed', updated_at = now() where id = $1`,
        [attachmentId, text],
      );
      logger?.info?.({ attachmentId }, "[omni] transcribe ok");
    } finally {
      if (filePath) await fs.promises.unlink(filePath).catch(() => {});
    }
    return;
  }

  if (job.job_type === "wa_media_pdf_text") {
    const attachmentId = payload.attachmentId;
    const { rows } = await pool.query(`select gcs_uri from omni_attachments where id = $1`, [attachmentId]);
    const gcsUri = rows[0]?.gcs_uri;
    if (!gcsUri?.startsWith("gs://")) throw new Error("missing gcs for pdf");

    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage();
    const rest = gcsUri.replace(/^gs:\/\//, "");
    const [b, ...op] = rest.split("/");
    const [buf] = await storage.bucket(b).file(op.join("/")).download();

    const pdfMod = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = pdfMod.default || pdfMod;
    const data = await pdfParse(buf);
    const text = String(data.text || "").trim().slice(0, 50000);
    await pool.query(
      `update omni_attachments set extracted_text = $2, processing_status = 'processed', updated_at = now() where id = $1`,
      [attachmentId, text],
    );
    logger?.info?.({ attachmentId, len: text.length }, "[omni] pdf text ok");
    return;
  }

  if (job.job_type === "wa_media_image_caption") {
    const attachmentId = payload.attachmentId;
    if (!config.openaiApiKey) return;
    const { rows } = await pool.query(`select gcs_uri, mime_type from omni_attachments where id = $1`, [attachmentId]);
    const att = rows[0];
    if (!att?.gcs_uri?.startsWith("gs://")) return;

    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage();
    const rest = att.gcs_uri.replace(/^gs:\/\//, "");
    const [b, ...op] = rest.split("/");
    const [buf] = await storage.bucket(b).file(op.join("/")).download();
    const b64 = buf.toString("base64");
    const mime = att.mime_type || "image/jpeg";

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: config.openaiApiKey });
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe brevemente el contenido de la imagen para un CRM (español)." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        },
      ],
      max_tokens: 400,
    });
    const text = resp.choices?.[0]?.message?.content?.trim() || "";
    await pool.query(
      `update omni_attachments set extracted_text = $2, processing_status = 'processed', updated_at = now() where id = $1`,
      [attachmentId, text.slice(0, 8000)],
    );
    return;
  }

  throw new Error(`unknown job_type ${job.job_type}`);
}
