// ═══════════════════════════════════════════════════════════════════════════
// src/components/admin/users/UserCombobox.jsx
// ───────────────────────────────────────────────────────────────────────────
// Autocomplete user picker — searches /api/admin/users?search=<query> and
// renders a dropdown of {email, name, roles}. On select, invokes onSelect(user).
// Used by Track A (admin module-grant assignment) and Track D (TraKtiMe member
// assignment) to replace the UUID-paste pattern.
//
// Requires: admin-level Bearer token (since /api/admin/users is role=admin).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";
import { searchUsersForCombobox } from "../../../hooks/useUserAdmin.js";

export default function UserCombobox({ onSelect, placeholder = "Buscar usuario por email o nombre…", limit = 8 }) {
  const auth = useBmcAuth();
  const token = auth.accessToken;
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  const runSearch = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q || q.length < 2) { setItems([]); return; }
      setLoading(true);
      const res = await searchUsersForCombobox(token, q, limit);
      setLoading(false);
      setItems(res);
      setOpen(true);
      setHighlighted(0);
    }, 250);
  }, [token, limit]);

  useEffect(() => { runSearch(query); }, [query, runSearch]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const select = (u) => {
    onSelect?.(u);
    setQuery("");
    setItems([]);
    setOpen(false);
  };

  const onKey = (e) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); select(items[highlighted]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (items.length) setOpen(true); }}
        onKeyDown={onKey}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={open}
        style={{
          width: "100%", padding: "8px 12px", fontSize: 14,
          borderRadius: 8, border: "1px solid #d1d5db", background: "#fff",
        }}
      />
      {open && items.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4,
            background: "#fff", border: "1px solid #d1d5db", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            listStyle: "none", padding: 4, maxHeight: 280, overflowY: "auto",
            zIndex: 90,
          }}
        >
          {items.map((u, idx) => (
            <li
              key={u.user_id}
              role="option"
              aria-selected={idx === highlighted}
              onClick={() => select(u)}
              onMouseEnter={() => setHighlighted(idx)}
              style={{
                padding: "8px 10px",
                background: idx === highlighted ? "#eff6ff" : "transparent",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, color: "#111827" }}>{u.email}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {u.name || "—"}
                {u.roles?.length ? ` · ${u.roles.join(", ")}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
      {loading && open && items.length === 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, padding: 10, fontSize: 12, color: "#6b7280" }}>
          Buscando…
        </div>
      )}
    </div>
  );
}
