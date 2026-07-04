import assert from "node:assert/strict";
import { resolveDesignPreviewEnabled } from "../src/lib/designPreviewMode.js";

assert.equal(
  resolveDesignPreviewEnabled({ vercelEnv: "production", search: "?designPreview=1" }),
  false,
  "Vercel production must ignore the designPreview query param",
);

assert.equal(
  resolveDesignPreviewEnabled({ vercelEnv: "preview", search: "" }),
  true,
  "Vercel preview deployments should enable design preview automatically",
);

assert.equal(
  resolveDesignPreviewEnabled({ vercelEnv: "", search: "?designPreview=1" }),
  true,
  "Local builds should keep the query-param opt-in",
);

assert.equal(
  resolveDesignPreviewEnabled({ flag: "1", vercelEnv: "production", search: "" }),
  true,
  "Explicit env opt-in remains available for controlled preview builds",
);

const previousVercelEnv = process.env.VERCEL_ENV;
process.env.VERCEL_ENV = "production";
const viteConfigUrl = new URL(`../vite.config.js?design-preview-test=${Date.now()}`, import.meta.url);
const viteConfig = (await import(viteConfigUrl.href)).default;
if (previousVercelEnv == null) {
  delete process.env.VERCEL_ENV;
} else {
  process.env.VERCEL_ENV = previousVercelEnv;
}

assert.equal(
  viteConfig.define?.["globalThis.__BMC_VERCEL_ENV__"],
  JSON.stringify("production"),
  "Vite must expose non-secret VERCEL_ENV to the client bundle",
);

console.log("designPreviewMode: all checks passed");
