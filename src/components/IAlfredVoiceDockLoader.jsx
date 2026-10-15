/**
 * IAlfredVoiceDockLoader — inyecta el Voice Dock de IAlfred (servido por el Enviar Desk local) en la Calculadora.
 *
 * LOCAL-ONLY: sólo corre si la app está en localhost/127.0.0.1 y VITE_IALFRED_DOCK !== "0".
 * Nunca se carga en el deploy público (Vercel / Cloud Run / bmcuruguay.com.uy).
 * URL del desk: VITE_ENVIAR_DESK_URL (default local http://127.0.0.1:8787; debe ser un host local).
 */
import { useEffect } from "react";

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1)$/;

function ialfredDeskUrl() {
  const raw = (typeof import.meta !== "undefined" && import.meta.env?.VITE_ENVIAR_DESK_URL) || "http://127.0.0.1:8787";
  return String(raw).replace(/\/+$/, "");
}

/** true si el dock puede cargarse: app local + desk local + no deshabilitado por env. */
function ialfredDockEnabled() {
  if (typeof window === "undefined") return false;
  if (import.meta.env?.VITE_IALFRED_DOCK === "0") return false;
  if (!LOCAL_HOST_RE.test(window.location.hostname)) return false;
  try {
    return LOCAL_HOST_RE.test(new URL(ialfredDeskUrl()).hostname);
  } catch {
    return false;
  }
}

export default function IAlfredVoiceDockLoader() {
  useEffect(() => {
    if (!ialfredDockEnabled()) return;
    if (document.querySelector("script[data-ialfred-dock]")) return;
    if (!window.IAlfredHost) {
      window.IAlfredHost = {
        name: "calculadora",
        getContext: () => ({
          host: "calculadora",
          url: window.location.pathname + window.location.search,
          ...(window.__ialfredCalcState ? { calc: window.__ialfredCalcState } : {}),
        }),
        getAdminRow: () => null,
      };
    }
    const s = document.createElement("script");
    s.src = `${ialfredDeskUrl()}/voice-dock.js`;
    s.async = true;
    s.dataset.host = "calculadora";
    s.dataset.position = "bl"; // abajo a la izquierda: no choca con el chat de Panelin
    s.dataset.api = ialfredDeskUrl();
    s.dataset.ialfredDock = "1";
    s.onerror = () => {
      // Enviar Desk apagado: la Calculadora sigue igual, sin dock.
      s.remove();
    };
    document.body.appendChild(s);
  }, []);
  return null;
}
