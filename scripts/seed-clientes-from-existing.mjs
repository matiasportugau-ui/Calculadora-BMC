#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/seed-clientes-from-existing.mjs
// ───────────────────────────────────────────────────────────────────────────
// One-shot seed for the Clientes 360 MVP (/hub/clientes).
//
// Strategy: this Supabase project's identity.quotes and wa.* tables are empty
// (real production quote/WA data lives in a separate DB, not yet mirrored).
// To hit the MVP goal of "≥30 customers visible", we:
//
//   1. PULL real identity.users (6 rows currently) and create 1 customer per
//      user where email/name are present. Tagged metadata.source='identity_users'.
//   2. GENERATE 25 synthetic demo customers with realistic UY profiles
//      (display_name, phone in E.164 UY format, RUT, scenarios). Tagged
//      metadata.source='synthetic_mvp_demo' so they can be purged later via:
//        DELETE FROM clientes.customers
//         WHERE metadata->>'source' = 'synthetic_mvp_demo';
//   3. For 12 of the customers, also create a 'pending' customer_quote and
//      a customer_event so the table has a mix of states to display.
//
// Idempotent: re-runs use ON CONFLICT DO NOTHING via unique (channel, external_id)
// on customer_identities. Re-running adds new synthetic customers only if the
// existing source='synthetic_mvp_demo' count is below the target.
//
// Run:
//   node scripts/seed-clientes-from-existing.mjs
//   node scripts/seed-clientes-from-existing.mjs --reset   # purge synthetic first
// ═══════════════════════════════════════════════════════════════════════════

import { Pool } from "pg";
import "dotenv/config";

const TARGET_SYNTHETIC = 25;
const TARGET_QUOTES = 12;

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL or SUPABASE_DB_URL must be set in .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const RESET = process.argv.includes("--reset");

// ─── Synthetic data generators (UY-aware) ─────────────────────────────────

const FIRST_NAMES = [
  "Pedro","Maria","Juan","Lucia","Carlos","Ana","Diego","Sofia","Rodrigo","Camila",
  "Martin","Florencia","Sebastian","Valentina","Andres","Romina","Federico","Daniela",
  "Pablo","Natalia","Mauricio","Veronica","Gonzalo","Paula",
];
const LAST_NAMES = [
  "Perez","Gonzalez","Rodriguez","Lopez","Fernandez","Sanchez","Diaz","Martinez",
  "Garcia","Ramirez","Silva","Torres","Acosta","Castro","Rivera","Romero","Vargas",
  "Morales","Ortiz","Suarez","Mendoza","Reyes","Cabrera","Pereira",
];
const COMPANIES = [
  "Construcciones BMC", "Metalog SAS", "Frigorificos del Sur", "Frio Total",
  "Camaras del Plata", "Aislantes Uruguay", "Panel Norte", "Constructora La Loma",
  "Bromyros SRL", "Galpones del Este", "Insulux", "Termopanel Plata",
];
const SCENARIOS = ["solo_techo", "techo_fachada", "solo_fachada", "camara_frig"];
const CHANNELS = ["wa", "calculadora", "ml", "shopify", "email"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generatePhoneE164UY() {
  // 598 + 9XXXXXXXX (UY mobile)
  return `5989${randInt(1, 9)}${String(randInt(100000, 999999)).padStart(6, "0")}`;
}

function generateRut() {
  // UY RUT = 12 digits
  return String(randInt(200000000000, 299999999999));
}

function generateDisplayName(useCompany = false) {
  if (useCompany) return pick(COMPANIES);
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function generateEmail(displayName) {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  const domain = pick(["gmail.com", "hotmail.com", "outlook.com", "adinet.com.uy", "vera.com.uy"]);
  return `${slug}${randInt(1, 99)}@${domain}`;
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000);
}

// ─── Seed steps ────────────────────────────────────────────────────────────

async function purgeSynthetic() {
  console.log("→ Purging existing synthetic customers...");
  const { rowCount } = await pool.query(
    `DELETE FROM clientes.customers WHERE metadata->>'source' = 'synthetic_mvp_demo'`,
  );
  console.log(`  Removed ${rowCount} synthetic customers`);
}

async function seedFromIdentityUsers() {
  console.log("→ Seeding from identity.users...");
  const { rows: users } = await pool.query(
    `SELECT user_id, email, name FROM identity.users
      WHERE status = 'active' AND email IS NOT NULL
      ORDER BY created_at`,
  );
  let created = 0;
  for (const u of users) {
    const displayName = (u.name || u.email.split("@")[0]).slice(0, 100);
    const { rows } = await pool.query(
      `INSERT INTO clientes.customers
         (display_name, primary_email, channels, first_seen_at, last_contact_at, metadata)
       VALUES ($1, $2, ARRAY['identity']::text[], now() - interval '30 days', now() - interval '${randInt(0, 14)} days',
               jsonb_build_object('source', 'identity_users', 'identity_user_id', $3::text))
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [displayName, String(u.email).toLowerCase(), u.user_id],
    );
    if (rows[0]) {
      await pool.query(
        `INSERT INTO clientes.customer_identities (customer_id, channel, external_id)
         VALUES ($1, 'identity', $2)
         ON CONFLICT (channel, external_id) DO NOTHING`,
        [rows[0].id, u.user_id],
      );
      created += 1;
    }
  }
  console.log(`  Created ${created} customers from identity.users`);
  return created;
}

async function countExisting() {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM clientes.customers`);
  return rows[0].n;
}

async function seedSynthetic(targetMore) {
  console.log(`→ Generating ${targetMore} synthetic MVP customers...`);
  let created = 0;
  for (let i = 0; i < targetMore; i += 1) {
    const useCompany = Math.random() < 0.4;
    const displayName = generateDisplayName(useCompany);
    const phone = generatePhoneE164UY();
    const email = Math.random() < 0.7 ? generateEmail(displayName) : null;
    const rut = useCompany || Math.random() < 0.3 ? generateRut() : null;
    const lastContactDaysAgo = randInt(0, 120);
    const channels = [pick(CHANNELS)];
    if (Math.random() < 0.4) channels.push(pick(CHANNELS.filter((c) => c !== channels[0])));

    const { rows } = await pool.query(
      `INSERT INTO clientes.customers
         (display_name, rut, primary_phone_e164, primary_email, channels,
          first_seen_at, last_contact_at, metadata)
       VALUES ($1, $2, $3, $4, $5::text[],
               $6, $7,
               jsonb_build_object('source', 'synthetic_mvp_demo', 'is_company', $8::boolean))
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        displayName, rut, phone, email, channels,
        daysAgo(randInt(30, 365)).toISOString(),
        daysAgo(lastContactDaysAgo).toISOString(),
        useCompany,
      ],
    );
    if (rows[0]) {
      // External id per channel
      for (const ch of channels) {
        await pool.query(
          `INSERT INTO clientes.customer_identities (customer_id, channel, external_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (channel, external_id) DO NOTHING`,
          [rows[0].id, ch, `${ch}-demo-${rows[0].id.slice(0, 8)}`],
        );
      }
      created += 1;
    }
  }
  console.log(`  Created ${created} synthetic customers`);
  return created;
}

async function seedQuotes() {
  console.log(`→ Adding pending quotes to ${TARGET_QUOTES} random customers...`);
  const { rows: customers } = await pool.query(
    `SELECT id FROM clientes.customers ORDER BY random() LIMIT $1`,
    [TARGET_QUOTES],
  );
  let created = 0;
  for (const c of customers) {
    const scenario = pick(SCENARIOS);
    const total = randInt(1500, 25000);
    const daysOld = randInt(1, 45);
    const status = Math.random() < 0.75 ? "pending" : Math.random() < 0.5 ? "won" : "lost";
    const closedAt = status !== "pending" ? daysAgo(randInt(0, daysOld)).toISOString() : null;
    const quoteId = `mvp-demo-${c.id.slice(0, 8)}-${Date.now()}-${created}`;
    await pool.query(
      `INSERT INTO clientes.customer_quotes
         (customer_id, quote_id, scenario, total_amount, currency, status, created_at, closed_at)
       VALUES ($1, $2, $3, $4, 'USD', $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [c.id, quoteId, scenario, total, status, daysAgo(daysOld).toISOString(), closedAt],
    );
    created += 1;
  }
  console.log(`  Created ${created} quotes`);
  return created;
}

async function seedEvents() {
  console.log("→ Adding a calculadora event per customer (so timeline has data)...");
  const { rows: customers } = await pool.query(
    `SELECT id, last_contact_at FROM clientes.customers ORDER BY last_contact_at DESC NULLS LAST LIMIT 30`,
  );
  let created = 0;
  for (const c of customers) {
    const eventAt = c.last_contact_at || new Date().toISOString();
    // source_ref must be unique per channel
    const sourceRef = `mvp-seed-${c.id.slice(0, 8)}-${created}`;
    try {
      await pool.query(
        `INSERT INTO clientes.customer_events
           (customer_id, channel, event_type, payload, occurred_at, source_ref)
         VALUES ($1, 'calculadora', 'login', '{"note":"mvp seed"}'::jsonb, $2, $3)
         ON CONFLICT DO NOTHING`,
        [c.id, eventAt, sourceRef],
      );
      created += 1;
    } catch (e) {
      // partition might not exist for very old dates — fall back to current month
      if (String(e.message).includes("no partition")) {
        await pool.query(
          `INSERT INTO clientes.customer_events
             (customer_id, channel, event_type, payload, occurred_at, source_ref)
           VALUES ($1, 'calculadora', 'login', '{"note":"mvp seed"}'::jsonb, now(), $2)
           ON CONFLICT DO NOTHING`,
          [c.id, sourceRef],
        );
        created += 1;
      } else {
        console.warn(`  Skipped event for ${c.id}: ${e.message}`);
      }
    }
  }
  console.log(`  Created ${created} events`);
}

async function main() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("Clientes 360 MVP — Seed Script");
  console.log("════════════════════════════════════════════════════════════");

  if (RESET) await purgeSynthetic();

  const baseCount = await countExisting();
  console.log(`Existing customers: ${baseCount}`);

  if (baseCount === 0) {
    await seedFromIdentityUsers();
  }
  const afterIdentity = await countExisting();
  const needed = Math.max(30, TARGET_SYNTHETIC + afterIdentity) - afterIdentity;
  if (needed > 0) await seedSynthetic(needed);

  await seedQuotes();
  await seedEvents();

  const final = await countExisting();
  console.log("════════════════════════════════════════════════════════════");
  console.log(`✅ Done. Total customers in clientes.customers: ${final}`);
  console.log("════════════════════════════════════════════════════════════");
  await pool.end();
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  console.error(e.stack);
  pool.end();
  process.exit(1);
});
