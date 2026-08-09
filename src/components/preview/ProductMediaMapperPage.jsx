/**
 * Visual Product Media Mapper — /preview/product-media-mapper
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import catalogData from "../../data/product-media/product-media-catalog.json" with { type: "json" };
import bakedLinks from "../../data/product-media/product-media-links.json" with { type: "json" };
import {
  listBorderMediaKeys,
  listPanelMediaKeys,
  listFijacionMediaKeys,
  listSelladorMediaKeys,
  BORDER_FAMILIA_CHIPS,
} from "../../data/product-media/calcMediaKeys.js";
import {
  resolveBorderMedia,
  resolvePanelMedia,
  resolveAccessoryMedia,
  resolveFromLink,
} from "../../data/product-media/productMediaResolve.js";
import "../../styles/product-media-mapper.css";

const LS_KEY = "bmc_product_media_links_draft_v1";
const DOMAINS = [
  { id: "borders", label: "Accesorios" },
  { id: "panels", label: "Paneles" },
  { id: "fijaciones", label: "Tornillería" },
  { id: "selladores", label: "Selladores" },
];

const deepClone = (o) => JSON.parse(JSON.stringify(o));

function loadDraft() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return deepClone(bakedLinks);
    const j = JSON.parse(raw);
    if (j?.borders) return j;
  } catch {
    /* ignore */
  }
  return deepClone(bakedLinks);
}

function statusOfLink(link) {
  if (!link || (!link.handle && !link.imageSrc)) return "bad";
  if (link.status === "suggested") return "warn";
  return "ok";
}

function getLinkFromDraft(draft, domain, key, familia) {
  if (domain === "borders") {
    const e = draft.borders?.[key];
    if (!e) return null;
    if (familia && e.byFamilia?.[familia]) return e.byFamilia[familia];
    return e.default || null;
  }
  if (domain === "panels") return draft.panels?.[key] || null;
  if (domain === "fijaciones") return draft.fijaciones?.[key] || null;
  if (domain === "selladores") return draft.selladores?.[key] || null;
  return null;
}

function setLinkInDraft(draft, domain, key, familia, link) {
  const next = deepClone(draft);
  if (domain === "borders") {
    if (!next.borders) next.borders = {};
    if (!next.borders[key]) next.borders[key] = {};
    if (familia) {
      if (!next.borders[key].byFamilia) next.borders[key].byFamilia = {};
      if (link) next.borders[key].byFamilia[familia] = link;
      else delete next.borders[key].byFamilia[familia];
    } else if (link) next.borders[key].default = link;
    else delete next.borders[key].default;
  } else {
    const bucket =
      domain === "panels" ? "panels" : domain === "selladores" ? "selladores" : "fijaciones";
    if (!next[bucket]) next[bucket] = {};
    if (link) next[bucket][key] = link;
    else delete next[bucket][key];
  }
  next.updatedAt = new Date().toISOString();
  next.note = "Edited in product media mapper";
  return next;
}

export default function ProductMediaMapperPage() {
  const [draft, setDraft] = useState(loadDraft);
  const [domain, setDomain] = useState("borders");
  const [keyFilter, setKeyFilter] = useState("");
  const [selectedKey, setSelectedKey] = useState("babeta_empotrar");
  const [familia, setFamilia] = useState("");
  const [shopQuery, setShopQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customUrl, setCustomUrl] = useState("");
  const [toast, setToast] = useState("");
  const products = catalogData.products || [];

  const keys = useMemo(() => {
    const all =
      domain === "borders"
        ? listBorderMediaKeys()
        : domain === "panels"
          ? listPanelMediaKeys()
          : domain === "selladores"
            ? listSelladorMediaKeys()
            : listFijacionMediaKeys();
    const q = keyFilter.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (k) => k.key.toLowerCase().includes(q) || k.label.toLowerCase().includes(q),
    );
  }, [domain, keyFilter]);

  useEffect(() => {
    if (!keys.find((k) => k.key === selectedKey) && keys[0]) setSelectedKey(keys[0].key);
  }, [keys, selectedKey]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);

  const currentLink = useMemo(
    () => getLinkFromDraft(draft, domain, selectedKey, familia || undefined),
    [draft, domain, selectedKey, familia],
  );

  const resolved = useMemo(() => {
    if (currentLink) return resolveFromLink(currentLink);
    if (domain === "borders") {
      return resolveBorderMedia({ borderId: selectedKey, familia: familia || undefined });
    }
    if (domain === "panels") return resolvePanelMedia({ familia: selectedKey });
    if (domain === "selladores") {
      return resolveAccessoryMedia({ kind: "sellador", key: selectedKey });
    }
    return resolveAccessoryMedia({ kind: "fijacion", key: selectedKey });
  }, [currentLink, domain, selectedKey, familia]);

  const stats = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let bad = 0;
    const all = [
      ...listBorderMediaKeys(),
      ...listPanelMediaKeys(),
      ...listFijacionMediaKeys(),
      ...listSelladorMediaKeys(),
    ];
    for (const item of all) {
      const s = statusOfLink(getLinkFromDraft(draft, item.domain, item.key, undefined));
      if (s === "ok") ok += 1;
      else if (s === "warn") warn += 1;
      else bad += 1;
    }
    return { ok, warn, bad, total: all.length };
  }, [draft]);

  const shopFiltered = useMemo(() => {
    const q = shopQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = `${p.title} ${p.handle} ${(p.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, shopQuery]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const applyLink = useCallback(
    (link) => {
      setDraft((d) => setLinkInDraft(d, domain, selectedKey, familia || undefined, link));
      flash("Vinculado");
    },
    [domain, selectedKey, familia],
  );

  const linkProductPrimary = (product) => {
    applyLink({
      handle: product.handle,
      imageSrc: product.primaryImage || product.images?.[0]?.src || null,
      title: product.title,
      status: "linked",
    });
    setSelectedProduct(product);
  };

  const linkProductImage = (product, src) => {
    applyLink({
      handle: product.handle,
      imageSrc: src,
      title: product.title,
      status: "linked",
    });
    setSelectedProduct(product);
  };

  const clearLink = () => {
    setDraft((d) => setLinkInDraft(d, domain, selectedKey, familia || undefined, null));
    flash("Limpiado");
  };

  const applyCustomUrl = () => {
    const url = customUrl.trim();
    if (!url) return;
    applyLink({
      handle: currentLink?.handle || null,
      imageSrc: url,
      title: currentLink?.title || selectedKey,
      status: "linked",
    });
  };

  const exportJson = () => {
    const blob = new Blob([`${JSON.stringify(draft, null, 2)}\n`], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "product-media-links.json";
    a.click();
    URL.revokeObjectURL(a.href);
    flash("Descargado");
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
      flash("JSON copiado");
    } catch {
      flash("No se pudo copiar");
    }
  };

  const resetBaked = () => {
    if (!window.confirm("¿Reset al archivo del repo?")) return;
    localStorage.removeItem(LS_KEY);
    setDraft(deepClone(bakedLinks));
    flash("Restaurado");
  };

  const selectedMeta = keys.find((k) => k.key === selectedKey);

  return (
    <div className="pmm">
      <header className="pmm__top">
        <h1 className="pmm__title">Product Media Mapper</h1>
        <div className="pmm__stats">
          <span>
            <b style={{ color: "var(--pmm-ok)" }}>{stats.ok}</b> OK
          </span>
          <span>
            <b style={{ color: "var(--pmm-warn)" }}>{stats.warn}</b> revisar
          </span>
          <span>
            <b style={{ color: "var(--pmm-bad)" }}>{stats.bad}</b> sin mapa
          </span>
          <span>
            / {stats.total} · {products.length} Shopify
          </span>
          {toast ? (
            <span style={{ color: "var(--pmm-accent)", fontWeight: 700 }}>{toast}</span>
          ) : null}
        </div>
        <div className="pmm__actions">
          <button type="button" className="pmm__btn" onClick={copyJson}>
            Copiar JSON
          </button>
          <button type="button" className="pmm__btn pmm__btn--primary" onClick={exportJson}>
            Descargar links
          </button>
          <button type="button" className="pmm__btn pmm__btn--danger" onClick={resetBaked}>
            Reset repo
          </button>
        </div>
      </header>

      <div className="pmm__body">
        <div className="pmm__col">
          <div className="pmm__col-head">Variables calc</div>
          <div className="pmm__tabs">
            {DOMAINS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={domain === d.id ? "pmm__tab pmm__tab--on" : "pmm__tab"}
                onClick={() => {
                  setDomain(d.id);
                  setFamilia("");
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <input
            className="pmm__search"
            placeholder="Filtrar…"
            value={keyFilter}
            onChange={(e) => setKeyFilter(e.target.value)}
          />
          <div className="pmm__list">
            {keys.map((item) => {
              const link = getLinkFromDraft(draft, item.domain, item.key, undefined);
              const st = statusOfLink(link);
              return (
                <button
                  key={item.key}
                  type="button"
                  className={selectedKey === item.key ? "pmm__key pmm__key--on" : "pmm__key"}
                  onClick={() => setSelectedKey(item.key)}
                >
                  {link?.imageSrc ? (
                    <img className="pmm__key-thumb" src={link.imageSrc} alt="" />
                  ) : (
                    <div className="pmm__key-ph">—</div>
                  )}
                  <div>
                    <div className="pmm__key-label">{item.label}</div>
                    <div className="pmm__key-sub">{item.key}</div>
                  </div>
                  <span className={`pmm__dot pmm__dot--${st}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="pmm__col">
          <div className="pmm__col-head">Mapeo actual</div>
          <div className="pmm__center">
            <div className="pmm__key-sub">
              {domain} · <code>{selectedKey}</code>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
              {selectedMeta?.label || selectedKey}
            </div>
            {domain === "borders" && (
              <div className="pmm__chips">
                <button
                  type="button"
                  className={!familia ? "pmm__chip pmm__chip--on" : "pmm__chip"}
                  onClick={() => setFamilia("")}
                >
                  Default
                </button>
                {BORDER_FAMILIA_CHIPS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={familia === f ? "pmm__chip pmm__chip--on" : "pmm__chip"}
                    onClick={() => setFamilia(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            {resolved.primaryImage ? (
              <img className="pmm__preview" src={resolved.primaryImage} alt={resolved.title} />
            ) : (
              <div className="pmm__preview-empty">Sin imagen — elegí producto a la derecha</div>
            )}
            <div className="pmm__meta">
              <div>
                <strong>{resolved.title || "—"}</strong>
              </div>
              <div>
                handle: <code>{resolved.handle || "—"}</code>
              </div>
              {resolved.url ? (
                <div style={{ marginTop: 6 }}>
                  <a href={resolved.url} target="_blank" rel="noreferrer">
                    Abrir tienda ↗
                  </a>
                </div>
              ) : null}
            </div>
            {resolved.images?.length > 1 && (
              <div className="pmm__gallery">
                {resolved.images.map((img) => (
                  <img
                    key={img.src}
                    src={img.src}
                    alt=""
                    className={img.src === resolved.primaryImage ? "on" : ""}
                    onClick={() =>
                      applyLink({
                        handle: resolved.handle,
                        imageSrc: img.src,
                        title: resolved.title,
                        status: "linked",
                      })
                    }
                  />
                ))}
              </div>
            )}
            <div className="pmm__custom">
              <input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="URL custom…"
              />
              <button type="button" className="pmm__btn" onClick={applyCustomUrl}>
                Usar URL
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="pmm__btn pmm__btn--danger" onClick={clearLink}>
                Quitar vínculo
              </button>
            </div>
          </div>
        </div>

        <div className="pmm__col">
          <div className="pmm__col-head">Catálogo Shopify</div>
          <input
            className="pmm__search"
            placeholder="Buscar babeta, gotero…"
            value={shopQuery}
            onChange={(e) => setShopQuery(e.target.value)}
            autoFocus
          />
          <div className="pmm__shop-grid">
            {shopFiltered.map((p) => (
              <button
                key={p.handle}
                type="button"
                className={
                  selectedProduct?.handle === p.handle ? "pmm__card pmm__card--on" : "pmm__card"
                }
                onClick={() => linkProductPrimary(p)}
              >
                {p.primaryImage ? (
                  <img src={p.primaryImage} alt="" loading="lazy" />
                ) : (
                  <div style={{ aspectRatio: 1, background: "#eee" }} />
                )}
                <div className="pmm__card-title">{p.title}</div>
              </button>
            ))}
          </div>
          {selectedProduct ? (
            <div className="pmm__hint">
              <strong>{selectedProduct.title}</strong>
              <div className="pmm__gallery" style={{ marginTop: 6 }}>
                {(selectedProduct.images || []).map((img) => (
                  <img
                    key={img.src}
                    src={img.src}
                    alt=""
                    onClick={() => linkProductImage(selectedProduct, img.src)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className="pmm__hint">
            Variable → foto → Descargar links → <code>product-media-links.json</code>
          </div>
        </div>
      </div>
    </div>
  );
}
