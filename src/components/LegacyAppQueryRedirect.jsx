import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Normalizes legacy `?app=logistica` / `?app=calculadora` into canonical paths and strips the param.
 */
export default function LegacyAppQueryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const app = sp.get("app");
    if (app !== "logistica" && app !== "calculadora") return;

    sp.delete("app");
    const qs = sp.toString();
    const suffix = qs ? `?${qs}` : "";

    if (app === "logistica") {
      navigate({ pathname: "/logistica", search: suffix }, { replace: true });
    } else {
      navigate({ pathname: "/", search: suffix }, { replace: true });
    }
  }, [location.search, navigate]);

  return null;
}
