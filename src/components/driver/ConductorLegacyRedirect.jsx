import { Navigate, useSearchParams } from "react-router-dom";

/** Old WA links used /calculadora/conductor?t= — that path is the cotizador. */
export default function ConductorLegacyRedirect() {
  const [sp] = useSearchParams();
  const t = sp.get("t");
  return <Navigate to={t ? `/conductor?t=${encodeURIComponent(t)}` : "/conductor"} replace />;
}
