// Header mark for the active white-label brand.
import { WHITELABEL } from "../config/whitelabel.js";
import { LAM_TERRACOTTA, LAM_TAUPE } from "../branding/lamLogo.js";


const GOLD_DEEP = "#C6A02A";
const GOLD_SOFT = "#DCC384";

function LamMark({ height, title }) {
  return (
    <svg
      viewBox="0 0 520 360"
      height={height}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      <title>{title}</title>
      <path fill={LAM_TERRACOTTA} d="M40 168 L200 48 L248 84 L88 204 Z" />
      <path fill={LAM_TAUPE} d="M248 84 L360 168 L312 204 L220 120 Z" />
      <path fill="none" stroke={LAM_TERRACOTTA} strokeWidth="14" strokeLinejoin="miter" d="M48 172 L200 56 L352 172" />
      <path fill="none" stroke={LAM_TERRACOTTA} strokeWidth="14" d="M78 172 V248 H322 V172" />
      <text
        x="48"
        y="318"
        fontFamily="Arial Black, Arial, sans-serif"
        fontSize="118"
        fontWeight="800"
        fill={LAM_TERRACOTTA}
        letterSpacing="-2"
      >
        LAM
      </text>
    </svg>
  );
}

function SmartBuildingMark({ height, title }) {
  return (
    <img
      src="/branding/smartbuilding-logo.jpg"
      alt={title}
      title={title}
      height={height}
      width={height}
      style={{
        display: "block",
        flexShrink: 0,
        height,
        width: height,
        borderRadius: "50%",
        objectFit: "cover",
        background: "#C9D3DB",
      }}
    />
  );
}

export default function BcLogo({ height = 36, title }) {
  const label = title || (WHITELABEL === "paneleslam" ? "LAM" : WHITELABEL === "smartbuilding" ? "SmartBuilding" : "BC");
  if (WHITELABEL === "smartbuilding") return <SmartBuildingMark height={height} title={label} />;
  if (WHITELABEL === "paneleslam") return <LamMark height={height} title={label} />;
  return (
    <svg
      viewBox="0 0 880 560"
      height={height}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      <title>{label}</title>
      <path
        fill={GOLD_DEEP}
        fillRule="evenodd"
        d="M60,60 H235 C300,60 340,100 340,158 C340,196 320,222 288,234 C328,244 355,276 355,326 C355,390 310,430 240,430 H60 Z M135,125 V205 H222 C252,205 268,190 268,165 C268,140 252,125 222,125 Z M135,275 V365 H232 C265,365 283,348 283,320 C283,292 265,275 232,275 Z"
      />
      <path
        fill={GOLD_DEEP}
        d="M767.5,121.2 A185,185 0 1,0 767.5,368.8 L713.2,319.9 A112,112 0 1,1 713.2,170.1 Z"
      />
      <path fill={GOLD_SOFT} d="M30,510 L600,175 L855,360 L827,399 L620,222 L54,551 Z" />
      <path fill={GOLD_SOFT} d="M782,262 L806,262 L806,320 L782,306 Z" />
      <g fill={GOLD_SOFT}>
        <rect x="598" y="258" width="30" height="30" />
        <rect x="636" y="258" width="30" height="30" />
        <rect x="598" y="296" width="30" height="30" />
        <rect x="636" y="296" width="30" height="30" />
      </g>
    </svg>
  );
}
