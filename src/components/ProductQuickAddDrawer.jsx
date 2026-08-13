// ═══════════════════════════════════════════════════════════════════════════
// ProductQuickAddDrawer — compact B2B table-list + Liquid Glass chrome
// Plan v2 + quality pass: list density, typed visual stages, a11y, perf.
// Glass on chrome only; solid rows for legibility.
// ═══════════════════════════════════════════════════════════════════════════

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from "react";
import { rowPriceHint } from "../utils/productCatalogIndex.js";
import { filterAndRankProducts } from "../utils/productSearch.js";
import {
  resolveProductVisual,
  splitProductLabel,
} from "../utils/productCatalogImages.js";
import "../styles/bmc-quickadd-glass.css";

const STORAGE_KEY = "bmc_quickadd_open";
const Z = 9997;
const FLASH_MS = 900;

const CATEGORIES = [
  { id: "ALL", label: "Todos" },
  { id: "PANELES", label: "Paneles" },
  { id: "PERFILERÍA", label: "Perfilería" },
  { id: "TORNILLERÍA", label: "Tornillería" },
  { id: "SELLADORES", label: "Selladores" },
];

function readStoredOpen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

const fmtUsd = (n) => `US$ ${(Number(n) || 0).toFixed(2)}`;

/** Simple silhouettes per visual group (identity when no unique photo). */
function GroupIcon({ group }) {
  const common = {
    viewBox: "0 0 48 48",
    width: 22,
    height: 22,
    "aria-hidden": true,
    fill: "none",
  };
  switch (group) {
    case "panel":
      return (
        <svg {...common}>
          <rect x="6" y="14" width="36" height="22" rx="2" fill="currentColor" opacity="0.35" />
          <path d="M6 28l8-6 8 5 10-9 10 10" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "perfil_u":
      return (
        <svg {...common}>
          <path d="M12 10v28h6V16h12v22h6V10H12z" fill="currentColor" opacity="0.85" />
        </svg>
      );
    case "perfil_g2":
      return (
        <svg {...common}>
          <path d="M8 36V12h8l4 10 4-10h8v24h-6V22l-6 12h-4L16 22v14H8z" fill="currentColor" opacity="0.85" />
        </svg>
      );
    case "canalon":
      return (
        <svg {...common}>
          <path d="M6 18h36v8c0 6-8 12-18 12S6 32 6 26v-8z" fill="currentColor" opacity="0.75" />
          <path d="M10 18V14h28v4" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "gotero":
      return (
        <svg {...common}>
          <path d="M8 14h32l-4 20H12L8 14z" fill="currentColor" opacity="0.75" />
          <path d="M14 34v6M24 34v6M34 34v6" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "cumbrera":
      return (
        <svg {...common}>
          <path d="M6 30L24 10l18 20H6z" fill="currentColor" opacity="0.75" />
          <path d="M10 30v6h28v-6" fill="currentColor" opacity="0.45" />
        </svg>
      );
    case "babeta":
      return (
        <svg {...common}>
          <path d="M8 12h28v6H14v18H8V12z" fill="currentColor" opacity="0.8" />
        </svg>
      );
    case "soporte":
      return (
        <svg {...common}>
          <path d="M10 10h8v28h-8zM18 30h20v8H18z" fill="currentColor" opacity="0.8" />
        </svg>
      );
    case "tornillo":
      return (
        <svg {...common}>
          <path d="M22 6h4v14l8 8-3 3-8-8-8 8-3-3 8-8V6z" fill="currentColor" opacity="0.9" />
          <circle cx="24" cy="38" r="5" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "arandela":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="3" fill="currentColor" opacity="0.25" />
          <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.85" />
        </svg>
      );
    case "anclaje":
      return (
        <svg {...common}>
          <path d="M22 6h4v22l10 12h-6l-6-8-6 8h-6l10-12V6z" fill="currentColor" opacity="0.85" />
        </svg>
      );
    case "taco":
      return (
        <svg {...common}>
          <rect x="16" y="8" width="16" height="32" rx="4" fill="currentColor" opacity="0.8" />
          <path d="M20 14h8M20 20h8M20 26h8" stroke="#fff" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );
    case "varilla":
      return (
        <svg {...common}>
          <path d="M22 4h4v40h-4z" fill="currentColor" opacity="0.85" />
          <path d="M18 10h12M18 18h12M18 26h12M18 34h12" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );
    case "tuerca":
      return (
        <svg {...common}>
          <path d="M24 8l12 7v14l-12 7-12-7V15l12-7z" fill="currentColor" opacity="0.8" />
          <circle cx="24" cy="24" r="5" fill="#fff" opacity="0.35" />
        </svg>
      );
    case "remache":
      return (
        <svg {...common}>
          <circle cx="24" cy="16" r="8" fill="currentColor" opacity="0.9" />
          <path d="M20 22h8v18h-8z" fill="currentColor" opacity="0.7" />
        </svg>
      );
    case "herramienta":
      return (
        <svg {...common}>
          <path d="M14 34l16-16 4 4-16 16H14v-4z" fill="currentColor" opacity="0.85" />
          <path d="M28 10l8 8-4 4-8-8 4-4z" fill="currentColor" opacity="0.6" />
        </svg>
      );
    case "silicona":
    case "espuma":
      return (
        <svg {...common}>
          <rect x="18" y="6" width="12" height="10" rx="2" fill="currentColor" opacity="0.9" />
          <path d="M16 16h16v24a3 3 0 01-3 3H19a3 3 0 01-3-3V16z" fill="currentColor" opacity="0.55" />
        </svg>
      );
    case "cinta":
    case "membrana":
      return (
        <svg {...common}>
          <rect x="8" y="16" width="32" height="16" rx="3" fill="currentColor" opacity="0.75" />
          <circle cx="24" cy="24" r="5" fill="#fff" opacity="0.35" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="10" y="10" width="28" height="28" rx="4" fill="currentColor" opacity="0.55" />
        </svg>
      );
  }
}

const ProductThumb = memo(function ProductThumb({ row, already = 0, visual }) {
  const [broken, setBroken] = useState(false);
  const src = visual?.src || null;

  // Reset error state when image URL changes
  useEffect(() => {
    setBroken(false);
  }, [src]);

  const showImg = src && !broken;

  return (
    <div className="bmc-qa__thumb" title={row.label}>
      {showImg ? (
        <img
          src={src}
          alt={row.label || ""}
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className="bmc-qa__thumb-ph"
          style={{
            background: `linear-gradient(145deg, ${visual.tone} 0%, ${visual.tone}cc 55%, ${visual.tone}99 100%)`,
          }}
          role="img"
          aria-label={row.label || visual.group}
        >
          <GroupIcon group={visual.group} />
          <span className="bmc-qa__thumb-code">{visual.shortCode}</span>
        </div>
      )}
      {already > 0 && (
        <span className="bmc-qa__in-quote" title={`${already} en presupuesto`}>
          ✓{already}
        </span>
      )}
    </div>
  );
});

export default function ProductQuickAddDrawer({
  catalogIndex = [],
  currentQty = { perfilQty: {}, fijQty: {}, sellQty: {} },
  onAddPerfil,
  onAddFijacion,
  onAddSellador,
  onAddPanel,
  listaPrecios = "web",
}) {
  const [open, setOpen] = useState(readStoredOpen);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let last = window.scrollY || 0;
    const onScroll = () => {
      const y = window.scrollY || 0;
      document.documentElement.classList.toggle("bmc-fabs-hide", y > last && y > 20);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [qtyDraft, setQtyDraft] = useState({});
  const [flash, setFlash] = useState(null);

  const searchRef = useRef(null);
  const fabRef = useRef(null);
  const flashTimerRef = useRef(null);
  const prevOpenRef = useRef(open);

  // Persist open state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [open]);

  // Escape, body scroll lock, focus restore
  useEffect(() => {
    if (!open) {
      if (prevOpenRef.current && fabRef.current) {
        try {
          fabRef.current.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
      prevOpenRef.current = open;
      return undefined;
    }
    prevOpenRef.current = open;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);

    // Focus search after paint
    const t = requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(t);
    };
  }, [open]);

  // Clear flash timer on unmount
  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  // Precompute display fields once per catalog + price list
  const enriched = useMemo(() => {
    return catalogIndex.map((row) => {
      const visual = resolveProductVisual(row);
      const labels = splitProductLabel(row);
      const price = rowPriceHint(row, listaPrecios);
      return { row, visual, labels, price };
    });
  }, [catalogIndex, listaPrecios]);

  const filtered = useMemo(() => {
    const ranked = filterAndRankProducts(
      enriched.map((e) => e.row),
      query,
      { category },
    );
    const byId = new Map(enriched.map((e) => [e.row.id, e]));
    return ranked.map((row) => byId.get(row.id)).filter(Boolean);
  }, [enriched, query, category]);

  const qtyOf = useCallback(
    (id) => {
      const v = qtyDraft[id];
      return v == null ? 1 : v;
    },
    [qtyDraft],
  );

  const setQty = useCallback((id, v, isPanel) => {
    setQtyDraft((d) => {
      const num = Number(v);
      const clean = isPanel
        ? Math.max(0.1, Number.isFinite(num) ? num : 1)
        : Math.max(1, Math.round(Number.isFinite(num) ? num : 1));
      return { ...d, [id]: clean };
    });
  }, []);

  const doFlash = useCallback((id) => {
    setFlash(id);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlash((cur) => (cur === id ? null : cur));
      flashTimerRef.current = null;
    }, FLASH_MS);
  }, []);

  const handleAdd = useCallback(
    (row) => {
      const n = qtyOf(row.id);
      if (row.addBy === "perfilQty") onAddPerfil?.(row.key, n);
      else if (row.addBy === "fijQty") onAddFijacion?.(row.key, n);
      else if (row.addBy === "sellQty") onAddSellador?.(row.key, n);
      else if (row.addBy === "panelLine") {
        onAddPanel?.({
          familia: row.familia,
          espesor: row.espesor,
          color: row.colorDefault,
          m2: n,
        });
      }
      doFlash(row.id);
    },
    [qtyOf, onAddPerfil, onAddFijacion, onAddSellador, onAddPanel, doFlash],
  );

  const inQuoteQty = useCallback(
    (row) => {
      if (row.addBy === "perfilQty") return currentQty.perfilQty?.[row.key] || 0;
      if (row.addBy === "fijQty") return currentQty.fijQty?.[row.key] || 0;
      if (row.addBy === "sellQty") return currentQty.sellQty?.[row.key] || 0;
      return 0;
    },
    [currentQty],
  );

  const addedCount = useMemo(() => {
    const count = (m) => Object.values(m || {}).filter((v) => Number(v) > 0).length;
    return (
      count(currentQty.perfilQty) +
      count(currentQty.fijQty) +
      count(currentQty.sellQty)
    );
  }, [currentQty]);

  const categoryLabel =
    category === "ALL"
      ? null
      : CATEGORIES.find((c) => c.id === category)?.label || category;

  return (
    <div className="bmc-qa">
      <button
        ref={fabRef}
        type="button"
        className="bmc-qa__fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="bmc-quickadd-panel"
        title={open ? "Cerrar agregar producto" : "Agregar producto al presupuesto"}
        style={{ zIndex: Z }}
      >
        <span className="bmc-qa__fab-icon" aria-hidden>
          ＋
        </span>
        Agregar producto
        {addedCount > 0 && (
          <span className="bmc-qa__fab-badge" aria-label={`${addedCount} agregados`}>
            {addedCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="bmc-qa__backdrop"
            onClick={() => setOpen(false)}
            style={{ zIndex: Z }}
            aria-hidden
          />
          <aside
            id="bmc-quickadd-panel"
            className="bmc-qa__drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bmc-quickadd-title"
            style={{ zIndex: Z + 1 }}
          >
            <header className="bmc-qa__header">
              <h2 id="bmc-quickadd-title" className="bmc-qa__title">
                Agregar producto
              </h2>
              <button
                type="button"
                className="bmc-qa__close"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                title="Cerrar"
              >
                ✕
              </button>
            </header>

            <div className="bmc-qa__controls">
              <input
                ref={searchRef}
                type="search"
                className="bmc-qa__search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o SKU…"
                autoComplete="off"
                enterKeyHint="search"
              />
              <div className="bmc-qa__chips" role="tablist" aria-label="Categoría">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={category === c.id}
                    className={`bmc-qa__chip${category === c.id ? " bmc-qa__chip--active" : ""}`}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="bmc-qa__meta" aria-live="polite">
                {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
                {categoryLabel ? ` · ${categoryLabel}` : ""}
                {addedCount > 0 ? ` · ${addedCount} en el presupuesto` : ""}
              </div>
            </div>

            <div className="bmc-qa__list" role="list">
              {filtered.length === 0 && (
                <p className="bmc-qa__empty">
                  Sin coincidencias. Probá otro término o categoría.
                </p>
              )}
              {filtered.map(({ row, visual, labels, price }) => {
                const already = inQuoteQty(row);
                const isPanel = row.addBy === "panelLine";
                const unit = row.unidad || (isPanel ? "m²" : "unid");

                return (
                  <article
                    key={row.id}
                    className={`bmc-qa__row${flash === row.id ? " bmc-qa__row--flash" : ""}`}
                    role="listitem"
                  >
                    <ProductThumb row={row} already={already} visual={visual} />

                    <div className="bmc-qa__info">
                      <div className="bmc-qa__primary" title={row.label}>
                        {labels.primary || row.label}
                      </div>
                      {labels.secondary ? (
                        <div className="bmc-qa__secondary" title={labels.secondary}>
                          {labels.secondary}
                        </div>
                      ) : row.sku ? (
                        <div className="bmc-qa__secondary">SKU {row.sku}</div>
                      ) : null}
                      <div className="bmc-qa__price-line">
                        {fmtUsd(price)}{" "}
                        <span>
                          / {unit}
                          {isPanel ? " · cantidad en m²" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="bmc-qa__actions">
                      <div className="bmc-qa__stepper">
                        <button
                          type="button"
                          aria-label="Menos"
                          onClick={() =>
                            setQty(row.id, qtyOf(row.id) - (isPanel ? 0.5 : 1), isPanel)
                          }
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={isPanel ? 0.1 : 1}
                          step={isPanel ? 0.5 : 1}
                          value={qtyOf(row.id)}
                          onChange={(e) => setQty(row.id, e.target.value, isPanel)}
                          aria-label={`Cantidad de ${row.label}${isPanel ? " en m²" : ""}`}
                        />
                        <button
                          type="button"
                          aria-label="Más"
                          onClick={() =>
                            setQty(row.id, qtyOf(row.id) + (isPanel ? 0.5 : 1), isPanel)
                          }
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="bmc-qa__add"
                        onClick={() => handleAdd(row)}
                      >
                        Agregar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
