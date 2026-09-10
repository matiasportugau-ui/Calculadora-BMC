import { useCallback, useState } from "react";
import { parseShopifyProduct } from "../utils/productDataAdapter.js";

export default function ProductExplorerTabs({
  product,
  onTabChange = () => {},
  onMouseEnter = () => {},
  onMouseLeave = () => {},
  onMouseMove = () => {},
}) {
  const [activeTab, setActiveTab] = useState("Images");

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    onTabChange(tab);
  }, [onTabChange]);

  const handleKeyDown = useCallback((e) => {
    const tabs = ["Images", "Specs", "Features"];
    const currentIndex = tabs.indexOf(activeTab);

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
      handleTabChange(prevTab);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextTab = tabs[(currentIndex + 1) % tabs.length];
      handleTabChange(nextTab);
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  }, [activeTab, handleTabChange]);

  if (!product) return null;

  const parsed = parseShopifyProduct(product);
  const { images, specs, features } = parsed;

  const renderImages = () => {
    if (!images.length) {
      return (
        <div style={{ textAlign: "center", padding: "24px 16px", color: "#999" }}>
          <p style={{ margin: 0, fontSize: 13 }}>No images available</p>
        </div>
      );
    }
    return (
      <div style={{ padding: "16px", minHeight: "120px" }}>
        <img
          src={images[0]?.src}
          alt={images[0]?.alt || "Product"}
          style={{
            maxWidth: "100%",
            maxHeight: "240px",
            objectFit: "contain",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
          }}
        />
        {images.length > 1 && (
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#999" }}>
            {images.length} imagen{images.length !== 1 ? "s" : ""} disponible{images.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    );
  };

  const renderSpecs = () => {
    const specKeys = Object.keys(specs).filter((k) => specs[k] && specs[k] !== "N/A");
    if (!specKeys.length) {
      return (
        <div style={{ textAlign: "center", padding: "24px 16px", color: "#999" }}>
          <p style={{ margin: 0, fontSize: 13 }}>No specifications available</p>
        </div>
      );
    }
    return (
      <div style={{ padding: "16px" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
            lineHeight: "1.6",
          }}
        >
          <tbody>
            {specKeys.map((key) => (
              <tr key={key} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td
                  style={{
                    padding: "8px 0",
                    paddingRight: "12px",
                    fontWeight: 600,
                    color: "#666",
                    minWidth: "100px",
                    textTransform: "capitalize",
                  }}
                >
                  {key}:
                </td>
                <td style={{ padding: "8px 0", color: "#1f1f1f" }}>{specs[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFeatures = () => {
    if (!features.length) {
      return (
        <div style={{ textAlign: "center", padding: "24px 16px", color: "#999" }}>
          <p style={{ margin: 0, fontSize: 13 }}>No features available</p>
        </div>
      );
    }
    return (
      <div style={{ padding: "16px" }}>
        <ul
          style={{
            margin: 0,
            paddingLeft: "20px",
            fontSize: "13px",
            lineHeight: "1.7",
            color: "#1f1f1f",
          }}
        >
          {features.map((feature, idx) => (
            <li key={idx} style={{ marginBottom: "6px" }}>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div
      className="productExplorer__container"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      style={{ marginTop: "16px" }}
    >
      <div
        className="productExplorer__tabs"
        role="tablist"
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        {["Images", "Specs", "Features"].map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tab-panel-${tab.toLowerCase()}`}
            onClick={() => handleTabChange(tab)}
            onKeyDown={handleKeyDown}
            className={`productExplorer__tab ${activeTab === tab ? "productExplorer__tab--active" : ""}`}
            style={{
              padding: "8px 16px",
              borderRadius: "12px",
              border: activeTab === tab ? "1px solid rgb(0, 113, 227)" : "1px solid rgba(255, 255, 255, 0.2)",
              background:
                activeTab === tab ? "rgba(255, 255, 255, 0.72)" : "rgba(255, 255, 255, 0.42)",
              backdropFilter: "blur(14px)",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "#1f1f1f",
              transition: "all 0.12s ease",
              boxShadow:
                activeTab === tab ? "0 4px 12px rgba(0, 113, 227, 0.1)" : "none",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        id={`tab-panel-${activeTab.toLowerCase()}`}
        role="tabpanel"
        aria-labelledby={activeTab}
        className="productExplorer__content"
        style={{
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          background: "#fff",
          animation: "fadeIn 0.18s ease-in-out",
        }}
      >
        {activeTab === "Images" && renderImages()}
        {activeTab === "Specs" && renderSpecs()}
        {activeTab === "Features" && renderFeatures()}
      </div>
    </div>
  );
}
