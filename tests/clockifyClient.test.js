// Unit tests for server/lib/clockifyClient.js — verifies the X-Api-Key auth
// header, users/projects pagination, detailed-report POST + body, retry on
// 5xx, and the missing-config guard. Mocks global.fetch (no network).
//
// Run: node tests/clockifyClient.test.js

import { createClockifyClient } from "../server/lib/clockifyClient.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

const config = {
  clockifyApiKey: "test-key",
  clockifyWorkspaceId: "ws123",
  clockifyApiBase: "https://api.clockify.me/api/v1",
  clockifyReportsBase: "https://reports.api.clockify.me/v1",
  requestTimeoutMs: 5000,
  maxRetries: 2,
};

const ORIGINAL_FETCH = global.fetch;
let calls = [];
function mockFetch(responses) {
  let i = 0;
  global.fetch = async (url, init) => {
    calls.push({ url: url.toString(), init });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => (r.body == null ? "" : JSON.stringify(r.body)),
    };
  };
}

const client = createClockifyClient({ config });

// 1) Auth header + users pagination (200-item full page → fetch next).
calls = [];
mockFetch([
  {
    status: 200,
    body: Array.from({ length: 200 }, (_, k) => ({
      id: `u${k}`,
      email: `u${k}@x.com`,
      name: `U${k}`,
      status: "ACTIVE",
    })),
  },
  { status: 200, body: [{ id: "u200", email: "u200@x.com", name: "U200", status: "ACTIVE" }] },
  { status: 200, body: [] },
]);
const users = await client.getUsers();
assert(users.length === 201, "getUsers paginates (201 users across pages)");
assert(calls[0].init.headers["X-Api-Key"] === "test-key", "sends X-Api-Key header");
assert(calls[0].url.includes("/workspaces/ws123/users"), "hits the workspace users endpoint");

// 2) Detailed report POST + body mapping.
calls = [];
mockFetch([
  {
    status: 200,
    body: {
      timeentries: [
        {
          _id: "e1",
          userId: "u1",
          projectId: "p1",
          description: "work",
          timeInterval: { start: "2026-06-01T10:00:00Z", end: "2026-06-01T11:30:00Z" },
          billable: true,
          tags: [{ name: "obra" }],
        },
      ],
    },
  },
]);
const entries = await client.getDetailedEntries({
  startISO: "2026-06-01T00:00:00Z",
  endISO: "2026-06-30T00:00:00Z",
});
assert(entries.length === 1, "detailed report returns timeentries");
assert(calls[0].init.method === "POST", "detailed report uses POST");
assert(
  calls[0].url.startsWith("https://reports.api.clockify.me"),
  "detailed report hits the reports host",
);
const sentBody = JSON.parse(calls[0].init.body);
assert(sentBody.dateRangeStart === "2026-06-01T00:00:00Z", "detailed report passes dateRangeStart");

// 3) Retry on 5xx then success.
calls = [];
mockFetch([
  { status: 503, body: { message: "busy" } },
  { status: 200, body: [] },
]);
const projects = await client.getProjects();
assert(Array.isArray(projects), "getProjects returns array after a retry");
assert(calls.length === 2, "retried once after 503");

// 4) Missing config → 500.
let threw = false;
try {
  createClockifyClient({ config: { ...config, clockifyApiKey: "" } }).assertConfig();
} catch (e) {
  threw = e.status === 500;
}
assert(threw, "assertConfig throws 500 when CLOCKIFY_API_KEY missing");

global.fetch = ORIGINAL_FETCH;
console.log(`\nclockifyClient: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
