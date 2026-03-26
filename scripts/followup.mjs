#!/usr/bin/env node
/**
 * Follow-up CLI — same store as GET/POST /api/followups
 * Usage:
 *   node scripts/followup.mjs add "Title" [--due 2026-03-30] [--days 3] [--tag bmc]
 *   node scripts/followup.mjs list [--all]
 *   node scripts/followup.mjs due
 *   node scripts/followup.mjs done <id>
 *   node scripts/followup.mjs snooze <id> [--days 1] [--due ISO]
 *   node scripts/followup.mjs note <id> "text"
 *   node scripts/followup.mjs delete <id>
 */
import {
  loadStore,
  saveStore,
  addItem,
  findItem,
  appendNote,
  markDone,
  snoozeItem,
  deleteItem,
  listDueItems,
  sortByFollowUp,
  parseDueInput,
  parseDays,
} from "../server/lib/followUpStore.js";

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--due" || a === "-d") {
      out.flags.due = argv[++i];
    } else if (a === "--days") {
      out.flags.days = argv[++i];
    } else if (a === "--tag" || a === "-t") {
      out.flags.tag = argv[++i];
    } else if (a === "--all") {
      out.flags.all = true;
    } else if (a === "--json") {
      out.flags.json = true;
    } else if (!a.startsWith("-")) {
      out._.push(a);
    }
  }
  return out;
}

function printItem(it) {
  const due = it.nextFollowUpAt ? it.nextFollowUpAt.slice(0, 10) : "—";
  const tags = it.tags?.length ? ` [${it.tags.join(", ")}]` : "";
  console.log(`${it.id}\t${due}\t${it.title}${tags}`);
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = argv.slice(1);
  const { _, flags } = parseArgs(rest);

  if (!cmd || cmd === "help" || cmd === "-h") {
    console.log(`Follow-up tracker (local store + API /api/followups)

Commands:
  add <title> [--due ISO] [--days N] [--tag name]
  list [--all] [--json]
  due [--json]
  done <id>
  snooze <id> [--days N] [--due ISO]
  note <id> <text...>
  delete <id>
`);
    process.exit(0);
  }

  const store = loadStore();

  if (cmd === "add") {
    const title = _.join(" ").trim();
    if (!title) {
      console.error("Usage: followup add <title> [--due ISO] [--days N]");
      process.exit(1);
    }
    let due = flags.due ? parseDueInput(flags.due) : null;
    if (!due && flags.days != null) due = parseDays(flags.days);
    const tags = flags.tag ? [flags.tag] : [];
    const item = addItem(store, { title, tags, nextFollowUpAt: due });
    saveStore(store);
    console.log(flags.json ? JSON.stringify({ ok: true, item }, null, 2) : `Created ${item.id}`);
    return;
  }

  if (cmd === "list") {
    let items = store.items.filter((i) => (flags.all ? true : i.status === "open"));
    items = sortByFollowUp(items);
    if (flags.json) {
      console.log(JSON.stringify({ ok: true, items }, null, 2));
      return;
    }
    for (const it of items) printItem(it);
    console.log(`\n${items.length} item(s)`);
    return;
  }

  if (cmd === "due") {
    const open = store.items.filter((i) => i.status === "open");
    const due = listDueItems(open);
    if (flags.json) {
      console.log(JSON.stringify({ ok: true, items: due }, null, 2));
      return;
    }
    if (!due.length) {
      console.log("No follow-ups due (open items may be snoozed to the future).");
      return;
    }
    for (const it of sortByFollowUp(due)) printItem(it);
    console.log(`\n${due.length} due`);
    return;
  }

  if (cmd === "done") {
    const id = _[0];
    if (!id) {
      console.error("Usage: followup done <id>");
      process.exit(1);
    }
    const item = markDone(store, id);
    if (!item) {
      console.error("Not found");
      process.exit(1);
    }
    saveStore(store);
    console.log(`Done ${id}`);
    return;
  }

  if (cmd === "snooze") {
    const id = _[0];
    if (!id) {
      console.error("Usage: followup snooze <id> [--days N] [--due ISO]");
      process.exit(1);
    }
    let iso = flags.due ? parseDueInput(flags.due) : null;
    if (!iso && flags.days != null) iso = parseDays(flags.days);
    if (!iso) {
      console.error("Provide --days or --due");
      process.exit(1);
    }
    const item = snoozeItem(store, id, iso);
    if (!item) {
      console.error("Not found");
      process.exit(1);
    }
    saveStore(store);
    console.log(`Snoozed until ${iso}`);
    return;
  }

  if (cmd === "note") {
    const id = _[0];
    const text = _.slice(1).join(" ").trim();
    if (!id || !text) {
      console.error("Usage: followup note <id> <text>");
      process.exit(1);
    }
    const item = findItem(store, id);
    if (!item) {
      console.error("Not found");
      process.exit(1);
    }
    appendNote(item, text);
    saveStore(store);
    console.log("Note added");
    return;
  }

  if (cmd === "delete" || cmd === "rm") {
    const id = _[0];
    if (!id) {
      console.error("Usage: followup delete <id>");
      process.exit(1);
    }
    if (!deleteItem(store, id)) {
      console.error("Not found");
      process.exit(1);
    }
    saveStore(store);
    console.log(`Deleted ${id}`);
    return;
  }

  console.error(`Unknown command: ${cmd}. Try: followup help`);
  process.exit(1);
}

main();
