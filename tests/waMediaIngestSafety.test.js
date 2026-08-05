/**
 * Critical safety for WA media richness:
 * - re-ingest must not downgrade media types to text
 * - private media bucket must not silently use public quotes bucket
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeIngestMessageType } from "../server/lib/waValidate.js";
import {
  waMediaBucket,
  isSafeWaMediaObjectPath,
} from "../server/lib/waMedia.js";

describe("mergeIngestMessageType", () => {
  it("never downgrades audio/image to text on re-ingest", () => {
    assert.equal(mergeIngestMessageType("audio", "text"), "audio");
    assert.equal(mergeIngestMessageType("image", "text"), "image");
    assert.equal(mergeIngestMessageType("video", "text"), "video");
    assert.equal(mergeIngestMessageType("doc", "text"), "doc");
  });

  it("allows upgrade from text to media and media corrections", () => {
    assert.equal(mergeIngestMessageType("text", "audio"), "audio");
    assert.equal(mergeIngestMessageType("text", "image"), "image");
    assert.equal(mergeIngestMessageType("image", "audio"), "audio");
  });

  it("keeps text→text and empty fallbacks stable", () => {
    assert.equal(mergeIngestMessageType("text", "text"), "text");
    assert.equal(mergeIngestMessageType(null, "text"), "text");
    assert.equal(mergeIngestMessageType("audio", null), "audio");
  });
});

describe("waMediaBucket fail-closed vs public quotes bucket", () => {
  const prev = {
    GCS_WA_MEDIA_BUCKET: process.env.GCS_WA_MEDIA_BUCKET,
    WA_MEDIA_GCS_BUCKET: process.env.WA_MEDIA_GCS_BUCKET,
    WA_MEDIA_ALLOW_QUOTES_BUCKET: process.env.WA_MEDIA_ALLOW_QUOTES_BUCKET,
    GCS_QUOTES_BUCKET: process.env.GCS_QUOTES_BUCKET,
  };

  function restore() {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  it("returns empty when dedicated bucket unset (no silent quotes fallback)", () => {
    delete process.env.GCS_WA_MEDIA_BUCKET;
    delete process.env.WA_MEDIA_GCS_BUCKET;
    delete process.env.WA_MEDIA_ALLOW_QUOTES_BUCKET;
    process.env.GCS_QUOTES_BUCKET = "bmc-cotizaciones";
    try {
      // config is loaded at import time; waMediaBucket still reads process.env for dedicated
      // and allow-quotes. Without allow flag, must not return quotes bucket name.
      const b = waMediaBucket();
      assert.notEqual(b, "bmc-cotizaciones");
      assert.equal(b, "");
    } finally {
      restore();
    }
  });

  it("uses GCS_WA_MEDIA_BUCKET when set", () => {
    process.env.GCS_WA_MEDIA_BUCKET = "bmc-wa-media-private";
    delete process.env.WA_MEDIA_ALLOW_QUOTES_BUCKET;
    try {
      assert.equal(waMediaBucket(), "bmc-wa-media-private");
    } finally {
      restore();
    }
  });

  it("allows quotes bucket only with explicit escape hatch", () => {
    delete process.env.GCS_WA_MEDIA_BUCKET;
    delete process.env.WA_MEDIA_GCS_BUCKET;
    process.env.WA_MEDIA_ALLOW_QUOTES_BUCKET = "1";
    process.env.GCS_QUOTES_BUCKET = "bmc-cotizaciones";
    try {
      assert.equal(waMediaBucket(), "bmc-cotizaciones");
    } finally {
      restore();
    }
  });
});

describe("isSafeWaMediaObjectPath", () => {
  it("accepts normal wa-media keys", () => {
    assert.equal(isSafeWaMediaObjectPath("wa-media/59899@s.whatsapp.net/msg1.ogg"), true);
  });
  it("rejects traversal and non-prefix paths", () => {
    assert.equal(isSafeWaMediaObjectPath("quotes/secret.pdf"), false);
    assert.equal(isSafeWaMediaObjectPath("wa-media/../quotes/x.pdf"), false);
    assert.equal(isSafeWaMediaObjectPath("wa-media/foo\\bar"), false);
    assert.equal(isSafeWaMediaObjectPath(""), false);
  });
});
