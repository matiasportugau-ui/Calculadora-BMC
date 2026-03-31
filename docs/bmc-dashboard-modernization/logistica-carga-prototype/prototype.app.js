import {
  COLORS,
  ESPS,
  LENS,
  MAX_H,
  MAX_OVH,
  MAX_P,
  ROW_W,
  TIPOS,
  TRUCK_W,
  buildPkgs,
  mapsUrlFromStop,
  mkAcc,
  mkPanel,
  mkStop,
  placeCargo,
  resetDefaultCargoIds,
  stopFromProximaRow,
} from "./lib/cargoEngine.js";
import { parseLogisticaFromAdjuntoText } from "./lib/adjuntoLineParse.js";
import {
  collectClienteNamesFromStop,
  findFirstStopByClienteLabel,
  normClienteKey,
  uniqueClientesFromStops,
} from "./lib/clienteFromSheet.js";
import { describePanelPackages, describeTruckPlacementOneStop } from "./lib/logisticaPackageInsight.js";
import { extractTextFromPdfArrayBuffer } from "./lib/pdfTextExtract.js";
import {
  SHEET_PASTE_PRESETS,
  classifyAdjuntoUrl,
  extractStopFieldsFromPaste,
} from "./lib/sheetPaste.js";

const STORAGE_KEY = "bmc-carga-ruta-v1";
const TRUCK_LEN_OPTS = [6, 7, 8, 9, 10, 12, 14];

const ISX = 25;
const ISY = 25;
const ISZ = 50;
const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;

function isoP(x, y, z, ox, oy) {
  return {
    px: ox + (x * C30 - y * C30) * ISX,
    py: oy + (x * S30 + y * S30) * ISY - z * ISZ,
  };
}

function fp(pts) {
  return pts.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(" ");
}

function shd(hex, f) {
  if (!hex || hex[0] !== "#") return "#888";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function envNo() {
  return `ENV-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-001`;
}

function newId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultInfo() {
  return {
    numero: envNo(),
    fecha: today(),
    transportista: "",
    patente: "",
    notas: "",
  };
}

/** @type {{ view: string, truckL: number, info: Record<string,string>, stops: any[], highlightStopId: string | null, pickedClienteLabel: string, scrollToStopOnce: string | null }} */
let state = {
  view: "form",
  truckL: 8,
  info: defaultInfo(),
  stops: [],
  highlightStopId: null,
  pickedClienteLabel: "",
  scrollToStopOnce: null,
};

function renumberStops() {
  state.stops = state.stops.map((s, i) => ({
    ...s,
    orden: i + 1,
    color: COLORS[i % COLORS.length],
  }));
}

function initState() {
  resetDefaultCargoIds();
  state.info = defaultInfo();
  state.truckL = 8;
  state.stops = [mkStop(1)];
  state.view = "form";
  state.highlightStopId = null;
  state.pickedClienteLabel = "";
  state.scrollToStopOnce = null;
}

function getCargo() {
  resetDefaultCargoIds();
  return placeCargo(state.stops, state.truckL);
}

function totPaneles() {
  return state.stops.reduce(
    (t, s) => t + s.paneles.reduce((tt, p) => tt + Number(p.cantidad || 0), 0),
    0
  );
}

function renderRulesBody() {
  const rows = Object.entries(MAX_P)
    .map(([k, v]) => `<tr><td>${esc(k)} mm</td><td>${esc(String(v))}</td></tr>`)
    .join("");
  return `
    <p><strong>Reglas operativas</strong></p>
    <ul>
      <li>Máximo <strong>2 filas</strong> paralelas (Fila A / B).</li>
      <li>Altura máxima de pila por fila: <strong>1,5 m</strong>.</li>
      <li>Saliente máximo respecto a carrocería: <strong>2 m</strong>.</li>
      <li><strong>Descarga:</strong> de arriba hacia abajo. <strong>Carga:</strong> orden inverso a entregas (última parada al fondo).</li>
      <li>Los paquetes <strong>no mezclan</strong> pedidos distintos; se fraccionan según tabla.</li>
    </ul>
    <p><strong>Leyenda en diagramas</strong></p>
    <ul>
      <li>Color = parada (cliente).</li>
      <li>Rojo = exceso de altura en esa fila.</li>
      <li>Ámbar rayado = saliente fuera de carrocería.</li>
    </ul>
    <table class="rules-table"><thead><tr><th>Espesor</th><th>Máx paneles / paquete</th></tr></thead><tbody>${rows}</tbody></table>
  `;
}

function renderHero() {
  const cargo = getCargo();
  const el = document.getElementById("heroMeta");
  if (!el) return;
  el.innerHTML = `
    <div><strong>${esc(state.info.numero)}</strong> · ${esc(state.info.fecha)}</div>
    <div style="margin-top:4px">${totPaneles()} pan. · ${cargo.placed.length} pkgs · ${state.stops.length} paradas</div>
  `;
}

function renderWarnings() {
  const cargo = getCargo();
  const box = document.getElementById("warnings");
  if (!box) return;
  box.innerHTML = cargo.warns
    .map((w) => `<div class="warn-banner" role="alert">${esc(w)}</div>`)
    .join("");
}

function renderTabs() {
  const el = document.getElementById("tabs");
  if (!el) return;
  const tabs = [
    ["form", "Formulario"],
    ["remito", "Remito"],
    ["carga", "Diagrama 3D"],
  ];
  el.innerHTML = tabs
    .map(
      ([v, l]) =>
        `<button type="button" class="tab${state.view === v ? " is-active" : ""}" data-view="${esc(v)}">${esc(l)}</button>`
    )
    .join("");
}

function renderTruckSelect() {
  const sel = document.getElementById("truckL");
  if (!sel) return;
  sel.innerHTML = TRUCK_LEN_OPTS.map(
    (l) => `<option value="${l}"${l === state.truckL ? " selected" : ""}>${l} m</option>`
  ).join("");
}

function escPickerValue(label) {
  return encodeURIComponent(label);
}

function decodePickerValue(enc) {
  if (!enc) return "";
  try {
    return decodeURIComponent(enc);
  } catch {
    return enc;
  }
}

function queryStopCardEl(sid) {
  const v = String(sid).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return document.querySelector(`[data-stop-card="${v}"]`);
}

function renderClientePlanillaPicker() {
  const sel = document.getElementById("clientePlanillaPicker");
  if (!sel) return;
  const names = uniqueClientesFromStops(state.stops);
  if (state.highlightStopId && !state.stops.some((s) => s.id === state.highlightStopId)) {
    state.highlightStopId = null;
  }
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = names.length ? "— Elegir cliente —" : "— Importá filas desde la planilla —";
  sel.appendChild(opt0);
  for (const n of names) {
    const o = document.createElement("option");
    o.value = escPickerValue(n);
    o.textContent = n;
    sel.appendChild(o);
  }
  let pick = state.pickedClienteLabel || "";
  if (pick && !names.some((x) => normClienteKey(x) === normClienteKey(pick))) {
    pick = "";
    state.pickedClienteLabel = "";
    state.highlightStopId = null;
  }
  if (pick) {
    const match = names.find((x) => normClienteKey(x) === normClienteKey(pick));
    if (match) sel.value = escPickerValue(match);
    else sel.value = "";
  } else if (state.highlightStopId) {
    const hs = state.stops.find((s) => s.id === state.highlightStopId);
    const first = hs ? collectClienteNamesFromStop(hs)[0] : "";
    const match = first && names.find((x) => normClienteKey(x) === normClienteKey(first));
    sel.value = match ? escPickerValue(match) : "";
  } else {
    sel.value = "";
  }
}

function isoBoxSvg(x, y, z, dx, dy, dz, col, lbl, ox, oy, alpha) {
  const c = (px, py, pz) => isoP(px, py, pz, ox, oy);
  const v = [
    c(x, y, z),
    c(x + dx, y, z),
    c(x + dx, y + dy, z),
    c(x, y + dy, z),
    c(x, y, z + dz),
    c(x + dx, y, z + dz),
    c(x + dx, y + dy, z + dz),
    c(x, y + dy, z + dz),
  ];
  const tc = isoP(x + dx / 2, y + dy / 2, z + dz, ox, oy);
  const s = "rgba(255,255,255,.3)";
  const op = alpha < 1 ? ` opacity="${alpha}"` : "";
  const showLbl = lbl && dz * ISZ > 11;
  return `<g${op}>
    <polygon points="${fp([v[3], v[2], v[6], v[7]])}" fill="${esc(shd(col, 0.48))}" stroke="${s}" stroke-width="0.4"/>
    <polygon points="${fp([v[0], v[3], v[7], v[4]])}" fill="${esc(shd(col, 0.62))}" stroke="${s}" stroke-width="0.4"/>
    <polygon points="${fp([v[1], v[2], v[6], v[5]])}" fill="${esc(shd(col, 0.62))}" stroke="${s}" stroke-width="0.4"/>
    <polygon points="${fp([v[0], v[1], v[5], v[4]])}" fill="${esc(shd(col, 0.78))}" stroke="${s}" stroke-width="0.4"/>
    <polygon points="${fp([v[4], v[5], v[6], v[7]])}" fill="${esc(col)}" stroke="rgba(255,255,255,.55)" stroke-width="0.8"/>
    ${
      showLbl
        ? `<text x="${tc.px.toFixed(1)}" y="${(tc.py + 3).toFixed(1)}" text-anchor="middle" font-size="7" fill="white" font-weight="bold">${esc(
            lbl
          )}</text>`
        : ""
    }
  </g>`;
}

function renderCargoView(cargo) {
  const { placed, rowH, maxLen } = cargo;
  const truckL = state.truckL;
  const OX = 72;
  const OY = 90;
  const viewW = Math.max(440, OX + (maxLen * C30 + TRUCK_W * C30) * ISX + 60);
  const viewH = 260;
  const sorted = [...placed].sort((a, b) => b.row - a.row || a.zBase - b.zBase);
  const tf = (x, y, z) => isoP(x, y, z, OX, OY);
  const trLine = (x1, y1, z1, x2, y2, z2, col, sw, dash) => {
    const a = tf(x1, y1, z1);
    const b = tf(x2, y2, z2);
    const da = dash ? ` stroke-dasharray="${esc(dash)}"` : "";
    return `<line x1="${a.px.toFixed(1)}" y1="${a.py.toFixed(1)}" x2="${b.px.toFixed(1)}" y2="${b.py.toFixed(
      1
    )}" stroke="${esc(col)}" stroke-width="${sw}"${da}/>`;
  };

  const unloadOrder = state.stops
    .map((s) => {
      const pkgs = placed.filter((p) => p.sId === s.id);
      const maxZ = pkgs.length ? Math.max(...pkgs.map((p) => p.zBase + p.h)) : 0;
      return { ...s, pkgs, maxZ };
    })
    .sort((a, b) => b.maxZ - a.maxZ);

  const TPX = 50;
  const TPY = 70;
  const tvW = Math.max(500, (maxLen + 1) * TPX + 80);
  const tvH = TRUCK_W * TPY + 60;

  const SVX = 50;
  const SVZ = 90;
  const svW = Math.max(500, (maxLen + 1) * SVX + 80);
  const svH = MAX_H * SVZ + 80;

  let svg3d = "";
  if (maxLen > truckL) {
    svg3d += `<polygon points="${fp([tf(truckL, 0, 0), tf(maxLen, 0, 0), tf(maxLen, TRUCK_W, 0), tf(truckL, TRUCK_W, 0)])}" fill="rgba(251,191,36,0.12)" stroke="#F59E0B" stroke-width="1" stroke-dasharray="4,3"/>`;
  }
  svg3d += `<polygon points="${fp([tf(0, 0, 0), tf(truckL, 0, 0), tf(truckL, TRUCK_W, 0), tf(0, TRUCK_W, 0)])}" fill="#1E3A5F" stroke="#3B82F6" stroke-width="1.2"/>`;
  svg3d += trLine(0, ROW_W, 0, truckL, ROW_W, 0, "#3B82F6", 0.8, "3,3");
  svg3d += sorted
    .map((pkg) =>
      isoBoxSvg(
        0,
        pkg.row * ROW_W,
        pkg.zBase,
        pkg.len,
        ROW_W,
        pkg.h,
        pkg.ov ? "#EF4444" : pkg.sCol,
        `P${pkg.sOrd}·${pkg.n}u`,
        OX,
        OY,
        pkg.ov ? 0.7 : 1
      )
    )
    .join("");
  [0, ROW_W].forEach((y) => {
    svg3d += trLine(0, y, MAX_H, truckL, y, MAX_H, "#EF4444", 1, "5,3");
    svg3d += trLine(0, y, MAX_H, 0, y + ROW_W, MAX_H, "#EF4444", 1, "5,3");
    svg3d += trLine(truckL, y, MAX_H, truckL, y + ROW_W, MAX_H, "#EF4444", 1, "5,3");
  });
  [[0, 0], [truckL, 0], [0, TRUCK_W], [truckL, TRUCK_W]].forEach(([x, y], i) => {
    svg3d += trLine(x, y, 0, x, y, MAX_H, "#475569", 1, i > 0 ? "3,3" : "");
  });
  svg3d += trLine(0, 0, 0, 0, TRUCK_W, 0, "#60A5FA", 1.2, "");
  svg3d += trLine(0, 0, 0, truckL, 0, 0, "#60A5FA", 1.2, "");
  svg3d += trLine(0, TRUCK_W, 0, truckL, TRUCK_W, 0, "#60A5FA", 1.2, "");
  svg3d += trLine(truckL, 0, 0, truckL, TRUCK_W, 0, "#60A5FA", 1.5, "");
  {
    const p = tf(0, 0, MAX_H);
    svg3d += `<text x="${(p.px - 2).toFixed(1)}" y="${p.py.toFixed(1)}" text-anchor="end" font-size="9" fill="#EF4444" font-weight="bold">↑ 1.5m</text>`;
  }
  {
    const p = tf(0, TRUCK_W / 2, -0.1);
    svg3d += `<text x="${p.px.toFixed(1)}" y="${(p.py + 14).toFixed(1)}" text-anchor="middle" font-size="9" fill="#60A5FA" font-weight="bold">Puerta</text>`;
  }
  if (maxLen > truckL) {
    const p = tf((truckL + maxLen) / 2, TRUCK_W + 0.1, 0);
    svg3d += `<text x="${p.px.toFixed(1)}" y="${(p.py + 14).toFixed(1)}" text-anchor="middle" font-size="8" fill="#F59E0B">Saliente ${(maxLen - truckL).toFixed(1)}m</text>`;
  }
  {
    const a = tf(-0.2, ROW_W / 2, 0);
    const b = tf(-0.2, ROW_W + ROW_W / 2, 0);
    svg3d += `<text x="${a.px.toFixed(1)}" y="${a.py.toFixed(1)}" text-anchor="end" font-size="8" fill="#94A3B8">Fila A</text>`;
    svg3d += `<text x="${b.px.toFixed(1)}" y="${b.py.toFixed(1)}" text-anchor="end" font-size="8" fill="#94A3B8">Fila B</text>`;
  }
  rowH.forEach((h, i) => {
    const x1 = tf(maxLen + 0.3, i * ROW_W, 0);
    const x2 = tf(maxLen + 0.3, i * ROW_W, h);
    const pct = Math.round((h / MAX_H) * 100);
    const col = pct > 95 ? "#EF4444" : pct > 75 ? "#F59E0B" : "#10B981";
    svg3d += `<g><line x1="${x1.px.toFixed(1)}" y1="${x1.py.toFixed(1)}" x2="${x2.px.toFixed(1)}" y2="${x2.py.toFixed(
      1
    )}" stroke="${esc(col)}" stroke-width="4"/>
    <text x="${x2.px.toFixed(1)}" y="${(x2.py - 4).toFixed(1)}" text-anchor="middle" font-size="8" fill="${esc(
      col
    )}" font-weight="bold">${(h * 100).toFixed(0)}cm</text></g>`;
  });

  let topSvg = "";
  topSvg += `<rect x="40" y="10" width="${truckL * TPX}" height="${TRUCK_W * TPY}" fill="#F1F5F9" stroke="#3B82F6" stroke-width="1.5"/>`;
  if (maxLen > truckL) {
    topSvg += `<rect x="${40 + truckL * TPX}" y="10" width="${(maxLen - truckL) * TPX}" height="${
      TRUCK_W * TPY
    }" fill="#FEF3C7" stroke="#F59E0B" stroke-width="1" stroke-dasharray="4,3"/>`;
  }
  topSvg += `<line x1="40" y1="${10 + ROW_W * TPY}" x2="${40 + maxLen * TPX}" y2="${10 + ROW_W * TPY}" stroke="#3B82F6" stroke-width="1" stroke-dasharray="4,3"/>`;
  topSvg += [...placed]
    .sort((a, b) => b.sOrd - a.sOrd)
    .map((pkg) => {
      const x = 40;
      const y = 10 + pkg.row * ROW_W * TPY;
      const w = pkg.len * TPX;
      const h = ROW_W * TPY;
      const col = pkg.ov ? "#EF4444" : pkg.sCol;
      const txt =
        w > 40
          ? `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="9" fill="white" font-weight="bold">P${pkg.sOrd} · ${pkg.n}u</text>`
          : "";
      return `<g><rect x="${x}" y="${y + 1}" width="${w - 1}" height="${h - 2}" fill="${esc(col)}" opacity="0.8" rx="2"/>${txt}</g>`;
    })
    .join("");
  topSvg += `<text x="40" y="8" text-anchor="middle" font-size="9" fill="#60A5FA" font-weight="bold">⬇</text>`;
  topSvg += `<text x="${40 + (truckL * TPX) / 2}" y="${tvH - 4}" text-anchor="middle" font-size="8" fill="#6B7280">↔ ${truckL}m carrocería</text>`;
  topSvg += `<text x="34" y="${10 + (ROW_W * TPY) / 2 + 3}" text-anchor="end" font-size="8" fill="#6B7280">A</text>`;
  topSvg += `<text x="34" y="${10 + ROW_W * TPY + (ROW_W * TPY) / 2 + 3}" text-anchor="end" font-size="8" fill="#6B7280">B</text>`;

  let sideSvg = "";
  sideSvg += `<line x1="40" y1="${svH - 10}" x2="${40 + maxLen * SVX + 20}" y2="${svH - 10}" stroke="#374151" stroke-width="2"/>`;
  sideSvg += `<rect x="40" y="10" width="${truckL * SVX}" height="${svH - 20}" fill="#F8FAFC" stroke="#3B82F6" stroke-width="1.5"/>`;
  if (maxLen > truckL) {
    sideSvg += `<rect x="${40 + truckL * SVX}" y="10" width="${(maxLen - truckL) * SVX}" height="${
      svH - 20
    }" fill="#FEF3C7" stroke="#F59E0B" stroke-width="1" stroke-dasharray="4,3"/>`;
  }
  sideSvg += `<line x1="35" y1="${svH - 10 - MAX_H * SVZ}" x2="${40 + maxLen * SVX + 10}" y2="${svH - 10 - MAX_H * SVZ}" stroke="#EF4444" stroke-width="1" stroke-dasharray="5,3"/>`;
  sideSvg += `<text x="32" y="${svH - 10 - MAX_H * SVZ + 3}" text-anchor="end" font-size="8" fill="#EF4444" font-weight="bold">1.5m</text>`;
  sideSvg += [...placed]
    .sort((a, b) => b.sOrd - a.sOrd)
    .map((pkg) => {
      const x = 40;
      const y = svH - 10 - pkg.zBase * SVZ - pkg.h * SVZ;
      const w = pkg.len * SVX;
      const h = pkg.h * SVZ;
      const col = pkg.ov ? "#EF4444" : pkg.sCol;
      const op = pkg.row === 0 ? 0.9 : 0.5;
      const txt =
        h > 12 && w > 40
          ? `<text x="${x + w / 2}" y="${y + h / 2 + 3}" text-anchor="middle" font-size="7" fill="white" font-weight="bold">P${pkg.sOrd}</text>`
          : "";
      return `<g><rect x="${x}" y="${y}" width="${w - 1}" height="${Math.max(h - 1, 2)}" fill="${esc(
        col
      )}" opacity="${op}" rx="1" stroke="rgba(255,255,255,.4)" stroke-width="0.5"/>${txt}</g>`;
    })
    .join("");
  [0, 0.5, 1.0, 1.5].forEach((m) => {
    const py = svH - 10 - m * SVZ;
    sideSvg += `<g><line x1="36" y1="${py}" x2="40" y2="${py}" stroke="#9CA3AF" stroke-width="1"/>
      <text x="34" y="${py + 3}" text-anchor="end" font-size="7" fill="#9CA3AF">${m}m</text></g>`;
  });
  sideSvg += `<rect x="${svW - 80}" y="8" width="10" height="8" fill="#2563EB" opacity="0.9"/>`;
  sideSvg += `<text x="${svW - 67}" y="15" font-size="7" fill="#374151">Fila A</text>`;
  sideSvg += `<rect x="${svW - 80}" y="20" width="10" height="8" fill="#2563EB" opacity="0.4"/>`;
  sideSvg += `<text x="${svW - 67}" y="27" font-size="7" fill="#374151">Fila B</text>`;

  const unloadCards = unloadOrder
    .map((s, idx) => {
      const pcts = s.pkgs.map((pk) => Math.round(((pk.zBase + pk.h / 2) / MAX_H) * 100));
      const avgPct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
      const tag =
        idx === 0
          ? "1° descarga"
          : idx === unloadOrder.length - 1
            ? "Último"
            : `${idx + 1}°`;
      const pkLines = s.pkgs
        .map(
          (pk, i) =>
            `<div class="unload-pkg">Fila ${pk.row === 0 ? "A" : "B"} · zBase ${(pk.zBase * 100).toFixed(0)}cm · ${pk.n}×${pk.esp}mm/${pk.len}m</div>`
        )
        .join("");
      return `<div class="unload-card" style="border-color:${esc(s.color)};background:${esc(s.color)}14">
        <div class="unload-card-head">
          <span style="font-weight:700;color:${esc(s.color)}">P${s.orden}: ${esc(s.cliente.slice(0, 18) || "—")}</span>
          <span class="unload-tag" style="background:${esc(s.color)}">${esc(tag)}</span>
        </div>
        <div class="unload-meta">${s.pkgs.length ? `${s.pkgs.length} pkgs · alt. prom. ${avgPct}%` : "(sin paneles)"}</div>
        <div class="unload-bar"><span style="width:${Math.min(avgPct, 100)}%;background:${esc(s.color)}"></span></div>
        ${pkLines}
      </div>`;
    })
    .join("");

  return `
    <div class="cargo-3d">
      <h3>Vista 3D isométrica — carga</h3>
      <div class="hint">Puerta trasera a la izquierda → P1 arriba (descarga primero). Orden de carga: último pedido al fondo.</div>
      <svg width="100%" viewBox="0 -8 ${viewW} ${viewH}" style="min-width:${viewW}px">${svg3d}</svg>
    </div>
    <div class="cargo-grid2">
      <div class="view-panel">
        <h3>Vista superior</h3>
        <div style="overflow-x:auto">
          <svg width="100%" viewBox="0 0 ${tvW} ${tvH}" style="min-width:${tvW}px">${topSvg}</svg>
        </div>
      </div>
      <div class="view-panel">
        <h3>Vista lateral</h3>
        <div style="overflow-x:auto">
          <svg width="100%" viewBox="0 0 ${svW} ${svH + 20}" style="min-width:${svW}px">${sideSvg}</svg>
        </div>
      </div>
    </div>
    <div class="view-panel" style="margin-bottom:12px">
      <h3>Orden de descarga (de arriba → abajo)</h3>
      <div class="unload-grid">${unloadCards}</div>
    </div>
    <div class="tech-summary">
      <h4>Resumen técnico</h4>
      <div class="tech-grid">
        ${[
          ["Carrocería", `${truckL} m`],
          ["Fila A", `${(rowH[0] * 100).toFixed(0)} cm / 150 cm`],
          ["Fila B", `${(rowH[1] * 100).toFixed(0)} cm / 150 cm`],
          ["Saliente", maxLen > truckL ? `${(maxLen - truckL).toFixed(1)} m / 2.0 m` : "Sin saliente"],
          ["Paquetes", `${placed.length} total`],
          ["Desborde altura", `${placed.filter((p) => p.ov).length} pkgs`],
        ]
          .map(
            ([k, v]) =>
              `<div class="tech-cell"><div class="tech-k">${esc(k)}</div><div class="tech-v">${esc(v)}</div></div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function ubicacionChips(stop) {
  const hasLink = !!(stop.linkUbicacion && String(stop.linkUbicacion).trim());
  const hasDir = !!(stop.direccion && String(stop.direccion).trim()) || !!(stop.zona && String(stop.zona).trim());
  const chips = [];
  if (hasLink) chips.push(`<span class="chip chip-map">Mapa (link)</span>`);
  if (hasDir) chips.push(`<span class="chip chip-dir">Dirección</span>`);
  if (!chips.length) chips.push(`<span class="chip chip-dir">Sin ubicación</span>`);
  return chips.join("");
}

function renderStopAdjuntoPreview(stop) {
  const u = String(stop.linkAdjunto || "").trim();
  if (!u) return "";
  const cls = classifyAdjuntoUrl(u);
  if (cls.imgSrc) {
    return `<div class="adjunto-preview">
      <span class="lbl" style="display:block;margin-top:8px">Vista previa adjunto</span>
      <a href="${esc(cls.href)}" target="_blank" rel="noopener noreferrer" class="adjunto-thumb-link">
        <img class="adjunto-thumb" src="${esc(cls.imgSrc)}" alt="Vista previa" width="320" height="240" referrerpolicy="no-referrer" loading="lazy" />
      </a>
      <p class="paste-hint">Si no ves la imagen: el archivo en Drive puede ser privado. Abrí el enlace del campo adjunto.</p>
    </div>`;
  }
  return `<div class="adjunto-preview"><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Abrir adjunto (PDF u otro)</a></div>`;
}

function escapeTextareaValue(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderAdjuntoTextExtract(stop) {
  const fid = `adjPdf-${esc(stop.id)}`;
  return `<div class="adjunto-bom-box" style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0">
    <label class="lbl">Texto copiado del adjunto (PDF / cotización)</label>
    <p class="paste-hint" style="margin:4px 0 6px">Podés <strong>cargar un PDF</strong> (texto seleccionable) o pegar manualmente la tabla / líneas de producto. El link de Drive no se descarga solo: el PDF va desde tu disco. La primera lectura de PDF descarga <strong>PDF.js</strong> desde jsDelivr (requiere internet).</p>
    <input type="file" id="${fid}" class="adjunto-pdf-input" data-pdf-stop="${esc(stop.id)}" accept=".pdf,application/pdf" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" tabindex="-1" aria-hidden="true" />
    <div class="row-flex" style="margin-bottom:8px;gap:6px;flex-wrap:wrap;align-items:center">
      <label for="${fid}" class="btn btn-muted btn-sm" style="cursor:pointer;margin:0">Elegir PDF → texto</label>
      <button type="button" class="btn btn-secondary btn-sm" data-pdf-then-parse="${esc(stop.id)}" data-pdf-parse-mode="append">PDF → añadir</button>
      <button type="button" class="btn btn-secondary btn-sm" data-pdf-then-parse="${esc(stop.id)}" data-pdf-parse-mode="replace">PDF → reemplazar</button>
    </div>
    <textarea class="inp adjunto-bom-text" data-adjunto-draft-stop="${esc(stop.id)}" rows="4" placeholder="Ej.: ISODEC EPS 100 mm largo 6 m cant 12&#10;o tabla TSV: Producto → Espesor → Largo → Cantidad">${escapeTextareaValue(
      stop._adjuntoPasteDraft || ""
    )}</textarea>
    <div class="row-flex" style="margin-top:6px;gap:8px;flex-wrap:wrap;align-items:center">
      <button type="button" class="btn btn-secondary btn-sm" data-parse-adjunto="${esc(stop.id)}" data-parse-mode="append">Añadir desde texto</button>
      <button type="button" class="btn btn-muted btn-sm" data-parse-adjunto="${esc(stop.id)}" data-parse-mode="replace">Reemplazar listas</button>
    </div>
    ${renderNotasScrapeRow(stop)}
  </div>`;
}

/**
 * @param {any} s stop
 * @param {Array<{ tipo: string, espesor: number, longitud: number, cantidad: number }>} paneles
 * @param {Array<{ descr: string, cantidad: number }>} accesorios
 * @param {"append"|"replace"} mode
 */
function mergeParsedIntoStop(s, paneles, accesorios, mode) {
  resetDefaultCargoIds();
  if (mode === "replace") {
    s.paneles = [];
    s.accesorios = [];
  }
  for (const row of paneles) {
    const p = mkPanel();
    p.tipo = row.tipo;
    p.espesor = row.espesor;
    p.longitud = row.longitud;
    p.cantidad = row.cantidad;
    s.paneles.push(p);
  }
  for (const row of accesorios) {
    const a = mkAcc();
    a.descr = row.descr;
    a.cantidad = row.cantidad;
    s.accesorios.push(a);
  }
}

function applyParsedBomToStop(sid, text, mode) {
  const s = findStop(sid);
  if (!s) return false;
  const trimmed = String(text || "").trim();
  s._adjuntoPasteDraft = trimmed;
  if (!trimmed) {
    alert("Pegá primero el texto o cargá un PDF.");
    return false;
  }
  const { paneles, accesorios, warnings } = parseLogisticaFromAdjuntoText(trimmed);
  if (!paneles.length && !accesorios.length) {
    alert((warnings && warnings[0]) || "No se detectaron paneles ni accesorios.");
    renderAll();
    return false;
  }
  mergeParsedIntoStop(s, paneles, accesorios, mode);
  const hint = warnings.length ? `\n\n${warnings.join("\n")}` : "";
  alert(`Listo: +${paneles.length} línea(s) de panel, +${accesorios.length} accesorio(s).${hint}`);
  renderAll();
  return true;
}

function runParseAdjuntoText(sid, mode, cardEl) {
  const card = cardEl instanceof HTMLElement ? cardEl : null;
  const ta = card?.querySelector("textarea.adjunto-bom-text");
  const text = ta?.value?.trim() || "";
  const s = findStop(sid);
  if (s) s._adjuntoPasteDraft = text;
  applyParsedBomToStop(sid, text, mode);
}

async function handleAdjuntoPdfFile(input) {
  const sid = input.getAttribute("data-pdf-stop");
  const after = input.getAttribute("data-pdf-after-load") || "";
  input.removeAttribute("data-pdf-after-load");
  const file = input.files?.[0];
  input.value = "";
  if (!file || !sid) return;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  if (type && !type.includes("pdf") && !name.endsWith(".pdf")) {
    alert("Elegí un archivo PDF (.pdf).");
    return;
  }
  let buf;
  try {
    buf = await file.arrayBuffer();
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
    return;
  }
  const { text, numPages, pagesRead, warnings: pw } = await extractTextFromPdfArrayBuffer(buf);
  const s = findStop(sid);
  if (!s) return;
  s._adjuntoPasteDraft = text;

  if (after === "append" || after === "replace") {
    const { paneles, accesorios, warnings } = parseLogisticaFromAdjuntoText(text);
    if (!paneles.length && !accesorios.length) {
      renderAll();
      const wMsg = (warnings && warnings[0]) || "No hay líneas reconocibles de panel o accesorio.";
      const extra = pw.filter(Boolean).join("\n");
      alert(`PDF leído (${pagesRead}/${numPages} pág.).\n\n${wMsg}${extra ? `\n\n${extra}` : ""}`);
      return;
    }
    mergeParsedIntoStop(s, paneles, accesorios, after);
    renderAll();
    const notes = [...warnings, ...pw].filter(Boolean);
    alert(
      `PDF (${numPages} pág.): +${paneles.length} panel(es), +${accesorios.length} accesorio(s).${notes.length ? `\n\n${notes.join("\n")}` : ""}`
    );
    return;
  }

  renderAll();
  const extra = pw.filter(Boolean).join("\n");
  alert(
    `PDF: ${numPages} pág. Texto cargado en el cuadro (${text.length} caracteres).${extra ? `\n\n${extra}` : ""}`
  );
}

function notasBlobFromStop(stop) {
  const raw = stop.rawSheet || {};
  return [raw.NOTAS, raw["Consulta / Pedido"], raw.notas, raw.Consulta].filter(Boolean).join("\n").trim();
}

function renderNotasScrapeRow(stop) {
  if (!notasBlobFromStop(stop)) return "";
  return `<div class="row-flex" style="margin-top:8px;gap:6px;flex-wrap:wrap;align-items:center">
      <span class="paste-hint" style="margin:0">Hay NOTAS / pedido en la fila de planilla.</span>
      <button type="button" class="btn btn-muted btn-sm" data-parse-notas="${esc(stop.id)}">Extraer paneles desde NOTAS (añadir)</button>
    </div>`;
}

function renderSheetRawBlock(stop) {
  const raw = stop.rawSheet;
  if (!raw || typeof raw !== "object") return "";
  const keys = Object.keys(raw).filter((k) => String(raw[k] ?? "").trim() !== "");
  if (keys.length === 0) return "";
  keys.sort((a, b) => a.localeCompare(b));
  const rows = keys
    .map((k) => `<tr><th>${esc(k)}</th><td style="word-break:break-word">${esc(String(raw[k]))}</td></tr>`)
    .join("");
  return `<details class="raw-sheet np" style="margin-top:10px"><summary>Planilla: todos los campos (${keys.length})</summary><div style="max-height:260px;overflow:auto;margin-top:6px"><table class="paste-preview-table">${rows}</table></div><p class="paste-hint">Copia del objeto que vino del JSON (API o export). Sirve para auditar columnas extra.</p></details>`;
}

function renderPaquetesInterpretacion(stop) {
  if (!stop.paneles?.length) return "";
  const pkgRows = describePanelPackages(stop);
  const plac = describeTruckPlacementOneStop(stop, state.truckL);
  const list = pkgRows
    .map((r) => `<li><strong>${esc(r.label)}</strong> → ${esc(String(r.pkgCount))} paquete(s): ${esc(r.detail)}</li>`)
    .join("");
  const warn =
    plac.warns?.length > 0
      ? `<ul class="paste-warn" style="margin:8px 0 0 18px">${plac.warns.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`
      : "";
  return `<details class="pkg-brain np" style="margin-top:10px"><summary>Paquetes de carga (motor BMC — MAX_P + colocación en 1 camión)</summary><ul style="margin:8px 0 0 18px;font-size:12px;line-height:1.45">${list}</ul>${warn}<p class="paste-hint">Cada paquete respeta el máximo de paneles por espesor; la colocación es guía (filas A/B, 1,5 m).</p></details>`;
}

function renderPastePreviewBox(result) {
  const f = result.fields || {};
  const rows = [
    ["Modo", result.mode],
    ["Pedido / ID", f.cotizacionId || "—"],
    ["Cliente", f.cliente || "—"],
    ["Dirección", f.direccion || "—"],
    ["Zona", f.zona || "—"],
    ["Tel", f.telefono || "—"],
    ["Link mapa", f.linkUbicacion || "—"],
    ["Link adjunto", f.linkAdjunto || "—"],
  ];
  const tb = `<table class="paste-preview-table"><tbody>${rows
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("")}</tbody></table>`;
  const adj = classifyAdjuntoUrl(f.linkAdjunto || "");
  let media = "";
  if (adj.imgSrc) {
    media = `<div class="paste-preview-thumb"><a href="${esc(adj.href)}" target="_blank" rel="noopener noreferrer"><img src="${esc(
      adj.imgSrc
    )}" alt="" width="280" height="200" referrerpolicy="no-referrer" loading="lazy" /></a></div>`;
  }
  const warns =
    result.warnings && result.warnings.length
      ? `<ul class="paste-warn">${result.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`
      : "";
  return `${tb}${media}${warns}`;
}

function runPastePreview() {
  const ta = document.getElementById("pasteSheetRow");
  const preset = document.getElementById("pasteSheetPreset")?.value || "ventasDashboardLegacy";
  const box = document.getElementById("pastePreview");
  if (!ta || !box) return;
  const result = extractStopFieldsFromPaste(ta.value, preset);
  box.innerHTML = renderPastePreviewBox(result);
}

function runPasteImport() {
  const ta = document.getElementById("pasteSheetRow");
  const preset = document.getElementById("pasteSheetPreset")?.value || "ventasDashboardLegacy";
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) {
    alert("Pegá una fila de la planilla primero.");
    return;
  }
  const result = extractStopFieldsFromPaste(text, preset);
  if (result.mode === "empty") {
    alert(result.warnings[0] || "No se pudo leer el pegado.");
    return;
  }
  resetDefaultCargoIds();
  const orden = state.stops.length + 1;
  const s = mkStop(orden);
  const f = result.fields;
  s.cliente = f.cliente || "";
  s.telefono = f.telefono || "";
  s.direccion = f.direccion || "";
  s.zona = f.zona || "";
  s.linkUbicacion = f.linkUbicacion || "";
  s.linkAdjunto = f.linkAdjunto || "";
  s.cotizacionId = f.cotizacionId || "";
  state.stops.push(s);
  renumberStops();
  ta.value = "";
  renderAll();
}

function renderForm() {
  const cargo = getCargo();
  const importBlock = `
    <div class="card card-highlight">
      <strong>Importar JSON</strong> (próximas entregas, <code>GET /api/cotizaciones</code> o estado guardado — ver README)
      <textarea class="inp import-area" id="importJson" placeholder='Pegá un array de filas o { "data": [...] }. Cada objeto puede traer todas las columnas CRM: se guardan en «Planilla: todos los campos» y se infieren links PDF/Drive/mapa en cualquier celda.'></textarea>
      <div class="row-flex" style="margin-top:8px">
        <button type="button" class="btn btn-primary" id="btnImportAppend">Añadir paradas desde filas API</button>
        <button type="button" class="btn btn-muted" id="btnImportReplace">Reemplazar plan completo</button>
        <button type="button" class="btn btn-secondary" id="btnLoadExample">Cargar ejemplo</button>
      </div>
      <p style="font-size:0.72rem;color:#64748b;margin:8px 0 0">No uses IDs de planilla en el cliente en producción; esto es solo prototipo offline.</p>
    </div>
    <div class="card card-paste">
      <strong>Pegar fila desde planilla (Google Sheets / Excel)</strong>
      <p class="paste-help">
        Copiá <strong>una sola fila</strong> (celdas separadas por tabulador) o <strong>dos filas</strong>: encabezados y debajo los valores.
        Se intenta detectar un <strong>link de mapa</strong> en cualquier celda. El enlace de <strong>PDF / foto / Drive</strong> va al campo adjunto;
        la miniatura se muestra con la API pública de thumbnails de Drive (si el archivo no es público, puede no verse — abrí el enlace).
      </p>
      <label class="lbl">Plantilla por índice de columna (solo si pegás 1 fila sin títulos)</label>
      <select id="pasteSheetPreset" class="inp">
        ${Object.entries(SHEET_PASTE_PRESETS)
          .map(
            ([key, pr]) =>
              `<option value="${esc(key)}"${key === "ventasDashboardLegacy" ? " selected" : ""}>${esc(pr.label)}</option>`
          )
          .join("")}
      </select>
      <label class="lbl" style="margin-top:8px">Contenido pegado</label>
      <textarea id="pasteSheetRow" class="inp import-area" placeholder="Pegá aquí (Ctrl+V / Cmd+V) la fila copiada desde la planilla…"></textarea>
      <div class="row-flex" style="margin-top:8px">
        <button type="button" class="btn btn-secondary" id="btnPastePreview">Previsualizar</button>
        <button type="button" class="btn btn-primary" id="btnPasteImport">Importar como nueva parada</button>
      </div>
      <div id="pastePreview" class="paste-preview-box" aria-live="polite"></div>
    </div>
    <div class="card">
      <strong>Persistencia local</strong>
      <div class="row-flex" style="margin-top:8px">
        <button type="button" class="btn btn-success" id="btnSaveDraft">Guardar borrador</button>
        <button type="button" class="btn btn-secondary" id="btnLoadDraft">Cargar borrador</button>
      </div>
    </div>
  `;

  const envio = `
    <div class="card">
      <strong>Datos del envío</strong>
      <div class="grid2" style="margin-top:8px">
        <div><label class="lbl">Nº envío</label><input class="inp" data-info="numero" value="${esc(state.info.numero)}"/></div>
        <div><label class="lbl">Fecha</label><input class="inp" data-info="fecha" type="date" value="${esc(state.info.fecha)}"/></div>
        <div><label class="lbl">Transportista</label><input class="inp" data-info="transportista" value="${esc(state.info.transportista)}"/></div>
        <div><label class="lbl">Patente</label><input class="inp" data-info="patente" value="${esc(state.info.patente)}"/></div>
      </div>
      <label class="lbl" style="margin-top:8px">Notas</label>
      <textarea class="inp" data-info="notas" placeholder="Horarios, accesos…">${esc(state.info.notas)}</textarea>
    </div>
  `;

  const stopsHtml = state.stops
    .map((stop) => {
      const mapUrl = mapsUrlFromStop(stop.direccion, stop.zona, stop.linkUbicacion);
      const placed = cargo.placed.filter((p) => p.sId === stop.id);
      const rowA = placed.filter((p) => p.row === 0);
      const rowB = placed.filter((p) => p.row === 1);
      const placement =
        placed.length > 0
          ? `<div class="placement-box" style="border-color:${esc(stop.color)};background:${esc(stop.color)}12">
          <strong style="color:${esc(stop.color)}">En camión:</strong>
          ${rowA.length ? `<span> Fila A: ${rowA.map((pk) => `${pk.n}×${pk.esp}mm`).join(", ")}</span>` : ""}
          ${rowB.length ? `<span> Fila B: ${rowB.map((pk) => `${pk.n}×${pk.esp}mm`).join(", ")}</span>` : ""}
        </div>`
          : "";

      const panels = stop.paneles
        .map((p) => {
          const pks = buildPkgs(stop, p);
          const pkgSpans = pks
            .map(
              (pk, i) =>
                `<span class="pkg-chip" style="border-color:${esc(stop.color)};background:${esc(stop.color)}12">Pkg ${i + 1}: ${pk.n}p · ${(pk.h * 100).toFixed(0)} cm alto</span>`
            )
            .join("");
          const tipoOpts = TIPOS.map((t) => `<option${p.tipo === t ? " selected" : ""}>${esc(t)}</option>`).join("");
          const espOpts = ESPS.map(
            (e) => `<option value="${e}"${Number(p.espesor) === e ? " selected" : ""}>${e} mm</option>`
          ).join("");
          const lenOpts = LENS.map(
            (l) => `<option value="${l}"${Number(p.longitud) === l ? " selected" : ""}>${l} m</option>`
          ).join("");
          return `<div class="panel-row" data-stop="${esc(stop.id)}">
          <div class="row-flex" style="margin-bottom:4px">
            <select class="inp" style="flex:2;min-width:95px;font-size:12px" data-panel-field="tipo" data-panel="${esc(p.id)}">${tipoOpts}</select>
            <select class="inp" style="width:82px;font-size:12px" data-panel-field="espesor" data-panel="${esc(p.id)}">${espOpts}</select>
            <select class="inp" style="width:66px;font-size:12px" data-panel-field="longitud" data-panel="${esc(p.id)}">${lenOpts}</select>
            <input class="inp" style="width:52px" type="number" min="1" data-panel-field="cantidad" data-panel="${esc(
              p.id
            )}" value="${esc(String(p.cantidad))}"/>
            <button type="button" class="btn btn-danger btn-sm" data-rm-panel="${esc(p.id)}" data-stop="${esc(stop.id)}">✕</button>
          </div>
          <div class="row-flex" style="padding-left:6px;flex-wrap:wrap;gap:4px">${pkgSpans}</div>
        </div>`;
        })
        .join("");

      const accs = stop.accesorios
        .map(
          (a) => `<div class="row-flex" style="margin-bottom:5px" data-stop="${esc(stop.id)}">
          <input class="inp" style="flex:3;font-size:12px" placeholder="Perfil U, tornillos…" data-acc-field="descr" data-acc="${esc(a.id)}" value="${esc(a.descr)}"/>
          <input class="inp" style="width:50px;font-size:12px" type="number" min="1" data-acc-field="cantidad" data-acc="${esc(a.id)}" value="${esc(String(a.cantidad))}"/>
          <button type="button" class="btn btn-danger btn-sm" data-rm-acc="${esc(a.id)}" data-stop="${esc(stop.id)}">✕</button>
        </div>`
        )
        .join("");

      const hi = state.highlightStopId === stop.id ? " stop-card--highlight" : "";
      return `<div class="card stop-card${hi}" data-stop-card="${esc(stop.id)}" style="border-left:4px solid ${esc(stop.color)}">
        <div class="stop-head" style="border-bottom-color:${esc(stop.color)}33">
          <strong style="color:${esc(stop.color)};font-size:1rem">Parada ${stop.orden}</strong>
          <div class="row-flex">
            ${ubicacionChips(stop)}
            ${
              mapUrl
                ? `<a class="btn btn-success" style="text-decoration:none;font-size:11px;padding:4px 10px" href="${esc(
                    mapUrl
                  )}" target="_blank" rel="noopener noreferrer">Mapa</a>`
                : ""
            }
            ${state.stops.length > 1 ? `<button type="button" class="btn btn-danger btn-sm" data-rm-stop="${esc(stop.id)}">Quitar</button>` : ""}
          </div>
        </div>
        <div class="grid3" style="margin-bottom:10px">
          <div><label class="lbl">Cliente</label><input class="inp" data-stop-field="cliente" data-stop="${esc(stop.id)}" value="${esc(stop.cliente)}"/></div>
          <div><label class="lbl">Teléfono</label><input class="inp" data-stop-field="telefono" data-stop="${esc(stop.id)}" value="${esc(stop.telefono)}"/></div>
          <div><label class="lbl">Dirección</label><input class="inp" data-stop-field="direccion" data-stop="${esc(stop.id)}" value="${esc(stop.direccion)}"/></div>
        </div>
        <div class="grid2" style="margin-bottom:10px">
          <div><label class="lbl">Zona</label><input class="inp" data-stop-field="zona" data-stop="${esc(stop.id)}" value="${esc(stop.zona)}"/></div>
          <div><label class="lbl">Link ubicación (opcional)</label><input class="inp" data-stop-field="linkUbicacion" data-stop="${esc(stop.id)}" value="${esc(stop.linkUbicacion)}"/></div>
        </div>
        <div class="grid2" style="margin-bottom:10px">
          <div><label class="lbl">ID cotización / pedido</label><input class="inp" data-stop-field="cotizacionId" data-stop="${esc(stop.id)}" value="${esc(stop.cotizacionId)}"/></div>
          <div><label class="lbl">Link PDF / foto / Drive (adjunto)</label><input class="inp" data-stop-field="linkAdjunto" data-stop="${esc(stop.id)}" value="${esc(stop.linkAdjunto || "")}"/></div>
        </div>
        ${renderStopAdjuntoPreview(stop)}
        ${renderAdjuntoTextExtract(stop)}
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;margin-bottom:6px;color:#374151">Paneles</div>
          ${panels}
          <button type="button" class="btn btn-primary btn-sm" data-add-panel="${esc(stop.id)}">+ Panel</button>
        </div>
        ${placement}
        ${renderPaquetesInterpretacion(stop)}
        <div>
          <div style="font-size:11px;font-weight:700;margin-bottom:5px;color:#374151">Accesorios</div>
          ${accs}
          <button type="button" class="btn btn-muted btn-sm" data-add-acc="${esc(stop.id)}">+ Accesorio</button>
        </div>
        ${renderSheetRawBlock(stop)}
      </div>`;
    })
    .join("");

  return `${importBlock}${envio}${stopsHtml}
    <button type="button" class="btn btn-success" id="btnAddStop" style="width:100%;padding:12px;font-size:0.95rem">+ Agregar parada</button>`;
}

function renderRemito() {
  const cargo = getCargo();
  const truckL = state.truckL;
  const blocks = state.stops
    .map((stop) => {
      const pkgs = stop.paneles.flatMap((p) => buildPkgs(stop, p));
      const placed = cargo.placed.filter((p) => p.sId === stop.id);
      const ubicacionLine = formatUbicacionLine(stop);
      const mapUrl = mapsUrlFromStop(stop.direccion, stop.zona, stop.linkUbicacion);

      const transportRows = [];
      if (stop.paneles.length > 0) {
        transportRows.push(
          `<tr><td colspan="3" class="transport-cat">Paneles aislantes</td></tr>${stop.paneles
            .map((p) => {
              const cant = Math.max(1, Number(p.cantidad) || 1);
              return `<tr><td>${esc(panelProductLabel(p))}</td><td class="transport-num">${esc(formatLargoUY(p.longitud))}</td><td class="transport-num">${esc(String(cant))}</td></tr>`;
            })
            .join("")}`
        );
      }
      const accsClean = stop.accesorios.filter((a) => String(a.descr || "").trim());
      if (accsClean.length > 0) {
        transportRows.push(
          `<tr><td colspan="3" class="transport-cat">Accesorios</td></tr>${accsClean
            .map((a) => {
              const c = Math.max(1, Number(a.cantidad) || 1);
              return `<tr><td>${esc(String(a.descr).trim())}</td><td class="transport-num">—</td><td class="transport-num">${esc(String(c))}</td></tr>`;
            })
            .join("")}`
        );
      }
      const transportTable =
        transportRows.length > 0
          ? `<table class="transport-table">
          <thead><tr><th>Producto</th><th>Largos (m)</th><th>Cant</th></tr></thead>
          <tbody>${transportRows.join("")}</tbody></table>`
          : `<p class="transport-empty">Sin líneas de producto (agregar paneles o accesorios).</p>`;

      const transportCard = `<div class="transport-card">
        <div class="transport-card-title">Vista transportista (sin precios)</div>
        <div class="transport-client-block">
          <div><span class="transport-lbl">Cliente</span><strong>${esc(stop.cliente || "—")}</strong></div>
          <div><span class="transport-lbl">Dirección</span><span>${esc(ubicacionLine)}</span></div>
          <div><span class="transport-lbl">Tel/cel</span><span>${esc(stop.telefono || "—")}</span></div>
        </div>
        ${transportTable}
        <div class="transport-footer">
          <div><span class="transport-lbl">Pedido Nº</span><strong>${esc(stop.cotizacionId || "—")}</strong></div>
          <div><span class="transport-lbl">Ubicación</span><span>${esc(ubicacionLine)}</span></div>
          <div><span class="transport-lbl">Mapa</span>${
            mapUrl
              ? `<a href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer">${esc(mapUrl)}</a>`
              : `<span class="transport-missing">Completar dirección o link de ubicación</span>`
          }</div>
          <div><span class="transport-lbl">Contacto</span><span>${esc(stop.telefono || "—")}</span></div>
          <div><span class="transport-lbl">Adjunto (PDF / foto)</span>${
            stop.linkAdjunto
              ? `<a href="${esc(stop.linkAdjunto)}" target="_blank" rel="noopener noreferrer">${esc(stop.linkAdjunto)}</a>`
              : `<span class="transport-missing">—</span>`
          }</div>
        </div>
      </div>`;

      const table =
        stop.paneles.length > 0
          ? `<p class="remito-tech-title">Detalle técnico (BMC — carga)</p><table class="remito-table">
          <thead><tr style="background:${esc(stop.color)};color:#fff"><th>Tipo</th><th>Esp.</th><th>Largo</th><th>Cant.</th><th>Pkgs</th><th>Alto pkg</th><th>Filas</th></tr></thead>
          <tbody>${stop.paneles
            .map((p, i) => {
              const pks = buildPkgs(stop, p);
              const pl = cargo.placed.filter(
                (pp) => pp.sId === stop.id && pp.esp === Number(p.espesor) && pp.len === Number(p.longitud)
              );
              const filas = [...new Set(pl.map((pp) => (pp.row === 0 ? "A" : "B")))].join("+");
              const maxH = pks.length ? Math.max(...pks.map((pk) => pk.h)) : 0;
              return `<tr style="background:${i % 2 ? "#fff" : "#f9fafb"}">
              <td><strong>${esc(p.tipo)}</strong></td><td>${esc(String(p.espesor))} mm</td><td>${esc(String(p.longitud))} m</td>
              <td><strong>${esc(String(p.cantidad))}</strong></td><td>${pks.length}</td>
              <td style="color:${maxH > MAX_H ? "#dc2626" : "#059669"};font-weight:700">${(maxH * 100).toFixed(0)} cm${maxH > MAX_H ? " ⚠" : ""}</td>
              <td style="font-weight:700;color:#2563eb">${esc(filas || "—")}</td>
            </tr>`;
            })
            .join("")}</tbody></table>`
          : "";
      return `<div class="remito-stop" style="border-left:4px solid ${esc(stop.color)};padding-left:12px;margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">
          <strong style="font-size:14px;color:${esc(stop.color)}">Parada ${stop.orden}</strong>
          <span style="font-size:11px;color:#6b7280">${pkgs.length} paquetes · ${placed.filter((p) => p.row === 0).length} Fila A · ${placed.filter((p) => p.row === 1).length} Fila B</span>
        </div>
        ${transportCard}
        ${table}
      </div>`;
    })
    .join("");

  return `
    <div class="remito-actions np">
      <button type="button" class="btn btn-success" id="btnPrint">Imprimir</button>
      <button type="button" class="btn btn-wa" id="btnWaRemito">WhatsApp</button>
    </div>
    <div class="remito-doc">
      <div class="remito-header">
        <div>
          <div style="font-size:22px;font-weight:800;color:#1e3a5f">BMC Uruguay</div>
          <div style="font-size:12px;color:#6b7280">Metalog SAS · Paneles sandwich · Maldonado</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:800;color:#2563eb">HOJA DE RUTA</div>
          <div style="font-weight:700">${esc(state.info.numero)}</div>
          <div style="font-size:12px;color:#6b7280">${esc(state.info.fecha)}</div>
        </div>
      </div>
      <div class="remito-meta">
        ${[
          ["Transportista", state.info.transportista || "—"],
          ["Patente", state.info.patente || "—"],
          ["Camión", `${truckL} m`],
          ["Paradas / paquetes", `${state.stops.length} / ${cargo.placed.length}`],
        ]
          .map(
            ([k, v]) =>
              `<div><div class="remito-k">${esc(k)}</div><div class="remito-v">${esc(v)}</div></div>`
          )
          .join("")}
      </div>
      ${state.info.notas ? `<div class="remito-notes">📝 ${esc(state.info.notas)}</div>` : ""}
      ${blocks}
      <div class="remito-footer-stats">
        ${[
          ["Paquetes", String(cargo.placed.length)],
          ["Fila A", `${(cargo.rowH[0] * 100).toFixed(0)} cm`],
          ["Fila B", `${(cargo.rowH[1] * 100).toFixed(0)} cm`],
        ]
          .map(
            ([k, v]) => `<div class="rf-stat"><div class="rf-k">${esc(k)}</div><div class="rf-v">${esc(v)}</div></div>`
          )
          .join("")}
      </div>
      <div class="remito-sign">
        ${["Entregado (BMC)", "Recibido (transportista)", "Conforme (cliente)"]
          .map((l) => `<div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">${esc(l)}</div></div>`)
          .join("")}
      </div>
    </div>`;
}

function renderMain() {
  const main = document.getElementById("main");
  if (!main) return;
  const cargo = getCargo();
  if (state.view === "form") main.innerHTML = renderForm();
  else if (state.view === "remito") main.innerHTML = renderRemito();
  else main.innerHTML = renderCargoView(cargo);
}

function findStop(id) {
  return state.stops.find((s) => s.id === id);
}

let debounceMainT = 0;
function scheduleRenderMain() {
  clearTimeout(debounceMainT);
  debounceMainT = setTimeout(() => {
    if (state.view === "form") renderMain();
    renderHero();
    renderWarnings();
  }, 220);
}

let mainDelegationBound = false;

function ensureMainDelegation() {
  const main = document.getElementById("main");
  if (!main || mainDelegationBound) return;
  mainDelegationBound = true;

  main.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const infoKey = t.getAttribute("data-info");
    if (infoKey) {
      state.info[infoKey] = t.value;
      renderHero();
      return;
    }
    const draftSid = t.getAttribute("data-adjunto-draft-stop");
    if (draftSid && t.classList.contains("adjunto-bom-text")) {
      const s = findStop(draftSid);
      if (s) s._adjuntoPasteDraft = t.value;
      return;
    }
    const sf = t.getAttribute("data-stop-field");
    const sid0 = t.getAttribute("data-stop");
    if (sf && sid0) {
      const s = findStop(sid0);
      if (s) s[sf] = t.value;
      renderHero();
      renderWarnings();
      if (sf === "cliente") renderClientePlanillaPicker();
      return;
    }
    const pf = t.getAttribute("data-panel-field");
    const pid = t.getAttribute("data-panel");
    if (pf && pid) {
      const row = t.closest(".panel-row");
      const sid = row?.getAttribute("data-stop");
      if (!sid) return;
      const s = findStop(sid);
      const p = s?.paneles.find((x) => x.id === pid);
      if (!p) return;
      if (pf === "cantidad") {
        p.cantidad = Math.max(1, Number(t.value) || 1);
        renderHero();
        renderWarnings();
        scheduleRenderMain();
      }
      return;
    }
    const af = t.getAttribute("data-acc-field");
    const aid = t.getAttribute("data-acc");
    if (af && aid) {
      const row = t.closest("[data-stop]");
      const sid = row?.getAttribute("data-stop");
      if (!sid) return;
      const s = findStop(sid);
      const a = s?.accesorios.find((x) => x.id === aid);
      if (!a) return;
      if (af === "cantidad") a.cantidad = Math.max(1, Number(t.value) || 1);
      else a[af] = t.value;
    }
  });

  main.addEventListener("change", (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.classList.contains("adjunto-pdf-input")) {
      void handleAdjuntoPdfFile(t).catch((err) => {
        console.error(err);
        alert(err instanceof Error ? err.message : String(err));
      });
      return;
    }
    if (!(t instanceof HTMLElement)) return;
    const pf = t.getAttribute("data-panel-field");
    const pid = t.getAttribute("data-panel");
    if (pf && pid && pf !== "cantidad") {
      const row = t.closest(".panel-row");
      const sid = row?.getAttribute("data-stop");
      if (!sid) return;
      const s = findStop(sid);
      const p = s?.paneles.find((x) => x.id === pid);
      if (!p) return;
      if (pf === "espesor" || pf === "longitud") p[pf] = Number(t.value);
      else p[pf] = t.value;
      renderMain();
      renderHero();
      renderWarnings();
      return;
    }
    if (pf === "cantidad" && pid) {
      const row = t.closest(".panel-row");
      const sid = row?.getAttribute("data-stop");
      const s = findStop(sid || "");
      const p = s?.paneles.find((x) => x.id === pid);
      if (p) p.cantidad = Math.max(1, Number(t.value) || 1);
      renderMain();
      renderHero();
      renderWarnings();
    }
  });

  main.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const addStop = t.closest("#btnAddStop");
    if (addStop) {
      resetDefaultCargoIds();
      state.stops.push(mkStop(state.stops.length + 1));
      renumberStops();
      renderAll();
      return;
    }
    const rmStop = t.closest("[data-rm-stop]");
    if (rmStop) {
      const id = rmStop.getAttribute("data-rm-stop");
      state.stops = state.stops.filter((s) => s.id !== id);
      renumberStops();
      renderAll();
      return;
    }
    const addPanel = t.closest("[data-add-panel]");
    if (addPanel) {
      const sid = addPanel.getAttribute("data-add-panel");
      const s = findStop(sid || "");
      if (s) {
        resetDefaultCargoIds();
        s.paneles.push(mkPanel());
        renderAll();
      }
      return;
    }
    const rmPanel = t.closest("[data-rm-panel]");
    if (rmPanel) {
      const sid = rmPanel.getAttribute("data-stop");
      const pid = rmPanel.getAttribute("data-rm-panel");
      const s = findStop(sid || "");
      if (s) {
        s.paneles = s.paneles.filter((p) => p.id !== pid);
        renderAll();
      }
      return;
    }
    const addAcc = t.closest("[data-add-acc]");
    if (addAcc) {
      const sid = addAcc.getAttribute("data-add-acc");
      const s = findStop(sid || "");
      if (s) {
        resetDefaultCargoIds();
        s.accesorios.push(mkAcc());
        renderAll();
      }
      return;
    }
    const rmAcc = t.closest("[data-rm-acc]");
    if (rmAcc) {
      const sid = rmAcc.getAttribute("data-stop");
      const aid = rmAcc.getAttribute("data-rm-acc");
      const s = findStop(sid || "");
      if (s) {
        s.accesorios = s.accesorios.filter((a) => a.id !== aid);
        renderAll();
      }
      return;
    }
    if (t.closest("#btnImportAppend")) {
      try {
        importFromTextarea(false);
        renderAll();
      } catch (err) {
        alert(err.message || String(err));
      }
      return;
    }
    if (t.closest("#btnImportReplace")) {
      try {
        importFromTextarea(true);
        renderAll();
      } catch (err) {
        alert(err.message || String(err));
      }
      return;
    }
    if (t.closest("#btnLoadExample")) {
      fetch("./examples/import-proximas-ejemplo.json")
        .then((r) => r.json())
        .then((data) => {
          const ta = main.querySelector("#importJson");
          if (ta) ta.value = JSON.stringify(data, null, 2);
        })
        .catch(() => {
          alert("No se pudo cargar examples/import-proximas-ejemplo.json (¿servís la carpeta por HTTP?)");
        });
      return;
    }
    if (t.closest("#btnPastePreview")) {
      runPastePreview();
      return;
    }
    if (t.closest("#btnPasteImport")) {
      runPasteImport();
      return;
    }
    const parseAdj = t.closest("[data-parse-adjunto]");
    if (parseAdj) {
      const sid = parseAdj.getAttribute("data-parse-adjunto");
      const mode = parseAdj.getAttribute("data-parse-mode") || "append";
      if (sid) runParseAdjuntoText(sid, mode, parseAdj.closest(".stop-card"));
      return;
    }
    const pdfThen = t.closest("[data-pdf-then-parse]");
    if (pdfThen) {
      const sid = pdfThen.getAttribute("data-pdf-then-parse");
      const mode = pdfThen.getAttribute("data-pdf-parse-mode") || "append";
      const card = pdfThen.closest(".stop-card");
      const inp = card?.querySelector(".adjunto-pdf-input");
      if (inp && sid) {
        inp.setAttribute("data-pdf-after-load", mode);
        inp.click();
      }
      return;
    }
    const parseNotas = t.closest("[data-parse-notas]");
    if (parseNotas) {
      const sid = parseNotas.getAttribute("data-parse-notas");
      const s = findStop(sid || "");
      if (!s) return;
      const blob = notasBlobFromStop(s);
      if (!blob) {
        alert("No hay NOTAS / Consulta / Pedido en la fila importada.");
        return;
      }
      s._adjuntoPasteDraft = blob;
      const { paneles, accesorios, warnings } = parseLogisticaFromAdjuntoText(blob);
      if (!paneles.length && !accesorios.length) {
        alert((warnings && warnings[0]) || "No se detectaron paneles ni accesorios en NOTAS.");
        renderAll();
        return;
      }
      mergeParsedIntoStop(s, paneles, accesorios, "append");
      renderAll();
      alert(`Desde NOTAS: +${paneles.length} panel(es), +${accesorios.length} accesorio(s).`);
      return;
    }
    if (t.closest("#btnSaveDraft")) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            info: state.info,
            truckL: state.truckL,
            stops: state.stops,
            highlightStopId: state.highlightStopId,
            pickedClienteLabel: state.pickedClienteLabel,
          })
        );
        alert("Borrador guardado.");
      } catch (err) {
        alert(err.message || String(err));
      }
      return;
    }
    if (t.closest("#btnLoadDraft")) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        alert("No hay borrador.");
        return;
      }
      try {
        applyFullState(JSON.parse(raw));
        renderAll();
      } catch (err) {
        alert(err.message || String(err));
      }
      return;
    }
    if (t.closest("#btnPrint")) {
      window.print();
      return;
    }
    if (t.closest("#btnWaRemito")) {
      sendWhatsApp();
    }
  });
}

function importFromTextarea(replaceFull) {
  const ta = document.getElementById("importJson");
  if (!ta) return;
  const raw = ta.value.trim();
  if (!raw) throw new Error("Pegá JSON en el área de texto.");
  const data = JSON.parse(raw);
  if (replaceFull) {
    if (Array.isArray(data)) {
      resetDefaultCargoIds();
      state.stops = [];
      let orden = 1;
      for (const row of data) {
        state.stops.push(stopFromProximaRow(row, orden, COLORS));
        orden += 1;
      }
      renumberStops();
      return;
    }
    if (data && Array.isArray(data.data) && !data.stops) {
      resetDefaultCargoIds();
      state.stops = [];
      let orden = 1;
      for (const row of data.data) {
        state.stops.push(stopFromProximaRow(row, orden, COLORS));
        orden += 1;
      }
      renumberStops();
      return;
    }
    applyFullState(data);
    return;
  }
  let rows = [];
  if (Array.isArray(data)) rows = data;
  else if (data && Array.isArray(data.data)) rows = data.data;
  else throw new Error('Formato: array de filas o { "data": [...] }');
  resetDefaultCargoIds();
  let orden = state.stops.length + 1;
  for (const row of rows) {
    state.stops.push(stopFromProximaRow(row, orden, COLORS));
    orden += 1;
  }
  renumberStops();
}

function applyFullState(data) {
  if (!data || !Array.isArray(data.stops)) throw new Error('Estado completo: falta "stops".');
  state.info = { ...defaultInfo(), ...data.info };
  state.truckL = Number(data.truckL) || 8;
  state.stops = data.stops.map((s, i) => ({
    id: s.id || newId("stop"),
    orden: i + 1,
    cliente: s.cliente || "",
    telefono: s.telefono || "",
    direccion: s.direccion || "",
    zona: s.zona || "",
    linkUbicacion: s.linkUbicacion || "",
    linkAdjunto: s.linkAdjunto || "",
    cotizacionId: s.cotizacionId || "",
    color: s.color || COLORS[i % COLORS.length],
    paneles: Array.isArray(s.paneles) ? s.paneles : [],
    accesorios: Array.isArray(s.accesorios) ? s.accesorios : [],
    _adjuntoPasteDraft: s._adjuntoPasteDraft || "",
    rawSheet: s.rawSheet && typeof s.rawSheet === "object" ? s.rawSheet : {},
  }));
  renumberStops();
  state.highlightStopId = data.highlightStopId != null ? data.highlightStopId : null;
  state.pickedClienteLabel = data.pickedClienteLabel != null ? String(data.pickedClienteLabel) : "";
  state.scrollToStopOnce = null;
}

/** Texto de ubicación legible (dirección + zona), estilo remito/chat. */
function formatUbicacionLine(stop) {
  const d = String(stop.direccion || "").trim();
  const z = String(stop.zona || "").trim();
  if (d && z) return `${d} — ${z}`;
  return d || z || "—";
}

/** Largo en metros con coma decimal (UY), p. ej. 3.5 → 3,50 */
function formatLargoUY(m) {
  const n = Number(m);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(2).replace(".", ",");
}

/** Nombre de producto panel para transportista (sin precios). */
function panelProductLabel(p) {
  return `${p.tipo} — ${p.espesor} mm`.trim();
}

/**
 * Mensaje para WhatsApp: mismo tipo de datos que ve el transportista en el chat
 * (cliente, dirección, pedido, tabla producto/largo/cant, accesorios, mapa, contacto).
 */
function buildTransportistaWhatsAppMessage() {
  const cargo = getCargo();
  const header = [
    "🚚 *BMC — datos para transportista*",
    "(sin precios)",
    "",
    `*Envío:* ${state.info.numero || "—"}`,
    `*Fecha:* ${state.info.fecha || "—"}`,
    `*Transportista:* ${state.info.transportista || "—"}`,
    `*Patente:* ${state.info.patente || "—"}`,
    state.info.notas ? `*Notas:* ${state.info.notas}` : "",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const stopBlocks = state.stops.map((s) => {
    const mapUrl = mapsUrlFromStop(s.direccion, s.zona, s.linkUbicacion);
    const ubicacion = formatUbicacionLine(s);

    const lines = [
      "━━━━━━━━━━━━━━━━",
      `*PARADA ${s.orden}*`,
      "",
      `*Cliente:* ${s.cliente || "—"}`,
      `*Dirección:* ${ubicacion}`,
      `*Tel/cel:* ${s.telefono || "—"}`,
      "",
    ];

    if (s.paneles.length > 0) {
      lines.push("📋 *Paneles aislantes*");
      lines.push("Producto — Largos (m) — Cant.");
      s.paneles.forEach((p) => {
        const cant = Math.max(1, Number(p.cantidad) || 1);
        lines.push(`• ${panelProductLabel(p)} — ${formatLargoUY(p.longitud)} — *${cant}*`);
      });
      lines.push("");
    }

    if (s.accesorios.length > 0) {
      const accs = s.accesorios.filter((a) => String(a.descr || "").trim());
      if (accs.length > 0) {
        lines.push("🔩 *Accesorios* (sin largo en planilla → indicar en descripción si aplica)");
        accs.forEach((a) => {
          const c = Math.max(1, Number(a.cantidad) || 1);
          lines.push(`• ${String(a.descr).trim()} — *${c}*`);
        });
        lines.push("");
      }
    }

    lines.push("📍 *Datos logísticos*");
    lines.push(`*Pedido Nº:* ${s.cotizacionId || "—"}`);
    lines.push(`*Ubicación:* ${ubicacion}`);
    lines.push(mapUrl ? `🗺 *Mapa:* ${mapUrl}` : "🗺 *Mapa:* (completar link o dirección)");
    lines.push(`*Contacto:* ${s.telefono || "—"}`);
    if (String(s.linkAdjunto || "").trim()) {
      lines.push(`📎 *Cotización / PDF / foto:* ${String(s.linkAdjunto).trim()}`);
    }

    const pkgs = s.paneles.flatMap((p) => buildPkgs(s, p));
    if (pkgs.length > 0) {
      lines.push("");
      lines.push("_Referencia carga (paquetes):_");
      pkgs.forEach((pk) => {
        lines.push(`  · ${pk.n}× ${pk.tipo} ${pk.esp}mm / ${formatLargoUY(pk.len)} m`);
      });
    }

    return lines.join("\n");
  });

  const footer = [
    "",
    "━━━━━━━━━━━━━━━━",
    `*Resumen carga:* ${cargo.placed.length} pkgs · ${state.stops.length} parada(s) · camión ${state.truckL} m`,
  ].join("\n");

  return `${header}\n${stopBlocks.join("\n\n")}${footer}`;
}

function sendWhatsApp() {
  const msg = buildTransportistaWhatsAppMessage();
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
}

function renderAll() {
  ensureMainDelegation();
  const rulesBody = document.getElementById("rulesBody");
  if (rulesBody) rulesBody.innerHTML = renderRulesBody();
  renderTabs();
  renderTruckSelect();
  renderClientePlanillaPicker();
  renderHero();
  renderWarnings();
  renderMain();
  if (state.view === "form" && state.scrollToStopOnce) {
    const sid = state.scrollToStopOnce;
    state.scrollToStopOnce = null;
    requestAnimationFrame(() => {
      const el = queryStopCardEl(sid);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
}

document.getElementById("tabs")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view]");
  if (!btn) return;
  state.view = btn.getAttribute("data-view");
  renderAll();
});

document.getElementById("truckL")?.addEventListener("change", (e) => {
  state.truckL = Number(e.target.value);
  renderHero();
  renderWarnings();
  renderMain();
});

document.getElementById("clientePlanillaPicker")?.addEventListener("change", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLSelectElement)) return;
  const label = decodePickerValue(t.value);
  state.pickedClienteLabel = label;
  if (!label) {
    state.highlightStopId = null;
    state.scrollToStopOnce = null;
  } else {
    const hit = findFirstStopByClienteLabel(state.stops, label);
    state.highlightStopId = hit ? hit.id : null;
    state.scrollToStopOnce = hit ? hit.id : null;
  }
  renderAll();
});

document.getElementById("btnWhatsApp")?.addEventListener("click", sendWhatsApp);

initState();
renderAll();
