#!/usr/bin/env node
/**
 * Panelin Signal — internal knowledge magazine (HTML).
 * Regenerates from docs/team/knowledge/*.json on each antenna run or via: npm run knowledge:magazine
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
import {
  asDateOnly,
  loadImpactMap,
  loadReferencesCatalog,
  loadRegistry,
  nowIso,
  paths,
} from "./knowledge-antenna-lib.mjs";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text, max = 220) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "—";
}

/**
 * @param {object} opts
 * @param {object} [opts.runSummary] - optional last-scan summary from run.mjs
 * @param {object[]} [opts.rankedTop] - optional top sources from rank step
 * @param {object[]} [opts.acceptedThisRun] - optional events accepted in this scan only
 */
export function buildKnowledgeMagazineHtml({
  generatedAt,
  issueDate,
  registry,
  refsCatalog,
  impactMap,
  runSummary = null,
  rankedTop = null,
  acceptedThisRun = [],
}) {
  const sources = [...(registry.sources || [])].sort(
    (a, b) => Number(b.rankScore || 0) - Number(a.rankScore || 0)
  );
  const topSources = (rankedTop && rankedTop.length ? rankedTop : sources).slice(0, 8);

  const refs = [...(refsCatalog.references || [])];
  refs.sort((a, b) => {
    const ta = new Date(b.lastSeenAt || b.publishedAt || 0).getTime();
    const tb = new Date(a.lastSeenAt || a.publishedAt || 0).getTime();
    return ta - tb;
  });
  const latestRefs = refs.slice(0, 14);

  const mappings = [...(impactMap.mappings || [])];
  const highImpact = mappings.filter((m) => m.priority === "high").slice(0, 8);
  const mediumImpact = mappings.filter((m) => m.priority === "medium").slice(0, 6);

  const refCount = refs.length;
  const mapCount = mappings.length;
  const highCount = mappings.filter((m) => m.priority === "high").length;
  const medCount = mappings.filter((m) => m.priority === "medium").length;
  const lowCount = mappings.filter((m) => m.priority === "low").length;
  const activeSources = (registry.sources || []).filter((s) => s.status === "active").length;

  const leadRef = latestRefs[0];
  const leadHtml = leadRef
    ? `
    <article class="lead">
      <p class="kicker">Lead reference</p>
      <h2><a href="${escapeHtml(leadRef.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(leadRef.title)}</a></h2>
      <p class="meta">${escapeHtml(leadRef.sourceId || "")} · ${formatDateShort(leadRef.publishedAt)}</p>
      <p class="deck">${escapeHtml(truncate(leadRef.summary, 320))}</p>
    </article>`
    : `<p class="muted">No references in catalog yet. Run a full knowledge scan to populate.</p>`;

  const dispatchItems =
    acceptedThisRun.length > 0
      ? acceptedThisRun.slice(0, 12)
      : latestRefs.slice(0, 10).map((r) => ({
          title: r.title,
          url: r.url,
          sourceName: r.sourceId,
          eventScore: null,
          summary: r.summary,
        }));

  const dispatchHtml = dispatchItems.length
    ? dispatchItems
        .map(
          (e) => `
      <li class="dispatch-item">
        <a class="dispatch-title" href="${escapeHtml(e.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(e.title)}</a>
        <span class="dispatch-meta">${escapeHtml(e.sourceName || "")}${e.eventScore != null ? ` · score ${e.eventScore}` : ""}</span>
        ${e.summary ? `<p class="dispatch-sum">${escapeHtml(truncate(e.summary, 160))}</p>` : ""}
      </li>`
        )
        .join("")
    : `<li class="muted">Nothing new to highlight this cycle.</li>`;

  const radarHtml = topSources
    .map(
      (s, i) => `
    <div class="radar-card">
      <span class="radar-rank">${i + 1}</span>
      <div>
        <strong>${escapeHtml(s.name)}</strong>
        <span class="badge">${escapeHtml(s.status || "active")}</span>
        <p class="radar-score">Rank ${Number(s.rankScore || 0).toFixed(3)}</p>
      </div>
    </div>`
    )
    .join("");

  const impactHighHtml = highImpact.length
    ? highImpact
        .map(
          (m) => `
    <div class="impact-card impact-high">
      <p class="impact-domain">${escapeHtml(m.domain)}</p>
      <p>${escapeHtml(m.recommendation || "")}</p>
      <p class="impact-targets">${escapeHtml((m.targets || []).slice(0, 4).join(" · "))}</p>
    </div>`
        )
        .join("")
    : `<p class="muted">No high-priority impact rows in the current window.</p>`;

  const impactMedHtml = mediumImpact.length
    ? mediumImpact
        .map(
          (m) => `
    <div class="impact-card impact-medium">
      <p class="impact-domain">${escapeHtml(m.domain)}</p>
      <p>${escapeHtml(truncate(m.recommendation, 180))}</p>
    </div>`
        )
        .join("")
    : "";

  const runStrip =
    runSummary && !runSummary.dryRun
      ? `
    <div class="run-strip">
      <span>Last scan · ${escapeHtml(runSummary.runDate || issueDate)}</span>
      <span>Sources ${runSummary.sourcesScanned ?? "—"}</span>
      <span>New refs +${runSummary.newReferences ?? 0}</span>
      <span>Accepted ${runSummary.acceptedEvents ?? 0}</span>
    </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Panelin Signal · ${escapeHtml(issueDate)}</title>
  <meta name="description" content="Internal research magazine — BMC Panelin Knowledge Antenna" />
  <style>
    :root {
      --ink: #0f172a;
      --muted: #64748b;
      --paper: #faf8f5;
      --card: #ffffff;
      --rule: #e2e8f0;
      --accent: #1a3a5c;
      --accent-hot: #0071e3;
      --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
      --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      color: var(--ink);
      background: var(--paper);
      line-height: 1.55;
      font-size: 1rem;
    }
    a { color: var(--accent-hot); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .wrap { max-width: 52rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    .masthead {
      border-bottom: 3px double var(--ink);
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    .masthead h1 {
      font-family: var(--serif);
      font-size: clamp(2rem, 5vw, 2.75rem);
      font-weight: 700;
      letter-spacing: 0.02em;
      margin: 0 0 0.25rem;
      color: var(--accent);
    }
    .masthead .tagline {
      font-size: 0.95rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .issue-line {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem 1.5rem;
      font-size: 0.85rem;
      color: var(--muted);
      margin-top: 0.75rem;
    }
    .run-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem 1.5rem;
      background: var(--card);
      border: 1px solid var(--rule);
      padding: 0.75rem 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat {
      background: var(--card);
      border: 1px solid var(--rule);
      padding: 1rem 1.1rem;
      text-align: center;
    }
    .stat .num { font-family: var(--serif); font-size: 1.75rem; color: var(--accent); }
    .stat .lbl { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
    section { margin-bottom: 2.5rem; }
    h2.section-title {
      font-family: var(--serif);
      font-size: 1.35rem;
      border-bottom: 1px solid var(--ink);
      padding-bottom: 0.35rem;
      margin-bottom: 1rem;
    }
    .lead .kicker {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent-hot);
      margin: 0 0 0.35rem;
    }
    .lead h2 { font-family: var(--serif); font-size: 1.5rem; margin: 0 0 0.5rem; line-height: 1.25; }
    .lead .meta { font-size: 0.85rem; color: var(--muted); margin: 0 0 0.75rem; }
    .lead .deck { font-size: 1.05rem; margin: 0; }
    .radar-grid { display: grid; gap: 0.65rem; }
    .radar-card {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      background: var(--card);
      border: 1px solid var(--rule);
      padding: 0.75rem 1rem;
    }
    .radar-rank {
      font-family: var(--serif);
      font-size: 1.25rem;
      color: var(--muted);
      min-width: 1.5rem;
    }
    .radar-score { font-size: 0.8rem; color: var(--muted); margin: 0.15rem 0 0; }
    .badge {
      display: inline-block;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: var(--rule);
      padding: 0.15rem 0.45rem;
      margin-left: 0.35rem;
      border-radius: 2px;
    }
    ul.dispatch { list-style: none; padding: 0; margin: 0; }
    .dispatch-item { padding: 0.85rem 0; border-bottom: 1px solid var(--rule); }
    .dispatch-title { font-weight: 600; display: block; margin-bottom: 0.2rem; }
    .dispatch-meta { font-size: 0.8rem; color: var(--muted); }
    .dispatch-sum { font-size: 0.9rem; color: var(--muted); margin: 0.35rem 0 0; }
    .impact-card {
      background: var(--card);
      border: 1px solid var(--rule);
      padding: 1rem;
      margin-bottom: 0.75rem;
    }
    .impact-high { border-left: 4px solid #b45309; }
    .impact-medium { border-left: 4px solid var(--accent-hot); }
    .impact-domain { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 0 0 0.35rem; }
    .impact-targets { font-size: 0.8rem; color: var(--muted); margin: 0.5rem 0 0; font-family: ui-monospace, monospace; }
    .muted { color: var(--muted); }
    footer.mag-footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--rule);
      font-size: 0.8rem;
      color: var(--muted);
    }
    footer.mag-footer code { font-size: 0.75rem; background: var(--rule); padding: 0.1rem 0.35rem; }
    @media print {
      body { background: #fff; }
      .run-strip { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="masthead">
      <p class="tagline">BMC Uruguay · Panelin</p>
      <h1>Panelin Signal</h1>
      <p class="muted" style="margin:0;font-size:1rem;">Revista interna de investigación y ecosistema (Knowledge Antenna)</p>
      <div class="issue-line">
        <span><strong>Issue</strong> ${escapeHtml(issueDate)}</span>
        <span><strong>Generated</strong> ${escapeHtml(generatedAt)}</span>
        <span><strong>Impact map</strong> ${formatDateShort(impactMap.updatedAt)}</span>
        <span><strong>Registry</strong> ${formatDateShort(registry.updatedAt)}</span>
      </div>
    </header>

    ${runStrip}

    <div class="stats">
      <div class="stat"><div class="num">${refCount}</div><div class="lbl">References</div></div>
      <div class="stat"><div class="num">${mapCount}</div><div class="lbl">Impact mappings</div></div>
      <div class="stat"><div class="num">${highCount}</div><div class="lbl">High priority</div></div>
      <div class="stat"><div class="num">${activeSources}</div><div class="lbl">Active sources</div></div>
    </div>

    <section aria-labelledby="lead">
      <h2 id="lead" class="section-title">Portada</h2>
      ${leadHtml}
    </section>

    <section aria-labelledby="radar">
      <h2 id="radar" class="section-title">Radar de fuentes</h2>
      <p class="muted" style="margin-top:-0.5rem;margin-bottom:1rem;">Orden por ranking compuesto del agente. Actualiza al regenerar el magazine.</p>
      <div class="radar-grid">${radarHtml}</div>
    </section>

    <section aria-labelledby="dispatch">
      <h2 id="dispatch" class="section-title">Despacho</h2>
      <p class="muted" style="margin-top:-0.5rem;margin-bottom:1rem;">
        ${acceptedThisRun.length ? "Novedades aceptadas en el último escaneo." : "Referencias más recientes del catálogo."}
      </p>
      <ul class="dispatch">${dispatchHtml}</ul>
    </section>

    <section aria-labelledby="impact">
      <h2 id="impact" class="section-title">Impacto en el repo</h2>
      <p class="muted" style="margin-top:-0.5rem;margin-bottom:1rem;">Muestra prioridad alta y una muestra media (${medCount} medias en total, ${lowCount} bajas).</p>
      ${impactHighHtml}
      ${impactMedHtml}
    </section>

    <footer class="mag-footer">
      <p><strong>Uso interno.</strong> Los datos viven en JSON bajo <code>docs/team/knowledge/</code>. Para una futura edición pública, filtrar fuentes y redactar resúmenes editoriales aparte.</p>
      <p>Regenerar solo el magazine (sin escanear red): <code>npm run knowledge:magazine</code></p>
      <p>Pipeline completo: <code>npm run knowledge:run</code></p>
    </footer>
  </div>
</body>
</html>`;
}

export async function generateKnowledgeMagazine(options = {}) {
  const {
    runSummary = null,
    rankedTop = null,
    acceptedThisRun = [],
    silent = false,
  } = options;

  const registry = await loadRegistry();
  const refsCatalog = await loadReferencesCatalog();
  const impactMap = await loadImpactMap();
  const generatedAt = nowIso();
  const issueDate = asDateOnly();

  const html = buildKnowledgeMagazineHtml({
    generatedAt,
    issueDate,
    registry,
    refsCatalog,
    impactMap,
    runSummary,
    rankedTop,
    acceptedThisRun,
  });

  const latestPath = path.join(paths.reportsDir, "KNOWLEDGE-MAGAZINE-latest.html");
  const datedPath = path.join(paths.reportsDir, `KNOWLEDGE-MAGAZINE-${issueDate}.html`);

  await fs.mkdir(paths.reportsDir, { recursive: true });
  await fs.writeFile(latestPath, html, "utf8");
  await fs.writeFile(datedPath, html, "utf8");

  const relLatest = path.relative(paths.repoRoot, latestPath);
  const relDated = path.relative(paths.repoRoot, datedPath);

  if (!silent) {
    console.log(JSON.stringify({ ok: true, latest: relLatest, dated: relDated }, null, 2));
  }
  return { ok: true, latestPath, datedPath, relLatest, relDated };
}

async function main() {
  await generateKnowledgeMagazine({ silent: false });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  main().catch((e) => {
    console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
    process.exit(1);
  });
}
