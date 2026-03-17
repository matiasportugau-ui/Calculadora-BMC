#!/usr/bin/env node
/**
 * BMC Dev Launcher — Hot key launcher UI
 * Serves a launcher interface. Commands run ONLY when user clicks.
 * Launchpad pads highlight options (no execution on pad press).
 *
 * Usage: npm run launchpad
 * Opens http://localhost:3877
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

// Pad note → command id (for Launchpad highlight)
const NOTE_TO_ID = {
  37: "build", 38: "start-api", 40: "bmc-dashboard", 42: "dev", 43: "dev-full",
  45: "test-contracts", 49: "map-all-sheets", 50: null, 52: "git-status",
  54: "git-pull", 55: "git-diff", 57: "lint", 61: "test", 62: "open-dashboard",
  64: "open-vite", 66: null, 67: "open-health", 69: "verify-tabs",
};

let sseClients = [];
let lastPad = null;

function runCommand(id) {
  const c = COMMANDS.find((x) => x.id === id);
  if (!c) return;
  console.log(`▶ ${c.label}`);
  const child = spawn(c.cmd, c.args, { cwd: PROJECT_ROOT, stdio: "inherit", shell: true });
  child.on("error", (err) => console.error("Error:", err.message));
}

function broadcastPad(note) {
  lastPad = note;
  const id = NOTE_TO_ID[note];
  const msg = JSON.stringify({ type: "pad", note, id }) + "\n";
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
  <p style="color:#71717a;font-size:0.85rem;margin:0 0 1rem;">Click para ejecutar. Los pads del Launchpad solo resaltan.</p>
  <div id="app"></div>
  <script>
    const commands = ${JSON.stringify(COMMANDS)};
    const noteToId = ${JSON.stringify(NOTE_TO_ID)};
    const idToNote = {};
    for (const [n, id] of Object.entries(noteToId)) if (id) idToNote[id] = n;

    const tiers = [...new Set(commands.map(c => c.tier))];
    const app = document.getElementById("app");

    tiers.forEach(tier => {
      const div = document.createElement("div");
      div.className = "tier";
      div.innerHTML = "<h2>" + tier + "</h2>";
      const grid = document.createElement("div");
      grid.className = "grid";
      commands.filter(c => c.tier === tier).forEach(c => {
        const btn = document.createElement("button");
        btn.dataset.id = c.id;
        btn.textContent = c.label;
        const note = idToNote[c.id];
        if (note) { const span = document.createElement("span"); span.className = "pad-hint"; span.textContent = "pad " + note; btn.appendChild(span); }
        btn.onclick = () => fetch("/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
        grid.appendChild(btn);
      });
      div.appendChild(grid);
      app.appendChild(div);
    });

    const ev = new EventSource("/events");
    ev.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === "pad" && d.id) {
        document.querySelectorAll("button.highlight").forEach(b => b.classList.remove("highlight"));
        const btn = document.querySelector("[data-id=" + d.id + "]");
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

server.listen(PORT, () => {
  console.log(`BMC Dev Launcher → http://localhost:${PORT}`);
  try {
    execSync(`open http://localhost:${PORT}`, { stdio: "ignore" });
  } catch (_) {}
});

export { broadcastPad };