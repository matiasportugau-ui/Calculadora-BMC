// ═══════════════════════════════════════════════════════════════════════════
// RoofPanelRealisticScene — Vista 3D referencial con textura de catálogo por familia
// (paralela al RoofPreview 2D; misma planta que RoofBorderCanvas).
// ═══════════════════════════════════════════════════════════════════════════

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { buildZoneLayoutsForRoof3d } from "../utils/roofZoneLayouts3d.js";
import { getRoofPanelVisualProfile } from "../data/roofPanelVisualProfiles.js";
import { C } from "../data/constants.js";

function computeSceneBounds(zoneLayouts, theta) {
  if (!zoneLayouts.length) {
    return {
      minX: 0,
      maxX: 10,
      minZ: -6,
      maxZ: 0,
      maxH: 2,
      maxD: 6,
      maxLargo: 6,
      camTarget: [5, 1, -3],
      camPos: [5, 6, 8],
    };
  }
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  let mix = Infinity;
  let mxx = -Infinity;
  let miz = Infinity;
  let maz = -Infinity;
  let ml = 0;
  for (const r of zoneLayouts) {
    mix = Math.min(mix, r.ox);
    mxx = Math.max(mxx, r.ox + r.ancho);
    const zFrente = r.oz;
    const zFondo = r.oz - r.largo * cosT;
    miz = Math.min(miz, zFrente, zFondo);
    maz = Math.max(maz, zFrente, zFondo);
    ml = Math.max(ml, r.largo);
  }
  const tw = Math.max(0.1, mxx - mix);
  const maxLargoVal = ml;
  const maxHVal = maxLargoVal * sinT;
  const maxDVal = maxLargoVal * cosT;
  const spanZ = Math.max(0.1, maz - miz);
  const spanW = Math.max(0.1, mxx - mix);
  const sceneSize = Math.max(spanW, spanZ, tw * 0.5 + spanZ * 0.5);
  const camTarget = [(mix + mxx) / 2, maxHVal / 2, (miz + maz) / 2];
  const camPos = [
    (mix + mxx) / 2,
    maxHVal + Math.max(1.8, sceneSize * 0.55),
    (miz + maz) / 2 + maxDVal * 0.85 + Math.max(2.5, sceneSize * 0.35),
  ];
  return {
    minX: mix,
    maxX: mxx,
    minZ: miz,
    maxZ: maz,
    maxH: maxHVal,
    maxD: maxDVal,
    maxLargo: maxLargoVal,
    camTarget,
    camPos,
  };
}

function CameraRig({ position, target }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
  }, [camera, position, target]);
  return null;
}

function SlopeZoneMesh({ ancho, largo, ox, oz, thetaBase, slopeMark, profile, map }) {
  const invertSlope = slopeMark === "along_largo_neg";
  const thetaEff = invertSlope ? -thetaBase : thetaBase;
  const sinT = Math.sin(thetaEff);
  const cosT = Math.cos(thetaEff);
  const cy = largo * sinT / 2;
  const cz = -largo * cosT / 2;
  const rot = useMemo(() => [-Math.PI / 2 + thetaEff, 0, 0], [thetaEff]);

  return (
    <group position={[ox, 0, oz]}>
      <mesh position={[ancho / 2, cy, cz]} rotation={rot} castShadow receiveShadow>
        <planeGeometry args={[ancho, largo]} />
        <meshStandardMaterial
          color={map ? "#ffffff" : "#aeb8c8"}
          map={map || null}
          roughness={profile.roughness}
          metalness={profile.metalness}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function MapLoader({ mapUrl, render }) {
  const map = useTexture(mapUrl);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    const maxAni = gl.capabilities.getMaxAnisotropy?.() ?? 8;
    map.anisotropy = Math.min(16, maxAni);
    map.needsUpdate = true;
  }, [map, gl]);
  return render(map);
}

function RoofRealisticSceneContent({
  zoneLayouts,
  theta,
  profile,
  mapUrl,
  bounds,
}) {
  const orbitRef = useRef(null);
  const { minX, maxX, maxH, maxD, maxLargo, camTarget, camPos } = bounds;

  useEffect(() => {
    const oc = orbitRef.current;
    if (!oc) return;
    oc.target.set(camTarget[0], camTarget[1], camTarget[2]);
    oc.update();
  }, [camTarget]);

  const sceneBody = (map) => (
    <>
      <CameraRig position={camPos} target={camTarget} />
      <color attach="background" args={["#e8edf5"]} />
      <ambientLight intensity={0.58} />
      <directionalLight
        position={[(maxX - minX) * 1.2 + 4, maxH * 2 + 6, maxD + 5]}
        intensity={0.95}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-3, 5, -2]} intensity={0.28} />
      {zoneLayouts.map((z) => (
        <SlopeZoneMesh
          key={z.gi}
          ancho={z.ancho}
          largo={z.largo}
          ox={z.ox}
          oz={z.oz}
          thetaBase={theta}
          slopeMark={z.slopeMark}
          profile={profile}
          map={map}
        />
      ))}
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={camTarget}
        minDistance={Math.max(2, maxLargo * 0.35)}
        maxDistance={Math.max(18, maxLargo * 4)}
        maxPolarAngle={Math.PI / 2 - 0.06}
      />
    </>
  );

  if (!mapUrl) {
    return sceneBody(null);
  }
  return <MapLoader mapUrl={mapUrl} render={sceneBody} />;
}

/**
 * @param {{
 *   validZonas: Array<{ largo: number, ancho: number, preview?: object }>,
 *   tipoAguas: string,
 *   pendiente: number,
 *   familiaKey: string,
 *   espesorMm?: number|string,
 * }} props
 */
export default function RoofPanelRealisticScene({
  validZonas = [],
  tipoAguas = "una_agua",
  pendiente = 15,
  familiaKey = "",
  espesorMm,
}) {
  const tipoAguasStr = tipoAguas === "dos_aguas" ? "dos_aguas" : "una_agua";
  const theta = Math.max(0.05, (Number(pendiente) || 15) * (Math.PI / 180));
  const profile = useMemo(() => getRoofPanelVisualProfile(familiaKey, espesorMm), [familiaKey, espesorMm]);

  const zoneLayouts = useMemo(() => {
    try {
      return buildZoneLayoutsForRoof3d(validZonas, tipoAguasStr);
    } catch {
      return [];
    }
  }, [validZonas, tipoAguasStr]);

  const bounds = useMemo(() => computeSceneBounds(zoneLayouts, theta), [zoneLayouts, theta]);

  if (!zoneLayouts.length) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: 200,
          borderRadius: 10,
          border: `1px dashed ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.ts,
          fontSize: 13,
          background: C.surfaceAlt,
        }}
      >
        Ingresá dimensiones para ver el render referencial
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "clamp(220px, min(42vh, 440px), 520px)",
        minHeight: 220,
        borderRadius: 10,
        overflow: "hidden",
        background: "#e8edf5",
        border: `1px solid ${C.border}`,
      }}
    >
      <Canvas
        camera={{ position: bounds.camPos, fov: 36, near: 0.05, far: 400 }}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <Suspense fallback={null}>
          <RoofRealisticSceneContent
            zoneLayouts={zoneLayouts}
            theta={theta}
            profile={profile}
            mapUrl={profile.mapUrl}
            bounds={bounds}
          />
        </Suspense>
      </Canvas>
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 10,
          right: 10,
          fontSize: 10,
          color: "rgba(0,0,0,0.45)",
          pointerEvents: "none",
          textAlign: "center",
          lineHeight: 1.35,
        }}
      >
        Render referencial · textura catálogo · no sustituye medidas ni aspectos constructivos
      </div>
    </div>
  );
}
