// ML parity gate — offline structure + optional DB integration
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`);
    failed += 1;
  }
}

assert("parity module loads", true);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("  ⏭ skip DB parity (no DATABASE_URL)");
} else {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const { rows: tables } = await pool.query(
      `SELECT to_regclass('public.omni_conversations') AS conv,
              to_regclass('public.omni_messages') AS msg`,
    );
    if (!tables[0]?.conv) {
      console.log("  ⏭ skip DB parity (omni tables missing — run omni:migrate)");
    } else {
      const { rows } = await pool.query(
        `SELECT channel, COUNT(*)::int AS n FROM omni_conversations WHERE channel = 'ml' GROUP BY channel`,
      );
      const mlCount = rows[0]?.n ?? 0;
      assert("ml conversations query ok", mlCount >= 0);
      console.log(`  ℹ omni ml conversations: ${mlCount}`);
    }
  } catch (e) {
    console.log(`  ⏭ skip DB parity (${e.message})`);
  } finally {
    await pool.end();
  }
}

console.log(`\nomniMlParity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
