/**
 * Regression guard — GET /api/quotes/drive-project (#1024).
 * Deep-link openDrive loads .bmc.json via server OAuth (GIS drive.file mismatch).
 *
 * Run: node --test tests/quoteDriveProject.test.js
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.APP_ENV = "test";

const { createQuoteDriveArchiveRouter } = await import("../server/routes/quoteDriveArchive.js");

const VALID_FOLDER = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345";

function listen(loadImpl) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createQuoteDriveArchiveRouter(
      { driveQuoteFolderId: "root-folder" },
      { loadProjectFromDriveFolder: loadImpl },
    ),
  );
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        port,
        close: () => new Promise((r) => server.close(r)),
        url: (path) => `http://127.0.0.1:${port}${path}`,
      });
    });
  });
}

describe("GET /api/quotes/drive-project", () => {
  it("rejects missing folderId", async () => {
    const { url, close } = await listen(async () => {
      throw new Error("load should not run");
    });
    try {
      const res = await fetch(url("/api/quotes/drive-project"));
      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.error, "missing_folder_id");
    } finally {
      await close();
    }
  });

  it("maps invalid_folder_id to 400", async () => {
    const { url, close } = await listen(async () => {
      throw Object.assign(new Error("invalid_folder_id"), { code: "bad_request" });
    });
    try {
      const res = await fetch(url(`/api/quotes/drive-project?folderId=${VALID_FOLDER}`));
      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.error, "invalid_folder_id");
    } finally {
      await close();
    }
  });

  it("returns 404 when no .bmc.json is present", async () => {
    const { url, close } = await listen(async () => null);
    try {
      const res = await fetch(url(`/api/quotes/drive-project?folderId=${VALID_FOLDER}`));
      const body = await res.json();
      assert.equal(res.status, 404);
      assert.equal(body.error, "bmc_json_not_found");
    } finally {
      await close();
    }
  });

  it("returns projectData on success", async () => {
    const projectData = { _meta: { quotationCode: "BMC-DRV-1" }, scenario: "solo_techo" };
    let seenFolder = null;
    const { url, close } = await listen(async (folderId) => {
      seenFolder = folderId;
      return { projectData, fileId: "file-1", fileName: "BMC-DRV-1.bmc.json" };
    });
    try {
      const res = await fetch(url(`/api/quotes/drive-project?folderId=${VALID_FOLDER}`));
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.ok, true);
      assert.equal(seenFolder, VALID_FOLDER);
      assert.equal(body.fileId, "file-1");
      assert.equal(body.fileName, "BMC-DRV-1.bmc.json");
      assert.equal(body.projectData._meta.quotationCode, "BMC-DRV-1");
      assert.match(String(res.headers.get("cache-control") || ""), /private/);
    } finally {
      await close();
    }
  });

  it("maps drive_unavailable to 503", async () => {
    const { url, close } = await listen(async () => {
      throw Object.assign(new Error("drive_unavailable"), { code: "drive_unavailable" });
    });
    try {
      const res = await fetch(url(`/api/quotes/drive-project?folderId=${VALID_FOLDER}`));
      const body = await res.json();
      assert.equal(res.status, 503);
      assert.equal(body.error, "drive_unavailable");
    } finally {
      await close();
    }
  });
});

describe("loadProjectFromDriveFolder validation (pure edges)", () => {
  let loadProjectFromDriveFolder;
  let prevId;
  let prevSecret;
  let prevRefresh;
  let prevFolder;

  before(async () => {
    prevId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    prevSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    prevRefresh = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    prevFolder = process.env.DRIVE_QUOTE_FOLDER_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    delete process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    delete process.env.DRIVE_QUOTE_FOLDER_ID;
    ({ loadProjectFromDriveFolder } = await import("../server/lib/driveUpload.js"));
  });

  after(() => {
    if (prevId == null) delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    else process.env.GOOGLE_DRIVE_CLIENT_ID = prevId;
    if (prevSecret == null) delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    else process.env.GOOGLE_DRIVE_CLIENT_SECRET = prevSecret;
    if (prevRefresh == null) delete process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    else process.env.GOOGLE_DRIVE_REFRESH_TOKEN = prevRefresh;
    if (prevFolder == null) delete process.env.DRIVE_QUOTE_FOLDER_ID;
    else process.env.DRIVE_QUOTE_FOLDER_ID = prevFolder;
  });

  it("rejects malformed folder ids before calling Drive", async () => {
    await assert.rejects(
      () => loadProjectFromDriveFolder("../etc/passwd"),
      (err) => err?.code === "bad_request" && /invalid_folder_id/.test(err.message),
    );
    await assert.rejects(
      () => loadProjectFromDriveFolder("short"),
      (err) => err?.code === "bad_request",
    );
  });

  it("fails soft with drive_unavailable when OAuth/folder env is missing", async () => {
    await assert.rejects(
      () => loadProjectFromDriveFolder(VALID_FOLDER),
      (err) => err?.code === "drive_unavailable",
    );
  });
});
