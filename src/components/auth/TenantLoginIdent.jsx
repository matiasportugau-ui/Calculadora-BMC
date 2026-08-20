import { useEffect } from "react";
import { WHITELABEL, WHITELABEL_BRAND } from "../../config/whitelabel.js";
import { lamLogoSvg } from "../../branding/lamLogo.js";
import { SMARTBUILDING_LOGO_DATA_URL } from "../../branding/smartbuildingLogo.js";
import { preloadIdentSting } from "../../utils/tenantIdentAudio.js";
import "./tenant-ident.css";

const BC_MARK = `<svg viewBox="0 0 880 560" height="72" role="img" aria-label="BC" xmlns="http://www.w3.org/2000/svg">
  <path fill="#C4A15A" fill-rule="evenodd" d="M60,60 H235 C300,60 340,100 340,158 C340,196 320,222 288,234 C328,244 355,276 355,326 C355,390 310,430 240,430 H60 Z M135,125 V205 H222 C252,205 268,190 268,165 C268,140 252,125 222,125 Z M135,275 V365 H232 C265,365 283,348 283,320 C283,292 265,275 232,275 Z"/>
  <path fill="#C4A15A" d="M767.5,121.2 A185,185 0 1,0 767.5,368.8 L713.2,319.9 A112,112 0 1,1 713.2,170.1 Z"/>
  <path fill="#8A6A32" d="M30,510 L600,175 L855,360 L827,399 L620,222 L54,551 Z"/>
</svg>`;

function Mark({ slug }) {
  if (slug === "paneleslam") {
    return <span className="tenantIdent__mark" dangerouslySetInnerHTML={{ __html: lamLogoSvg(56) }} />;
  }
  if (slug === "smartbuilding") {
    return (
      <span className="tenantIdent__mark">
        <img src={SMARTBUILDING_LOGO_DATA_URL} alt="" width={72} height={72} style={{ borderRadius: "50%", display: "block" }} />
      </span>
    );
  }
  return <span className="tenantIdent__mark" dangerouslySetInnerHTML={{ __html: BC_MARK }} />;
}

export default function TenantLoginIdent({
  onLogin,
  loading = false,
  denied = false,
  email = null,
  phase = "login",
  cinema = false,
}) {
  const brand = WHITELABEL_BRAND;
  const slug = WHITELABEL || "bc";
  const ident = brand?.ident || {};
  const style = ident.style || "gold-title";
  const title = brand?.marca || slug.toUpperCase();
  const credit = brand?.descriptor || "";
  const beat = cinema ? "overture" : phase;

  useEffect(() => {
    preloadIdentSting(slug);
  }, [slug]);

  return (
    <div
      className="tenantIdent"
      data-style={style}
      data-slug={slug}
      data-phase={cinema ? "overture" : "idle"}
      aria-busy={cinema || loading || undefined}
      style={{
        "--ti-ink": ident.ink || "#F4E8C8",
        "--ti-accent": ident.accent || "#C4A15A",
        "--ti-soft": ident.accentSoft || "#8A6A32",
        background: ident.bg || "#0C0906",
      }}
    >
      <div className="tenantIdent__letterbox tenantIdent__letterbox--top" />
      <div className="tenantIdent__letterbox tenantIdent__letterbox--bot" />
      <div className="tenantIdent__grain" aria-hidden />
      <div className="tenantIdent__flare" aria-hidden />
      <div className="tenantIdent__cut" aria-hidden />
      <div className="tenantIdent__stage">
        {style === "stack" ? (
          <>
            <div className="tenantIdent__stack" aria-hidden>
              <div className="tenantIdent__plank" />
              <div className="tenantIdent__plank" />
              <div className="tenantIdent__plank" />
            </div>
            <div className="tenantIdent__stampMark" aria-hidden>
              <Mark slug={slug} />
            </div>
          </>
        ) : (
          <Mark slug={slug} />
        )}
        <h1 className="tenantIdent__title">{title}</h1>
        <div className="tenantIdent__line" />
        <p className="tenantIdent__credit">{credit}</p>
        {denied ? (
          <p className="tenantIdent__deny">
            {email ? `${email} no tiene acceso a ${title}.` : "No tenés acceso a esta calculadora."}
            {" "}Pedile al dueño que te invite con tu Gmail.
          </p>
        ) : beat === "boot" && !cinema ? (
          <p className="tenantIdent__credit">Cargando…</p>
        ) : (
          <div className="tenantIdent__cta">
            <button
              type="button"
              className="tenantIdent__btn"
              onClick={onLogin}
              disabled={loading || cinema}
            >
              {loading && !cinema ? "Conectando…" : "Continuar con Google"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
