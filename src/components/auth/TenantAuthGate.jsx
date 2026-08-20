import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBmcAuth } from "../../hooks/useBmcAuth.js";
import { WHITELABEL } from "../../config/whitelabel.js";
import { tenantAccessState } from "../../utils/tenantAccess.js";
import { identOvertureMs, shouldPlayIdentCinema, waitMs } from "../../utils/tenantIdentMotion.js";
import { playIdentSting, primeIdentSting } from "../../utils/tenantIdentAudio.js";
import TenantLoginIdent from "./TenantLoginIdent.jsx";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

const RETURN_KEY = "tenant.returnTo";

export default function TenantAuthGate({ children }) {
  const auth = useBmcAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [memberKnown, setMemberKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cinema, setCinema] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const loginLock = useRef(false);

  useEffect(() => {
    if (!WHITELABEL || auth.status !== "authenticated" || !auth.accessToken) {
      setMember(null);
      setMemberKnown(auth.status !== "authenticated");
      return undefined;
    }
    let dead = false;
    fetch(`${ApiBase}/api/me/tenant`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (dead) return;
        setMember(j?.tenant || null);
        setMemberKnown(true);
      })
      .catch(() => {
        if (dead) return;
        setMember(null);
        setMemberKnown(true);
      });
    return () => { dead = true; };
  }, [auth.status, auth.accessToken]);

  const onLogin = useCallback(async () => {
    if (loginLock.current) return;
    loginLock.current = true;
    setBusy(true);
    setLoginError(null);
    const mm = typeof window !== "undefined" ? window.matchMedia.bind(window) : undefined;
    primeIdentSting(WHITELABEL);
    let session = null;
    try {
      // GIS popup needs this click. Cinema waits until grant.
      session = await auth.login();
    } catch (e) {
      setLoginError(e?.message || "auth_failed");
      setBusy(false);
      loginLock.current = false;
      return;
    }

    const role = session?.role || session?.user?.role || auth.role;
    let memberRow = null;
    const token = session?.accessToken;
    if (role !== "admin" && role !== "superadmin") {
      try {
        const r = await fetch(`${ApiBase}/api/me/tenant`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const j = await r.json();
        memberRow = j?.tenant || null;
        setMember(memberRow);
        setMemberKnown(true);
      } catch {
        setMemberKnown(true);
      }
    } else {
      memberRow = { slug: WHITELABEL };
      setMember(memberRow);
      setMemberKnown(true);
    }

    if (!shouldPlayIdentCinema({ role, member: memberRow })) {
      setBusy(false);
      loginLock.current = false;
      return;
    }

    setCinema(true);
    playIdentSting(WHITELABEL, mm);
    await waitMs(identOvertureMs(mm));
    setBusy(false);
    setCinema(false);
    loginLock.current = false;
  }, [auth]);

  const state = tenantAccessState({
    whitelabel: WHITELABEL,
    status: auth.status,
    member: memberKnown ? (member || (auth.role === "admin" || auth.role === "superadmin" ? { slug: WHITELABEL } : null)) : null,
    role: auth.role,
  });

  // Anonymous (and denied) always sit on `/` — the ident is the landing page.
  useEffect(() => {
    if (!WHITELABEL) return undefined;
    const onIdent = state === "login" || state === "denied" || state === "boot" || cinema || busy;
    if (!onIdent) return undefined;
    const here = `${location.pathname}${location.search || ""}`;
    if (here !== "/" && here !== "") {
      try { sessionStorage.setItem(RETURN_KEY, here); } catch { /* ignore */ }
      navigate("/", { replace: true });
    }
    return undefined;
  }, [state, cinema, busy, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!WHITELABEL || cinema || busy || state !== "ok") return undefined;
    let to = "/";
    try { to = sessionStorage.getItem(RETURN_KEY) || "/"; sessionStorage.removeItem(RETURN_KEY); } catch { to = "/"; }
    if (to && to !== "/" && to !== `${location.pathname}${location.search || ""}`) {
      navigate(to, { replace: true });
    }
    return undefined;
  }, [state, cinema, busy, location.pathname, location.search, navigate]);

  if (state === "open") return children;
  if (state === "ok" && !cinema && !busy) return children;
  if (state === "denied" && !cinema && !busy) {
    return <TenantLoginIdent denied email={auth.user?.email} />;
  }
  if (!cinema && (state === "boot" || (auth.status === "authenticated" && !memberKnown))) {
    return <TenantLoginIdent phase="boot" />;
  }
  return (
    <>
      <TenantLoginIdent onLogin={onLogin} loading={busy} cinema={cinema} />
      {loginError ? (
        <p style={{ position: "fixed", bottom: "12vh", left: 0, right: 0, textAlign: "center", color: "#c4a15a", zIndex: 10001, fontSize: 13 }}>
          {loginError}
        </p>
      ) : null}
    </>
  );
}
