import {
  resolveWaAdminDatabaseUrl,
  createWaAdminPool,
} from "../scripts/wa-admin.mjs";

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

function assertThrows(name, fn, expectedMessagePart) {
  try {
    fn();
    assert(name, false, "no throw", `throws ${expectedMessagePart}`);
  } catch (error) {
    assert(
      name,
      String(error?.message || "").includes(expectedMessagePart),
      error?.message,
      `includes ${expectedMessagePart}`,
    );
  }
}

console.log("\n═══ WA Admin CLI · pool bootstrap regression ═══");

{
  const url = resolveWaAdminDatabaseUrl({
    DATABASE_URL: "postgres://primary/db",
    WA_DATABASE_URL: "postgres://fallback/db",
  });
  assert("prefers DATABASE_URL", url === "postgres://primary/db", url, "postgres://primary/db");
}

{
  const url = resolveWaAdminDatabaseUrl({
    WA_DATABASE_URL: "postgres://wa/db",
  });
  assert("falls back to WA_DATABASE_URL", url === "postgres://wa/db", url, "postgres://wa/db");
}

{
  const url = resolveWaAdminDatabaseUrl({});
  assert("returns null when no DB env exists", url === null, url, null);
}

{
  const calls = [];
  const sentinelPool = { end() {} };
  const pool = createWaAdminPool({
    env: { DATABASE_URL: "postgres://example/bmc" },
    getPool: (databaseUrl) => {
      calls.push(databaseUrl);
      return sentinelPool;
    },
  });

  assert("passes resolved DATABASE_URL into getWaPool", calls[0] === "postgres://example/bmc", calls, ["postgres://example/bmc"]);
  assert("returns initialized pool", pool === sentinelPool, pool, sentinelPool);
}

assertThrows(
  "fails fast when no DB env exists",
  () => createWaAdminPool({ env: {}, getPool: () => ({}) }),
  "DATABASE_URL not set",
);

assertThrows(
  "fails if getWaPool cannot initialize",
  () => createWaAdminPool({ env: { DATABASE_URL: "postgres://example/bmc" }, getPool: () => null }),
  "failed to initialize Postgres pool",
);

console.log(`\n${"═".repeat(60)}`);
console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
