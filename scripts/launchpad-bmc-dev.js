#!/usr/bin/env node
/**
 * Launchpad X → BMC Dev Commands
 * Listens to Novation Launchpad X MIDI input and runs project commands.
 *
 * Usage:
 *   npm run launchpad              → run with default mapping
 *   npm run launchpad -- --learn   → learn mode (print note numbers when you press pads)
 *
 * Requires: npm install easymidi
 * Launchpad X must be connected via USB.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Pad note → command. Mapped from learn mode (your Launchpad X Note/Chromatic layout).
// Run with --learn to see pad note numbers.
const PAD_MAP = {
  // Row 2 (notes 37-40)
  37: { cmd: "npm", args: ["run", "build"], label: "build" },
  38: { cmd: "npm", args: ["run", "start:api"], label: "start:api" },
  40: { cmd: "npm", args: ["run", "bmc-dashboard"], label: "bmc-dashboard" },

  // Row 3 (notes 42-50)
  42: { cmd: "npm", args: ["run", "dev"], label: "dev (Vite)" },
  43: { cmd: "npm", args: ["run", "dev:full"], label: "dev:full" },
  45: { cmd: "npm", args: ["run", "test:contracts"], label: "test:contracts" },
  49: { cmd: "npm", args: ["run", "map-all-sheets"], label: "map-all-sheets" },
  50: { cmd: "npm", args: ["run", "go-live"], label: "go-live" },

  // Row 4 (notes 52-57)
  52: { cmd: "git", args: ["status"], label: "git status" },
  54: { cmd: "git", args: ["pull"], label: "git pull" },
  55: { cmd: "git", args: ["diff", "--stat"], label: "git diff" },
  57: { cmd: "npm", args: ["run", "lint"], label: "lint" },

  // Row 5 (notes 61-69)
  61: { cmd: "npm", args: ["run", "test"], label: "test" },
  62: { cmd: "open", args: ["http://localhost:3001/finanzas"], label: "open dashboard" },
  64: { cmd: "open", args: ["http://localhost:5173"], label: "open Vite" },
  66: { cmd: "open", args: ["http://localhost:3849"], label: "open standalone" },
  67: { cmd: "open", args: ["http://localhost:3001/health"], label: "open health" },
  69: { cmd: "npm", args: ["run", "verify-tabs"], label: "verify-tabs" },
};

function runCommand(config) {
  const { cmd, args, label } = config;
  console.log(`\n▶ ${label} (${cmd} ${args.join(" ")})`);
  const child = spawn(cmd, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    shell: true,
  });
  child.on("error", (err) => console.error("Error:", err.message));
}

async function main() {
  const learnMode = process.argv.includes("--learn");

  let easymidi;
  try {
    easymidi = await import("easymidi");
  } catch (e) {
    console.error("Missing easymidi. Install with: npm install easymidi");
    process.exit(1);
  }

  const inputs = easymidi.getInputs();
  const launchpadName = inputs.find((n) => /launchpad/i.test(n)) || inputs[0];

  if (!launchpadName) {
    console.error("No MIDI input found. Connect Launchpad X via USB.");
    console.error("Available:", inputs.length ? inputs.join(", ") : "none");
    process.exit(1);
  }

  console.log(`Using MIDI input: ${launchpadName}`);
  if (learnMode) {
    console.log("LEARN MODE — press pads to see note numbers. Ctrl+C to exit.\n");
  } else {
    console.log("Press pads to run commands. Ctrl+C to exit.\n");
  }

  const input = new easymidi.Input(launchpadName);

  input.on("noteon", (msg) => {
    if (msg.velocity === 0) return; // noteoff as noteon vel 0
    const note = msg.note;

    if (learnMode) {
      console.log(`Pad pressed: note=${note}`);
      return;
    }

    const config = PAD_MAP[note];
    if (config) {
      runCommand(config);
    } else {
      console.log(`Pad ${note} — no mapping (add to PAD_MAP in script)`);
    }
  });

  input.on("error", (err) => {
    console.error("MIDI error:", err);
  });

  process.on("SIGINT", () => {
    input.close();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
