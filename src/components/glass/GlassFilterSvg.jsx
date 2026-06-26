/** SVG displacement filter for .glass-refract (Chromium progressive enhancement). */
export default function GlassFilterSvg({ displace = 24 }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <filter id="bmcGlass" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.011 0.013" numOctaves="2" seed="42" result="n" />
        <feGaussianBlur in="n" stdDeviation="1.5" result="sn" />
        <feDisplacementMap in="SourceGraphic" in2="sn" scale={displace} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
