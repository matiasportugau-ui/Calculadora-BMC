/**
 * Bug AB — WA cockpit media display must use Bearer + signed URL, never ?key=token.
 */
import assert from "node:assert/strict";
import {
  buildWaMediaJsonUrl,
  resolveWaMediaSignedUrl,
} from "../src/utils/waCockpitMedia.js";

assert.equal(
  buildWaMediaJsonUrl("https://api.example", "/api/wa/media/msg%3A1"),
  "https://api.example/api/wa/media/msg%3A1?json=1",
);
assert.equal(
  buildWaMediaJsonUrl("https://api.example/", "https://api.example/api/wa/media/x?foo=1"),
  "https://api.example/api/wa/media/x?foo=1&json=1",
);
assert.equal(buildWaMediaJsonUrl("", null), null);

{
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      async json() {
        return { ok: true, url: "https://storage.googleapis.com/signed/abc" };
      },
    };
  };
  const url = await resolveWaMediaSignedUrl(
    "https://api.example",
    "/api/wa/media/m1",
    "eyJhbGciOiJIUzI1NiJ9.payload.sig",
    { fetchImpl },
  );
  assert.equal(url, "https://storage.googleapis.com/signed/abc");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example/api/wa/media/m1?json=1");
  assert.equal(
    calls[0].init.headers.Authorization,
    "Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig",
  );
  assert.ok(!String(calls[0].url).includes("key="), "must not put token in query");
}

{
  const url = await resolveWaMediaSignedUrl(
    "https://api.example",
    "/api/wa/media/m1",
    "tok",
    {
      fetchImpl: async () => ({
        ok: false,
        async json() {
          return { error: "Unauthorized" };
        },
      }),
    },
  );
  assert.equal(url, null);
}

{
  const url = await resolveWaMediaSignedUrl("https://api.example", "/api/wa/media/m1", "");
  assert.equal(url, null);
}

console.log("waCockpitMedia.test.js: OK");
