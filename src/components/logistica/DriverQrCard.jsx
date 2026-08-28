import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { btnStyle } from "../../utils/logistica/btnStyle.js";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import { buildDriverQrPrintHtml } from "../../utils/logistica/driverQr.js";

function copy(text) {
  if (!text || typeof navigator === "undefined") return;
  void navigator.clipboard?.writeText(text).catch(() => {});
}

/**
 * Large scan-at-1m QR. Caption + copy + print. Does not send WhatsApp.
 */
export default function DriverQrCard({ url, caption, size = 240 }) {
  const [src, setSrc] = useState("");
  const href = String(url || "").trim();

  useEffect(() => {
    if (!href) {
      setSrc("");
      return undefined;
    }
    let cancelled = false;
    QRCode.toDataURL(href, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#07111f", light: "#ffffff" },
    })
      .then((data) => {
        if (!cancelled) setSrc(data);
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [href, size]);

  if (!href) return null;

  const printQr = () => {
    if (!src || typeof window === "undefined") return;
    const html = buildDriverQrPrintHtml({ caption, href, src, size });
    if (!html) return;
    // Do NOT pass noopener/noreferrer in features — HTML requires window.open to
    // return null then, so document.write/print never run (Imprimir QR no-op).
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    try {
      w.opener = null;
    } catch {
      /* ignore */
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div style={{ marginTop: 10, textAlign: "center" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text || "#0f172a", marginBottom: 6 }}>
        {caption || "BMC Driver"}
      </div>
      {src ? (
        <img
          src={src}
          alt={caption || "QR BMC Driver"}
          width={size}
          height={size}
          style={{ width: size, height: size, imageRendering: "pixelated", background: "#fff", borderRadius: 8 }}
        />
      ) : (
        <div style={{ width: size, height: size, margin: "0 auto", background: "#f1f5f9", borderRadius: 8 }} />
      )}
      <div style={{ fontSize: 11, color: T.muted, wordBreak: "break-all", marginTop: 6 }}>{href}</div>
      <div>
        <button type="button" style={btnStyle({ small: true, outline: true, style: { marginTop: 6 } })} onClick={() => copy(href)}>
          Copiar enlace
        </button>
        <button type="button" style={btnStyle({ small: true, outline: true, style: { marginTop: 6, marginLeft: 8 } })} onClick={printQr}>
          Imprimir QR
        </button>
      </div>
    </div>
  );
}
