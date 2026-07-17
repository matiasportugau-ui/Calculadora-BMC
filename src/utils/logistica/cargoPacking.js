/**
 * Pure cargo packing for BMC logistics / freight quoting.
 * Shared by fleteEngine; aligned with /logistica + SDD-CALCULADORA-FLETES.
 *
 * Legal stack height for freight capacity: 2.4 m (SDD). UI logistica may still
 * display MAX_H=2.5 in places — freight quoting uses FREIGHT_MAX_H.
 */

export const FREIGHT_MAX_H = 2.4;
export const ROW_W = 1.2;
export const STANDARD_BED_M = 8;
export const LONG_BED_M = 13; // mid of 12–14 m range

/** Max panels per closed package by thickness (mm) — SDD §7.2 / interview. */
export const MAX_P = {
  40: 12,
  50: 10,
  60: 10,
  80: 8,
  100: 8,
  150: 6,
  200: 5,
  250: 4,
};

const DEFAULT_EXTRA_M = 0.02; // +2 cm per panel (ISODEC / ISOPARED / ISODEC family)
const ISOROOF_NERVIO_M = 0.04; // +4 cm per inverted pair

/**
 * @param {string} tipo
 * @returns {boolean}
 */
export function isIsoroofTipo(tipo) {
  return /isoroof/i.test(String(tipo || ""));
}

/**
 * Stack height (m) for n panels of thickness espMm.
 * ISODEC/etc: n × (esp + 2 cm).
 * ISOROOF inverted pairs: each 2 panels → esp1+esp2+4 cm (same esp → 2e+4cm).
 */
export function packageHeightM(tipo, espMm, n) {
  const e = Math.max(0, Number(espMm) || 0) / 1000;
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (count <= 0) return 0;
  if (isIsoroofTipo(tipo)) {
    const pairs = Math.floor(count / 2);
    const rem = count % 2;
    const pairH = e + e + ISOROOF_NERVIO_M;
    const remH = rem ? e + ISOROOF_NERVIO_M : 0;
    return +(pairs * pairH + remH).toFixed(4);
  }
  return +(count * (e + DEFAULT_EXTRA_M)).toFixed(4);
}

/**
 * @param {{ id?: string, orden?: number, cliente?: string }} stop
 * @param {{ tipo: string, espesor: number, longitud: number, cantidad: number, id?: string }} panel
 * @param {() => string} [uid]
 */
export function buildPkgs(stop, panel, uid = () => Math.random().toString(36).slice(2, 10)) {
  const esp = Math.round(Number(panel.espesor) || 0);
  const max = MAX_P[esp] || 8;
  let rem = Math.max(0, Math.floor(Number(panel.cantidad) || 0));
  const pkgs = [];
  let chunkIdx = 0;
  while (rem > 0) {
    const n = Math.min(rem, max);
    pkgs.push({
      id: uid(),
      chunkIdx,
      sId: stop?.id || "s0",
      sOrd: stop?.orden ?? 1,
      sCli: stop?.cliente || "",
      tipo: String(panel.tipo || "PANEL"),
      esp,
      len: Math.max(0, Number(panel.longitud) || 0),
      n,
      h: packageHeightM(panel.tipo, esp, n),
    });
    chunkIdx += 1;
    rem -= n;
  }
  return pkgs;
}

/**
 * Place packages into rows A/B optimizing height (shorter stack first).
 * @param {Array<{ id?: string, orden?: number, cliente?: string, paneles: Array<{ tipo: string, espesor: number, longitud: number, cantidad: number }> }>} stops
 * @param {number} trL bed length (m)
 * @param {{ maxH?: number }} [opts]
 */
export function placeCargo(stops, trL, opts = {}) {
  const maxH = opts.maxH != null ? Number(opts.maxH) : FREIGHT_MAX_H;
  const bed = Math.max(1, Number(trL) || STANDARD_BED_M);
  const all = (stops || []).flatMap((s) =>
    (s.paneles || []).flatMap((p) => buildPkgs(s, p))
  );
  if (!all.length) {
    return {
      placed: [],
      rowH: [0, 0],
      filasUsadas: 0,
      largoMax: 0,
      warns: [],
      cabe: true,
      maxH,
      bedM: bed,
    };
  }

  // Expand into placeable chunks; split packages further if a full pack exceeds remaining height.
  const queue = [...all].sort((a, b) => b.len - a.len || b.h - a.h);
  const rowH = [0, 0];
  const placed = [];
  const warns = new Set();
  let largoMax = 0;

  while (queue.length) {
    const pkg = queue.shift();
    largoMax = Math.max(largoMax, pkg.len);
    if (pkg.len > bed + 0.001) {
      warns.add(`Panel ${pkg.len}m supera carrocería ${bed}m`);
    }

    let row = rowH[0] <= rowH[1] ? 0 : 1;
    let room = maxH - rowH[row];
    const alt = 1 - row;
    const roomAlt = maxH - rowH[alt];
    if (pkg.h > room + 0.001 && roomAlt >= room) {
      row = alt;
      room = roomAlt;
    }

    if (pkg.h <= room + 0.001) {
      placed.push({ ...pkg, row, zBase: rowH[row], ov: false });
      rowH[row] += pkg.h;
      continue;
    }

    // Split package into smaller stacks that fit remaining height (optimal fill).
    if (pkg.n > 1) {
      let nFit = pkg.n - 1;
      while (nFit >= 1) {
        const hFit = packageHeightM(pkg.tipo, pkg.esp, nFit);
        if (hFit <= room + 0.001 || hFit <= roomAlt + 0.001) break;
        nFit -= 1;
      }
      if (nFit >= 1) {
        const hFit = packageHeightM(pkg.tipo, pkg.esp, nFit);
        const useRow = hFit <= room + 0.001 ? row : alt;
        placed.push({
          ...pkg,
          id: `${pkg.id}_a`,
          n: nFit,
          h: hFit,
          row: useRow,
          zBase: rowH[useRow],
          ov: false,
        });
        rowH[useRow] += hFit;
        queue.unshift({
          ...pkg,
          id: `${pkg.id}_b`,
          n: pkg.n - nFit,
          h: packageHeightM(pkg.tipo, pkg.esp, pkg.n - nFit),
        });
        continue;
      }
    }

    // Single panel taller than maxH, or no room left on either row.
    if (Math.min(room, roomAlt) < 0.001) {
      warns.add(`Estiba supera ${maxH}m — reorganizar / otro vehículo`);
      placed.push({ ...pkg, row, zBase: rowH[row], ov: true });
      rowH[row] += pkg.h;
    } else {
      warns.add(`Estiba supera ${maxH}m — reorganizar / otro vehículo`);
      placed.push({ ...pkg, row, zBase: rowH[row], ov: true });
      rowH[row] += pkg.h;
    }
  }

  const filasUsadas = (rowH[0] > 0.001 ? 1 : 0) + (rowH[1] > 0.001 ? 1 : 0);
  const heightOverflow = rowH.some((h) => h > maxH + 0.001) || placed.some((p) => p.ov);
  const lengthOverflow = largoMax > bed + 0.001;
  const cabe = !heightOverflow && !lengthOverflow && ![...warns].some((w) => /supera|otro vehículo/i.test(w));

  return {
    placed,
    rowH,
    filasUsadas,
    largoMax,
    warns: [...warns],
    cabe,
    maxH,
    bedM: bed,
  };
}

/**
 * Classify vehicle / occupancy for freight tariffs.
 * @param {ReturnType<typeof placeCargo>} pack8
 * @param {ReturnType<typeof placeCargo>|null} packLong
 */
export function classifyVehicleOccupancy(pack8, packLong = null) {
  const largoMax = pack8?.largoMax || 0;
  if (largoMax > STANDARD_BED_M + 0.001) {
    return {
      vehicle: "remolque",
      filasUsadas: pack8.filasUsadas,
      largoMax,
      bedM: STANDARD_BED_M,
      pack: pack8,
      needsSpecialReview: false,
    };
  }
  if (pack8?.cabe) {
    return {
      vehicle: pack8.filasUsadas <= 1 ? "estandar_1_fila" : "estandar_2_filas",
      filasUsadas: pack8.filasUsadas,
      largoMax,
      bedM: STANDARD_BED_M,
      pack: pack8,
      needsSpecialReview: false,
    };
  }
  if (packLong?.cabe) {
    return {
      vehicle: "camion_largo",
      filasUsadas: packLong.filasUsadas,
      largoMax: packLong.largoMax,
      bedM: LONG_BED_M,
      pack: packLong,
      needsSpecialReview: false,
    };
  }
  return {
    vehicle: "especial",
    filasUsadas: pack8?.filasUsadas || 0,
    largoMax,
    bedM: STANDARD_BED_M,
    pack: pack8,
    needsSpecialReview: true,
  };
}
