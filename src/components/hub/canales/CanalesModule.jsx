// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/canales/CanalesModule.jsx — Canales (Channels) module entry
// ───────────────────────────────────────────────────────────────────────────
// Houses ML Manager, WA Inbox, and Unified Contacts.
// Pattern: reuses admin-cotizaciones structure (SkinProvider, topbar, tab strip).
// ═══════════════════════════════════════════════════════════════════════════

import React, { Suspense, useState } from "react";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";
import { useOmniDeals } from "../../../hooks/useOmniConversations.js";
import { SkinProvider, useSkin } from "../../admin-cotizaciones/SkinProvider.jsx";
import "../../admin-cotizaciones/styles.css";

const MlManagerPanel = React.lazy(() => import("./panels/MlManagerPanel.jsx"));
const WaInboxPanel = React.lazy(() => import("./panels/WaInboxPanel.jsx"));
const UnifiedContactsPanel = React.lazy(() =>
  import("./panels/UnifiedContactsPanel.jsx")
);
const OmniInboxPanel = React.lazy(() => import("./panels/OmniInboxPanel.jsx"));
const OmniDealsKanban = React.lazy(() => import("./panels/OmniDealsKanban.jsx"));

const OMNI_INBOX_ENABLED = import.meta.env.VITE_OMNI_INBOX === "1";
const OMNI_DEALS_ENABLED = import.meta.env.VITE_OMNI_DEALS === "1";

// ─────────────────────────────────────────────────────────────────────────────
// Tab bar and loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function TabBar({ activeTab, onTabChange }) {
  const tabs = [
    ...(OMNI_INBOX_ENABLED ? [{ id: "omni", label: "Omni Inbox" }] : []),
    ...(OMNI_DEALS_ENABLED ? [{ id: "deals", label: "Pipeline Deals" }] : []),
    { id: "ml", label: "ML Manager" },
    { id: "wa", label: "WA Inbox" },
    { id: "contacts", label: "Contactos Unificados" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--ac-border-primary, #e5e7eb)",
        marginBottom: "1.5rem",
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: "0.75rem 1.25rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: "0.9375rem",
            fontWeight: activeTab === tab.id ? 600 : 500,
            color:
              activeTab === tab.id
                ? "var(--ac-text-primary, #111827)"
                : "var(--ac-text-secondary, #6b7280)",
            borderBottom:
              activeTab === tab.id
                ? "3px solid var(--ac-accent-primary, #2563eb)"
                : "none",
            transition: "all 0.2s ease",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div
      style={{
        padding: "2rem",
        textAlign: "center",
        color: "var(--ac-text-secondary, #6b7280)",
      }}
    >
      <p>Cargando panel...</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner module (uses skin context)
// ─────────────────────────────────────────────────────────────────────────────

function CanalesModuleInner() {
  const { skin } = useSkin();
  const { accessToken } = useBmcAuth();
  const [activeTab, setActiveTab] = useState(OMNI_INBOX_ENABLED ? "omni" : "ml");
  const { deals, loading: dealsLoading, moveDeal } = useOmniDeals(
    OMNI_DEALS_ENABLED ? accessToken : null,
  );

  return (
    <div className="adminCot" data-skin={skin}>
      <div
        style={{
          padding: "1.5rem",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* Topbar with breadcrumb */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid var(--ac-border-primary, #e5e7eb)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            Hub › Canales
          </h1>
          <span
            style={{
              display: "inline-block",
              padding: "0.375rem 0.75rem",
              background: "var(--ac-badge-primary-bg, #dbeafe)",
              color: "var(--ac-badge-primary-color, #1e40af)",
              fontSize: "0.75rem",
              fontWeight: 600,
              borderRadius: 99,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            ML | WA | Contactos{OMNI_INBOX_ENABLED ? " | Omni" : ""}
          </span>
        </div>

        {/* Tab bar */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab content with Suspense */}
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === "omni" && OMNI_INBOX_ENABLED && (
            <OmniInboxPanel token={accessToken} />
          )}
          {activeTab === "deals" && OMNI_DEALS_ENABLED && (
            <OmniDealsKanban deals={deals} loading={dealsLoading} onMoveDeal={moveDeal} />
          )}
          {activeTab === "ml" && <MlManagerPanel token={accessToken} />}
          {activeTab === "wa" && <WaInboxPanel token={accessToken} />}
          {activeTab === "contacts" && (
            <UnifiedContactsPanel token={accessToken} />
          )}
        </Suspense>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Module entry with SkinProvider
// ─────────────────────────────────────────────────────────────────────────────

export default function CanalesModule() {
  return (
    <SkinProvider>
      <CanalesModuleInner />
    </SkinProvider>
  );
}
