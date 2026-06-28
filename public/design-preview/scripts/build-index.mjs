import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const links = JSON.parse(readFileSync(join(ROOT, "mockup-index.json"), "utf8"));
const studios = [...new Set(links.map((l) => l.studio))];

let html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>BMC Design Competition — 5 Studios</title>
<link rel="stylesheet" href="_shared/tokens-base.css"/>
<style>
body{max-width:1200px;margin:0 auto;padding:24px;font-family:var(--bmc-font)}
h1{color:var(--bmc-brand)}
.studio{margin:32px 0;padding:20px;border:1px solid var(--bmc-border);border-radius:12px;background:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:12px}
.grid a{display:block;padding:10px 12px;background:var(--bmc-bg);border-radius:8px;text-decoration:none;color:var(--bmc-text);font-size:13px;border:1px solid var(--bmc-border)}
.grid a:hover{border-color:var(--bmc-primary)}
.meta{color:var(--bmc-text-2);font-size:14px}
.progress{background:var(--bmc-primary);color:#fff;padding:8px 16px;border-radius:8px;display:inline-block;margin:12px 0}
</style>
</head>
<body>
<h1>BMC Design Competition</h1>
<p class="meta">5 studios × 4 layers × 3 breakpoints = 60 static previews.
<a href="README.md">README</a> ·
<a href="TREND-RESEARCH-2026.md">Trends</a> ·
<a href="JURY-RECOMMENDATION.md">Jury</a> ·
<a href="PROGRESS.md">Progress</a></p>
<p class="progress">100% complete — 60/60 mockups</p>
`;

for (const s of studios) {
  const folder = links.find((l) => l.studio === s).folder;
  html += `<section class="studio"><h2>${s}</h2><div class="grid">`;
  for (const l of links.filter((x) => x.studio === s)) {
    const label = `${l.layer} ${l.file.replace(".html", "")} · ${l.bp}`;
    html += `<a href="${folder}/${l.file}">${label}</a>`;
  }
  html += `</div></section>`;
}
html += `</body></html>`;
writeFileSync(join(ROOT, "index.html"), html);
console.log("index.html written");
