import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

function apiBase() {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return String(import.meta.env.VITE_API_BASE).replace(/\/+$/, "");
  }
  return "";
}

async function studioFetch(path, options = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

const shell = {
  minHeight: "100vh",
  padding: "24px 28px 48px",
  background: "linear-gradient(165deg, #0f172a 0%, #1e293b 45%, #0f766e 140%)",
  color: "#e2e8f0",
  fontFamily: '"Segoe UI", system-ui, sans-serif',
};

const card = {
  background: "rgba(15, 23, 42, 0.55)",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: 14,
  padding: 16,
  backdropFilter: "blur(8px)",
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(148,163,184,0.35)",
  background: "rgba(2,6,23,0.55)",
  color: "#f8fafc",
  fontSize: 14,
};

const btn = (bg) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  color: "#fff",
  background: bg,
});

export default function ShopifyLocalStudioModule() {
  const [status, setStatus] = useState(null);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPrices, setEditPrices] = useState({});
  const [busy, setBusy] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem("bmc.shopifyStudio.apiKey") || "";
    } catch {
      return "";
    }
  });

  const load = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError("");
    try {
      const [st, cat] = await Promise.all([
        studioFetch("/api/shopify/studio/status"),
        studioFetch(`/api/shopify/studio/catalog?page=${pageNum}&limit=40`),
      ]);
      setStatus(st);
      setProducts(cat.products || []);
      setHasMore(Boolean(cat.hasMore));
      setDraftCount(cat.draftCount || 0);
      setPage(pageNum);
    } catch (e) {
      setError(e.message || "Failed to load studio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (p) =>
        p.title?.toLowerCase().includes(needle) ||
        p.handle?.toLowerCase().includes(needle) ||
        p.vendor?.toLowerCase().includes(needle)
    );
  }, [products, q]);

  function openEditor(p) {
    setSelected(p);
    setEditTitle(p.title || "");
    setEditBody(p.body_html || "");
    const prices = {};
    for (const v of p.variants || []) prices[String(v.id)] = v.price;
    setEditPrices(prices);
    setUploadMsg("");
  }

  async function saveDraft() {
    if (!selected) return;
    setBusy("save");
    setUploadMsg("");
    try {
      const variants = {};
      for (const [id, price] of Object.entries(editPrices)) {
        variants[id] = { price: String(price) };
      }
      const draft = {
        title: editTitle,
        body_html: editBody,
        variants,
      };
      const res = await studioFetch("/api/shopify/studio/drafts", {
        method: "PUT",
        body: JSON.stringify({ mode: "merge", drafts: { [selected.handle]: draft } }),
      });
      setDraftCount(Object.keys(res.drafts || {}).length);
      setUploadMsg("Draft saved locally (.runtime). Not on Shopify yet.");
      await load(page);
      const refreshed = (await studioFetch(`/api/shopify/studio/catalog?page=${page}&limit=40`)).products || [];
      const again = refreshed.find((x) => x.handle === selected.handle);
      if (again) openEditor(again);
    } catch (e) {
      setUploadMsg(e.message || "Save failed");
    } finally {
      setBusy("");
    }
  }

  async function upload(write = false) {
    setBusy(write ? "upload" : "dry");
    setUploadMsg("");
    try {
      if (apiKey) {
        try {
          localStorage.setItem("bmc.shopifyStudio.apiKey", apiKey);
        } catch {
          /* ignore */
        }
      }
      const res = await studioFetch("/api/shopify/studio/upload", {
        method: "POST",
        headers: apiKey ? { "X-Api-Key": apiKey } : {},
        body: JSON.stringify({
          dryRun: !write,
          write: Boolean(write),
          handles: selected ? [selected.handle] : undefined,
        }),
      });
      if (res.dryRun) {
        setUploadMsg(
          `Dry-run OK — ${res.results?.length || 0} draft(s) ready. Click “Upload to Shopify” to apply.`
        );
      } else {
        setUploadMsg(`Uploaded ${res.uploaded || 0} product(s) to Shopify.`);
        await load(page);
      }
    } catch (e) {
      const hint =
        e.status === 401
          ? " Need API_AUTH_TOKEN in X-Api-Key, and OAuth install (/auth/shopify)."
          : "";
      setUploadMsg((e.message || "Upload failed") + hint);
    } finally {
      setBusy("");
    }
  }

  const connected = status?.hasShopToken;
  const storeUrl = status?.storefrontUrl || "https://bmcuruguay.com.uy";

  return (
    <div style={shell}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
              <Link to="/hub" style={{ color: "#99f6e4" }}>
                Hub
              </Link>{" "}
              › Shopify Local Studio
            </div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.02em" }}>Shopify Local Studio</h1>
            <p style={{ margin: "8px 0 0", opacity: 0.85, maxWidth: 640 }}>
              Preview your live store locally, edit drafts here, then upload when ready. Theme Liquid: pull → edit → push
              via npm scripts.
            </p>
          </div>
          <div style={{ ...card, minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: connected ? "#34d399" : status?.hasAppConfig ? "#fbbf24" : "#f87171",
                }}
              />
              <strong style={{ fontSize: 13 }}>
                {connected ? "Admin connected" : status?.hasAppConfig ? "App configured · not installed" : "Not connected"}
              </strong>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.45 }}>
              Storefront:{" "}
              <a href={storeUrl} target="_blank" rel="noreferrer" style={{ color: "#99f6e4" }}>
                {storeUrl.replace(/^https?:\/\//, "")}
              </a>
              <br />
              Drafts pending: {draftCount}
              <br />
              Shop: {status?.shop || "set SHOPIFY_SHOP"}
            </div>
            {!connected && status?.authStartUrl ? (
              <a
                href={`${apiBase()}${status.authStartUrl}`}
                style={{ ...btn("#0d9488"), marginTop: 10, textDecoration: "none" }}
              >
                Connect Shopify OAuth
              </a>
            ) : null}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={card}>
            <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Catalog drafts (this page)</h2>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
              <li>Browse live products from the storefront</li>
              <li>Edit title / description / prices → Save draft (local only)</li>
              <li>Dry-run, then Upload to Shopify (needs OAuth + API key)</li>
            </ol>
          </div>
          <div style={card}>
            <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Theme design (Liquid)</h2>
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", opacity: 0.9 }}>
{`npm run shopify:theme:pull   # download theme
# edit files in shopify-theme/
npm run shopify:theme:dev    # local preview
npm run shopify:theme:push   # upload unpublished`}
            </pre>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          <input
            style={{ ...inputStyle, maxWidth: 320 }}
            placeholder="Filter products…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" style={btn("#334155")} onClick={() => load(page)} disabled={loading}>
            Refresh
          </button>
          <button type="button" style={btn("#334155")} disabled={!hasMore || loading} onClick={() => load(page + 1)}>
            Next page
          </button>
          <button type="button" style={btn("#334155")} disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            Prev
          </button>
          <input
            style={{ ...inputStyle, maxWidth: 260 }}
            placeholder="API_AUTH_TOKEN (for upload)"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {error ? (
          <div style={{ ...card, borderColor: "#f87171", marginBottom: 12, color: "#fecaca" }}>{error}</div>
        ) : null}
        {uploadMsg ? (
          <div style={{ ...card, marginBottom: 12, borderColor: "#2dd4bf", color: "#ccfbf1" }}>{uploadMsg}</div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.1fr)", gap: 14 }}>
          <div style={{ ...card, maxHeight: "70vh", overflow: "auto" }}>
            {loading && !products.length ? (
              <p style={{ opacity: 0.7 }}>Loading catalog…</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => openEditor(p)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: selected?.id === p.id ? "rgba(45,212,191,0.15)" : "transparent",
                        border: "none",
                        borderBottom: "1px solid rgba(148,163,184,0.15)",
                        color: "#e2e8f0",
                        padding: "10px 6px",
                        cursor: "pointer",
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      {p.images?.[0]?.src ? (
                        <img
                          src={p.images[0].src}
                          alt=""
                          width={44}
                          height={44}
                          style={{ objectFit: "cover", borderRadius: 8, background: "#0f172a" }}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: "#1e293b" }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p._draft ? "• " : ""}
                          {p.title}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.65 }}>
                          {p.handle}
                          {p.variants?.[0]?.price ? ` · $${p.variants[0].price}` : ""}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ ...card, maxHeight: "70vh", overflow: "auto" }}>
            {!selected ? (
              <p style={{ opacity: 0.7 }}>Select a product to edit locally.</p>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>{selected.handle}</div>
                    <a
                      href={`${storeUrl}/products/${selected.handle}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#99f6e4", fontSize: 12 }}
                    >
                      Open on live store ↗
                    </a>
                  </div>
                  {selected._draft ? (
                    <span style={{ fontSize: 11, color: "#5eead4", alignSelf: "start" }}>Has local draft</span>
                  ) : null}
                </div>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Title</label>
                <input style={{ ...inputStyle, marginBottom: 10 }} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <label style={{ fontSize: 12, opacity: 0.8 }}>Description (HTML)</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 120, marginBottom: 10, fontFamily: "ui-monospace, monospace" }}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <label style={{ fontSize: 12, opacity: 0.8 }}>Variant prices (USD)</label>
                <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                  {(selected.variants || []).map((v) => (
                    <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ flex: 1, fontSize: 12, opacity: 0.8 }}>{v.title || v.sku || v.id}</span>
                      <input
                        style={{ ...inputStyle, maxWidth: 120 }}
                        value={editPrices[String(v.id)] ?? ""}
                        onChange={(e) => setEditPrices((prev) => ({ ...prev, [String(v.id)]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={btn("#0d9488")} disabled={busy === "save"} onClick={saveDraft}>
                    {busy === "save" ? "Saving…" : "Save draft (local)"}
                  </button>
                  <button type="button" style={btn("#475569")} disabled={!!busy} onClick={() => upload(false)}>
                    {busy === "dry" ? "…" : "Dry-run upload"}
                  </button>
                  <button type="button" style={btn("#b45309")} disabled={!!busy} onClick={() => upload(true)}>
                    {busy === "upload" ? "Uploading…" : "Upload to Shopify"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
