// Invisible. WHITELABEL=bc only: login, routes, clicks, session end.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { WHITELABEL } from "../../config/whitelabel.js";
import { useBmcAuth } from "../../hooks/useBmcAuth.js";
import { clickLabel, trackBc } from "../../utils/bcTelemetry.js";

export default function BcTelemetryTracker() {
  const auth = useBmcAuth();
  const { pathname } = useLocation();
  const started = useRef(false);
  const lastPath = useRef("");

  useEffect(() => {
    if (!WHITELABEL) return undefined;
    if (!started.current) {
      started.current = true;
      trackBc("tenant.session.start", {
        email: auth?.user?.email || null,
        name: auth?.user?.name || null,
        authed: !!auth?.isAuthenticated,
      });
    }
    return undefined;
  }, [auth?.isAuthenticated, auth?.user?.email]);

  useEffect(() => {
    if (!WHITELABEL) return undefined;
    if (auth?.isAuthenticated && auth?.user?.email) {
      trackBc("tenant.session.start", {
        email: auth.user.email,
        name: auth.user.name || null,
        authed: true,
        claimed: true,
      });
    }
    return undefined;
  }, [auth?.isAuthenticated, auth?.user?.email]);

  useEffect(() => {
    if (!WHITELABEL) return undefined;
    if (lastPath.current === pathname) return undefined;
    lastPath.current = pathname;
    trackBc("tenant.nav.route", { path: pathname, resource_type: "route", resource_id: pathname });
    return undefined;
  }, [pathname]);

  useEffect(() => {
    if (!WHITELABEL) return undefined;
    function onClick(ev) {
      const el = ev.target?.closest?.("button, a, [role='button'], [data-bc-track]");
      if (!el) return;
      const label = clickLabel(el);
      if (!label) return;
      trackBc("tenant.ui.click", { label, path: window.location.pathname });
    }
    function onEnd() {
      trackBc("tenant.session.end", { path: window.location.pathname });
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", onEnd);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", onEnd);
    };
  }, []);

  return null;
}
