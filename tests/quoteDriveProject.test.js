// ═══════════════════════════════════════════════════════════════════════════
// GET /api/quotes/drive-project — #1024 load-via-API (no tests on merge).
// Pins folderId validation + error mapping. Does not lock in anonymous access
// (open #1025 auth-gates this route). Run: node --test tests/quoteDriveProject.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.APP_ENV = "test";

const { loadProjectFromDriveFolder } = await import("../server/lib/driveUpload.js");
const { createQuoteDriveArchiveRouter } = await import("../server/routes/quoteDriveArchive.js");

function badRequest(message = "invalid_folder_id") {
  return Object.assign(new Error(message), { code: "bad_request" });
}

function driveUnavailable() {
  return Object.assign(new Error("drive_unavailable"), { code: "drive_unavailable" });
}

let server;
let port;
let loadCalls;
let loadImpl;

before(async () => {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/api",
    createQuoteDriveArchiveRouter(
      { driveQuoteFolderId: "drive-folder-test" },
      {
        loadProjectFromDriveFolder: async (folderId) => {
          loadCalls.push(folderId);
          return loadImpl(folderId);
        },
      },
    ),
  );

  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  loadCalls = [];
  loadImpl = async () => null;
});

const url = (path) => `http://127.0.0.1:${port}${path}`;

async function getDriveProject(query) {
  const res = await fetch(url(`/api/quotes/drive-project${query}`));
  const body = await res.json();
  return { status: res.status, body, cache: res.headers.get("cache-control") };
}

describe("loadProjectFromDriveFolder folderId validation", () => {
  it("rejects empty, short, quoted, and path-like folder ids before Drive I/O", async () => {
    const bad = ["", "   ", "short", "../etc/passwd", "abc'defghij", "folder id!!", "a".repeat(129)];
    for (const folderId of bad) {
      await assert.rejects(
        () => loadProjectFromDriveFolder(folderId),
        (err) => err?.code === "bad_request" && /invalid_folder_id/.test(String(err?.message)),
        `expected bad_request for ${JSON.stringify(folderId)}`,
      );
    }
  });
});

describe("GET /api/quotes/drive-project", () => {
  it("returns 400 when folderId is missing or blank", async () => {
    const missing = await getDriveProject("");
    assert.equal(missing.status, 400);
    assert.equal(missing.body.ok, false);
    assert.equal(missing.body.error, "missing_folder_id");
    assert.equal(loadCalls.length, 0);

    const blank = await getDriveProject("?folderId=%20%20");
    assert.equal(blank.status, 400);
    assert.equal(blank.body.error, "missing_folder_id");
    assert.equal(loadCalls.length, 0);
  });

  it("maps invalid_folder_id from the loader to 400", async () => {
    loadImpl = async () => {
      throw badRequest("invalid_folder_id");
    };
    const res = await getDriveProject("?folderId=not-a-real-folder-id");
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error, "invalid_folder_id");
    assert.deepEqual(loadCalls, ["not-a-real-folder-id"]);
  });

  it("returns 404 when the folder has no .bmc.json", async () => {
    loadImpl = async () => null;
    const res = await getDriveProject("?folderId=0123456789ab");
    assert.equal(res.status, 404);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error, "bmc_json_not_found");
  });

  it("returns 503 when Drive OAuth/credentials are unavailable", async () => {
    loadImpl = async () => {
      throw driveUnavailable();
    };
    const res = await getDriveProject("?folderId=0123456789ab");
    assert.equal(res.status, 503);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error, "drive_unavailable");
  });

  it("returns 503 on invalid_grant-style credential errors", async () => {
    loadImpl = async () => {
      throw new Error("invalid_grant: token expired");
    };
    const res = await getDriveProject("?folderId=0123456789ab");
    assert.equal(res.status, 503);
    assert.equal(res.body.error, "drive_unavailable");
  });

  it("returns 500 for unexpected loader failures", async () => {
    loadImpl = async () => {
      throw new Error("socket hang up");
    };
    const res = await getDriveProject("?folderId=0123456789ab");
    assert.equal(res.status, 500);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error, "drive_load_failed");
  });

  it("returns projectData, file metadata, and a private cache header on success", async () => {
    const projectData = {
      _meta: { quotationCode: "BMC-DRV-0001" },
      scenario: "solo_techo",
      listaPrecios: "venta",
    };
    loadImpl = async (folderId) => ({
      projectData,
      fileId: "file-bmc-1",
      fileName: `${folderId}.bmc.json`,
    });
    const res = await getDriveProject("?folderId=0123456789ab");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.folderId, "0123456789ab");
    assert.equal(res.body.fileId, "file-bmc-1");
    assert.equal(res.body.fileName, "0123456789ab.bmc.json");
    assert.deepEqual(res.body.projectData, projectData);
    assert.match(String(res.cache || ""), /private/);
  });
});
