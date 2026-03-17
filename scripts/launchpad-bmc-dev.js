#!/usr/bin/env node
/**
 * BMC Dev Launcher — Hot key launcher
 * Muestra opciones en la UI. Los pads del Launchpad solo resaltan (no ejecutan).
 * Ejecución solo al hacer click en la interfaz.
 *
 * Usage:
 *   npm run launchpad              → abre launcher en http://localhost:3877
 *   npm run launchpad -- --learn   → learn mode (ver números de pad)
 */
import { createServer } from "node:http";
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PORT = 3877;

const COMMANDS = [
  { id: "dev-full", label: "dev:full", cmd: "npm", args: ["run", "dev:full"], tier: "Arrancar" },
  { id: "dev", label: "dev (Vite)", cmd: "npm", args: ["run", "dev"], tier: "Arrancar" },
  { id: "start-api", label: "start:api", cmd: "npm", args: ["run", "start:api"], tier: "Arrancar" },
  { id: "build", label: "build", cmd: "npm", args: ["run", "build"], tier: "Arrancar" },
  { id: "open-vite", label: "open Vite", cmd: "open", args: ["http://localhost:5173"], tier: "Abrir" },
  { id: "open-dashboard", label: "open dashboard", cmd: "open", args: ["http://localhost:3001/finanzas"], tier: "Abrir" },
  { id: "open-health", label: "open health", cmd: "open", args: ["http://localhost:3001/health"], tier: "Abrir" },
  { id: "lint", label: "lint", cmd: "npm", args: ["run", "lint"], tier: "Calidad" },
  { id: "test", label: "test", cmd: "npm", args: ["run", "test"], tier: "Calidad" },
  { id: "test-contracts", label: "test:contracts", cmd: "npm", args: ["run", "test:contracts"], tier: "Calidad" },
  { id: "git-status", label: "git status", cmd: "git", args: ["status"], tier: "Git" },
  { id: "git-diff", label: "git diff", cmd: "git", args: ["diff", "--stat"], tier: "Git" },
  { id: "git-pull", label: "git pull", cmd: "git", args: ["pull"], tier: "Git" },
  { id: "bmc-dashboard", label: "bmc-dashboard", cmd: "npm", args: ["run", "bmc-dashboard"], tier: "Sheets" },
  { id: "map-all-sheets", label: "map-all-sheets", cmd: "npm", args: ["run", "map-all-sheets"], tier: "Sheets" },
  { id: "verify-tabs", label: "verify-tabs", cmd: "npm", args: ["run", "verify-tabs"], tier: "Sheets" },
];

const NOTE_TO_ID = {
  37: "build", 38: "start-api", 40: "bmc-dashboard", 42: "dev", 43: "dev-full",
  45: "test-contracts", 49: "map-all-sheets", 52: "git-status", 54: "git-pull",
  55: "git-diff", 57: "lint", 61: "test", 62: "open-dashboard", 64: "open-vite",
  67: "open-health", 69: "verify-tabs",
};

let sseClients = [];

function runCommand(id) {
  const c = COMMANDS.find((x) => x.id === id);
  if (!c) return;
  console.log(`▶ ${c.label}`);
  const child = spawn(c.cmd, c.args, { cwd: PROJECT_ROOT, stdio: "inherit", shell: true });
  child.on("error", (err) => console.error("Error:", err.message));
}

function broadcastPad(note) {
  const id = NOTE_TO_ID[note];
  if (!id) return;
  const msg = JSON.stringify({ type: "pad", note, id });
  sseClients.forEach((res) => res.write(`data: ${msg}\n\n`));
}

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BMC Dev Launcher</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f0f12;
      color: #e4e4e7;
      margin: 0;
      padding: 1.5rem;
      min-height: 100vh;
    }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; color: #a1a1aa; }
    .tier { margin-bottom: 1.5rem; }
    .tier h2 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin: 0 0 0.5rem; }
    .grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    button {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      padding: 0.6rem 1rem;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    button:hover { background: #3f3f46; border-color: #52525b; }
    button.highlight { background: #3b82f6; border-color: #60a5fa; }
    .pad-hint { font-size: 0.7rem; color: #71717a; margin-left: 0.5rem; }
  </style>
</head>
<body>
  <h1>BMC Dev Launcher</h1>
  <p style="color:#71717a;font-size:0.85rem;margin:0 0 1rem;">Tecla 1-9, 0 o click para ejecutar. Los pads del Launchpad solo resaltan (no ejecutan).</p>
  <div id="app"></div>
  <script>
    const commands = ${JSON.stringify(COMMANDS)};
    const noteToId = ${JSON.stringify(NOTE_TO_ID)};
    const idToNote = {};
    for (const [n, id] of Object.entries(noteToId)) if (id) idToNote[id] = n;

    const flat = commands;
    const tiers = [...new Set(commands.map(c => c.tier))];
    const app = document.getElementById("app");

    function run(id) {
      fetch("/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    }

    tiers.forEach(tier => {
      const div = document.createElement("div");
      div.className = "tier";
      div.innerHTML = "<h2>" + tier + "</h2>";
      const grid = document.createElement("div");
      grid.className = "grid";
      commands.filter(c => c.tier === tier).forEach((c, i) => {
        const idx = flat.indexOf(c);
        const key = idx < 9 ? String(idx + 1) : idx === 9 ? "0" : null;
        const btn = document.createElement("button");
        btn.dataset.id = c.id;
        btn.innerHTML = c.label + (key ? '<span class="pad-hint">' + key + '</span>' : '');
        const note = idToNote[c.id];
        if (note) { const span = document.createElement("span"); span.className = "pad-hint"; span.textContent = "pad " + note; btn.appendChild(span); }
        btn.onclick = () => run(c.id);
        grid.appendChild(btn);
      });
      div.appendChild(grid);
      app.appendChild(div);
    });

    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const idx = e.key === "0" ? 9 : parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < flat.length) run(flat[idx].id);
    });

    const ev = new EventSource("/events");
    ev.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === "pad" && d.id) {
        document.querySelectorAll("button.highlight").forEach(b => b.classList.remove("highlight"));
        const btn = document.querySelector("[data-id='" + d.id + "']");
        if (btn) btn.classList.add("highlight");
      }
    };
  </script>
</body>
</html>`;

const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML);
    return;
  }
  if (req.url === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    sseClients.push(res);
    req.on("close", () => { sseClients = sseClients.filter((r) => r !== res); });
    return;
  }
  if (req.method === "POST" && req.url === "/run") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { id } = JSON.parse(body);
        runCommand(id);
      } catch (_) {}
      res.writeHead(200);
      res.end();
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

async function main() {
  const learnMode = process.argv.includes("--learn");

  server.listen(PORT, () => {
    console.log(`BMC Dev Launcher → http://localhost:${PORT}`);
    if (!learnMode) {
      try {
        execSync(`open http://localhost:${PORT}`, { stdio: "ignore" });
      } catch (_) {}
    }
  });

  if (learnMode) {
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
      process.exit(1);
    }
    const input = new easymidi.Input(launchpadName);
    console.log("LEARN MODE — press pads to see note numbers. Ctrl+C to exit.\n");
    input.on("noteon", (msg) => {
      if (msg.velocity === 0) return;
      console.log(`Pad pressed: note=${msg.note}`);
    });
    process.on("SIGINT", () => { input.close(); process.exit(0); });
    return;
  }

  let easymidi;
  try {
    easymidi = await import("easymidi");
  } catch (_) {
    console.log("(Launchpad opcional: npm install easymidi para resaltar con pads)\n");
    return;
  }

  const inputs = easymidi.getInputs();
  const launchpadName = inputs.find((n) => /launchpad/i.test(n)) || inputs[0];
  if (!launchpadName) {
    console.log("(Launchpad no detectado. Launcher funciona igual — click para ejecutar)\n");
    return;
  }

  const input = new easymidi.Input(launchpadName);
  console.log(`Launchpad: ${launchpadName} — pads resaltan, click para ejecutar\n`);

  input.on("noteon", (msg) => {
    if (msg.velocity === 0) return;
    broadcastPad(msg.note);
  });

  input.on("error", (err) => console.error("MIDI error:", err));

  process.on("SIGINT", () => {
    input.close();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
