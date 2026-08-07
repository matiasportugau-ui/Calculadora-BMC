/**
 * SSRF / DoS guards for POST /api/envios/adjunto-fetch
 */
import assert from "node:assert/strict";
import {
  assertAllowedAdjuntoUrl,
  fetchAdjuntoUpstream,
  isAllowedAdjuntoHost,
  readBodyWithLimit,
  resolveAdjuntoFetchUrl,
  toServerFetchablePdfUrl,
} from "../server/lib/enviosAdjuntoFetch.js";

function expectCode(fn, code) {
  try {
    fn();
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(err.code, code, `expected code ${code}, got ${err.code}: ${err.message}`);
  }
}

console.log("enviosAdjuntoFetch — allowlist");

assert.equal(isAllowedAdjuntoHost("drive.google.com"), true);
assert.equal(isAllowedAdjuntoHost("docs.google.com"), true);
assert.equal(isAllowedAdjuntoHost("www.dropbox.com"), true);
assert.equal(isAllowedAdjuntoHost("doc-00-00-docs.googleusercontent.com"), true);
// Current Drive /uc download CDN (not *.googleusercontent.com)
assert.equal(isAllowedAdjuntoHost("drive.usercontent.google.com"), true);
assert.equal(isAllowedAdjuntoHost("dl-eu.dropboxusercontent.com"), true);
assert.equal(isAllowedAdjuntoHost("evil.com"), false);
assert.equal(isAllowedAdjuntoHost("drive.google.com.evil.com"), false);
assert.equal(isAllowedAdjuntoHost("drive.usercontent.google.com.evil.com"), false);
assert.equal(isAllowedAdjuntoHost("169.254.169.254"), false);
assert.equal(isAllowedAdjuntoHost("localhost"), false);

expectCode(() => assertAllowedAdjuntoUrl("http://169.254.169.254/latest/meta-data/"), "url_https_required");
expectCode(() => assertAllowedAdjuntoUrl("https://169.254.169.254/"), "url_host_forbidden");
expectCode(() => assertAllowedAdjuntoUrl("https://metadata.google.internal/"), "url_host_forbidden");
expectCode(() => assertAllowedAdjuntoUrl("https://evil.com/file.pdf"), "url_host_forbidden");
expectCode(() => assertAllowedAdjuntoUrl("https://dropbox.com.evil.com/s/x"), "url_host_forbidden");
expectCode(
  () => assertAllowedAdjuntoUrl("https://user:pass@drive.google.com/file/d/abc/view"),
  "url_credentials_forbidden",
);

const driveView = assertAllowedAdjuntoUrl("https://drive.google.com/file/d/abcXYZ123/view?usp=sharing");
assert.ok(driveView.href.includes("drive.google.com"));

const rewritten = toServerFetchablePdfUrl("https://drive.google.com/file/d/abcXYZ123/view");
assert.equal(rewritten, "https://drive.google.com/uc?export=download&id=abcXYZ123");

const dropbox = toServerFetchablePdfUrl("https://www.dropbox.com/s/abc/file.pdf?dl=0");
assert.ok(dropbox.includes("dl=1"), "dropbox forces dl=1");

// Substring trap: evil host mentioning dropbox must not be rewritten into a fetchable allowlisted URL
assert.equal(
  toServerFetchablePdfUrl("https://evil.com/dropbox.com/file.pdf"),
  "https://evil.com/dropbox.com/file.pdf",
);
expectCode(() => resolveAdjuntoFetchUrl("https://evil.com/dropbox.com/file.pdf"), "url_host_forbidden");
expectCode(() => resolveAdjuntoFetchUrl("http://127.0.0.1:3001/health"), "url_https_required");

const okResolved = resolveAdjuntoFetchUrl("https://drive.google.com/file/d/abcXYZ123/view");
assert.equal(okResolved, "https://drive.google.com/uc?export=download&id=abcXYZ123");

console.log("enviosAdjuntoFetch — body limit");

{
  const big = Buffer.alloc(100);
  const res = {
    headers: { get: (k) => (k === "content-length" ? "999999999" : null) },
    body: null,
    async arrayBuffer() {
      return big.buffer;
    },
  };
  await assert.rejects(() => readBodyWithLimit(res, 50), (err) => err.code === "file_too_large");
}

{
  const chunks = [Buffer.from("hello"), Buffer.from(" world")];
  let i = 0;
  const res = {
    headers: { get: () => null },
    body: {
      getReader() {
        return {
          async read() {
            if (i >= chunks.length) return { done: true, value: undefined };
            const value = chunks[i++];
            return { done: false, value };
          },
          async cancel() {},
        };
      },
    },
  };
  const buf = await readBodyWithLimit(res, 100);
  assert.equal(buf.toString("utf8"), "hello world");
}

{
  const chunks = [Buffer.alloc(40), Buffer.alloc(40)];
  let i = 0;
  let cancelled = false;
  const res = {
    headers: { get: () => null },
    body: {
      getReader() {
        return {
          async read() {
            if (i >= chunks.length) return { done: true, value: undefined };
            const value = chunks[i++];
            return { done: false, value };
          },
          async cancel() {
            cancelled = true;
          },
        };
      },
    },
  };
  await assert.rejects(() => readBodyWithLimit(res, 50), (err) => err.code === "file_too_large");
  assert.equal(cancelled, true);
}

console.log("enviosAdjuntoFetch — redirect re-validation");

{
  const calls = [];
  const fetchImpl = async (href, init) => {
    calls.push({ href, redirect: init.redirect });
    if (calls.length === 1) {
      return {
        status: 302,
        headers: { get: (k) => (k === "location" ? "http://169.254.169.254/token" : null) },
        ok: false,
      };
    }
    assert.fail("must not follow forbidden redirect");
  };
  await assert.rejects(
    () => fetchAdjuntoUpstream("https://drive.google.com/uc?export=download&id=abc", { fetchImpl }),
    (err) => err.code === "url_https_required" || err.code === "url_host_forbidden",
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].redirect, "manual");
}

{
  const fetchImpl = async (href) => {
    if (href.includes("drive.google.com")) {
      return {
        status: 302,
        headers: {
          get: (k) =>
            k === "location" ? "https://doc-00-docs.googleusercontent.com/file.bin" : null,
        },
        body: { cancel: async () => {} },
        ok: false,
      };
    }
    return {
      status: 200,
      ok: true,
      headers: { get: (k) => (k === "content-type" ? "application/pdf" : null) },
      body: {
        getReader() {
          const once = Buffer.from("%PDF-1.4");
          let done = false;
          return {
            async read() {
              if (done) return { done: true };
              done = true;
              return { done: false, value: once };
            },
            async cancel() {},
          };
        },
      },
    };
  };
  const { upstream, fetchUrl } = await fetchAdjuntoUpstream(
    "https://drive.google.com/uc?export=download&id=abc",
    { fetchImpl },
  );
  assert.equal(upstream.status, 200);
  assert.ok(fetchUrl.includes("googleusercontent.com"));
}

// Live Drive shape (2026): /uc → 303 → drive.usercontent.google.com/download
{
  const cancelled = [];
  const fetchImpl = async (href) => {
    if (href.includes("drive.google.com/uc")) {
      return {
        status: 303,
        headers: {
          get: (k) =>
            k === "location"
              ? "https://drive.usercontent.google.com/download?id=abc&export=download"
              : null,
        },
        body: {
          cancel: async () => {
            cancelled.push(href);
          },
        },
        ok: false,
      };
    }
    assert.ok(
      href.startsWith("https://drive.usercontent.google.com/"),
      `expected Drive usercontent CDN, got ${href}`,
    );
    return {
      status: 200,
      ok: true,
      headers: { get: (k) => (k === "content-type" ? "application/pdf" : null) },
      body: {
        getReader() {
          const once = Buffer.from("%PDF-1.4");
          let done = false;
          return {
            async read() {
              if (done) return { done: true };
              done = true;
              return { done: false, value: once };
            },
            async cancel() {},
          };
        },
      },
    };
  };
  const { upstream, fetchUrl } = await fetchAdjuntoUpstream(
    "https://drive.google.com/uc?export=download&id=abc",
    { fetchImpl },
  );
  assert.equal(upstream.status, 200);
  assert.equal(fetchUrl, "https://drive.usercontent.google.com/download?id=abc&export=download");
  assert.equal(cancelled.length, 1, "redirect hop must cancel body");
}

console.log("OK enviosAdjuntoFetch.test.js");
