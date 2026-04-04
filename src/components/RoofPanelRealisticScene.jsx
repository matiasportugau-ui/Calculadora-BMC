// ═══════════════════════════════════════════════════════════════════════════
// RoofPanelRealisticScene — Vista 3D referencial con textura de catálogo por familia
// (paralela al RoofPreview 2D; misma planta que RoofBorderCanvas).
// ═══════════════════════════════════════════════════════════════════════════

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { buildZoneLayoutsForRoof3d } from "../utils/roofZoneLayouts3d.js";
import { buildAnchoStripsPlanta } from "../utils/roofPanelStripsPlanta.js";
import { getRoofPanelVisualProfile } from "../data/roofPanelVisualProfiles.js";
import { C } from "../data/constants.js";

function computeSceneBounds(zoneLayouts, theta, fovDeg = 36) {
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
  let miy = 0;
  let may = 0;
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
    const peakY = r.largo * sinT;
    may = Math.max(may, peakY);
    ml = Math.max(ml, r.largo);
  }
  const maxLargoVal = ml;
  const maxHVal = may;
  const maxDVal = maxLargoVal * cosT;

  const cx = (mix + mxx) / 2;
  const cy = (miy + may) / 2;
  const cz = (miz + maz) / 2;
  const camTarget = [cx, cy, cz];

  const dx = (mxx - mix) / 2;
  const dy = (may - miy) / 2;
  const dz = (maz - miz) / 2;
  const boundRadius = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  const fovRad = (fovDeg * Math.PI) / 180;
  const margin = 1.35;
  const dist = (boundRadius * margin) / Math.sin(fovRad / 2);

  const elevAngle = 0.55;
  const azimAngle = 0.15;
  const camPos = [
    cx + dist * Math.sin(azimAngle) * Math.cos(elevAngle),
    cy + dist * Math.sin(elevAngle),
    cz + dist * Math.cos(azimAngle) * Math.cos(elevAngle),
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

function CameraRig({ position, target, bounds }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);

    const aspect = size.width / (size.height || 1);
    const { minX, maxX, minZ, maxZ, maxH } = bounds;
    const dx = (maxX - minX) / 2;
    const dy = maxH / 2;
    const dz = (maxZ - minZ) / 2;
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const effectiveFov = Math.min(vFov, hFov);
    const minDist = (radius * 1.35) / Math.sin(effectiveFov / 2);
    const currentDist = camera.position.distanceTo(
      new THREE.Vector3(target[0], target[1], target[2])
    );
    if (currentDist < minDist) {
      const dir = new THREE.Vector3()
        .subVectors(camera.position, new THREE.Vector3(target[0], target[1], target[2]))
        .normalize();
      camera.position.copy(
        new THREE.Vector3(target[0], target[1], target[2]).add(dir.multiplyScalar(minDist))
      );
    }
    camera.updateProjectionMatrix();
  }, [camera, position, target, bounds, size]);
  return null;
}

/** Una franja en X (ancho en planta); misma lógica de anchos que `RoofPreview` / `buildAnchoStripsPlanta`. */
function RoofStripMesh({ stripX, stripW, stripIdx, largo, cy, cz, rot, map, panelAu, profile }) {
  const mat = useMemo(() => {
    const auRep = panelAu > 0 ? panelAu : Math.max(stripW, 1e-6);
    const baseColor = stripIdx % 2 === 0 ? 0xb8c4d4 : 0xa3b0c2;
    const m = new THREE.MeshStandardMaterial({
      color: map ? "#ffffff" : baseColor,
      roughness: profile.roughness,
      metalness: profile.metalness,
      side: THREE.DoubleSide,
    });
    if (map) {
      const t = map.clone();
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(stripW / auRep, Math.max(0.4, largo / auRep));
      t.offset.set(stripX / auRep, 0);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      m.map = t;
    }
    return m;
  }, [stripX, stripW, stripIdx, largo, map, panelAu, profile]);

  useEffect(
    () => () => {
      mat.dispose();
      if (mat.map) mat.map.dispose();
    },
    [mat]
  );

  return (
    <mesh position={[stripX + stripW / 2, cy, cz]} rotation={rot} castShadow receiveShadow material={mat}>
      <planeGeometry args={[stripW, largo]} />
    </mesh>
  );
}

function SlopeZoneStripedMeshes({ ancho, largo, ox, oz, thetaBase, slopeMark, profile, map, panelAu }) {
  const strips = useMemo(() => {
    if (!(ancho > 0)) return [];
    if (!(panelAu > 0)) return [{ x0: 0, width: ancho, idx: 0 }];
    const s = buildAnchoStripsPlanta(ancho, panelAu);
    return s.length ? s : [{ x0: 0, width: ancho, idx: 0 }];
  }, [ancho, panelAu]);

  const invertSlope = slopeMark === "along_largo_neg";
  const thetaEff = invertSlope ? -thetaBase : thetaBase;
  const sinT = Math.sin(thetaEff);
  const cosT = Math.cos(thetaEff);
  const cy = largo * sinT / 2;
  const cz = -largo * cosT / 2;
  const rot = useMemo(() => [-Math.PI / 2 + thetaEff, 0, 0], [thetaEff]);

  const auForUv = panelAu > 0 ? panelAu : ancho;

  return (
    <group position={[ox, 0, oz]}>
      {strips.map((s) => (
        <RoofStripMesh
          key={`${s.idx}-${s.x0}-${s.width}`}
          stripX={s.x0}
          stripW={s.width}
          stripIdx={s.idx}
          largo={largo}
          cy={cy}
          cz={cz}
          rot={rot}
          map={map}
          panelAu={auForUv}
          profile={profile}
        />
      ))}
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
  panelAu,
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
      <CameraRig position={camPos} target={camTarget} bounds={bounds} />
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
        <SlopeZoneStripedMeshes
          key={z.gi}
          ancho={z.ancho}
          largo={z.largo}
          ox={z.ox}
          oz={z.oz}
          thetaBase={theta}
          slopeMark={z.slopeMark}
          profile={profile}
          map={map}
          panelAu={panelAu}
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
 *   panelAu?: number,
 * }} props
 */
export default function RoofPanelRealisticScene({
  validZonas = [],
  tipoAguas = "una_agua",
  pendiente = 15,
  familiaKey = "",
  espesorMm,
  panelAu = 1.12,
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
        data-bmc-view="roof-panel-realistic-3d"
        data-bmc-component="RoofPanelRealisticScene"
        data-bmc-state="empty"
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
      data-bmc-view="roof-panel-realistic-3d"
      data-bmc-component="RoofPanelRealisticScene"
      data-bmc-state="canvas"
      title="Render 3D referencial techo (textura catálogo, rejilla au)"
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
            panelAu={panelAu}
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
        Render referencial · misma rejilla au que la vista 2D · textura catálogo · no sustituye medidas ni aspectos constructivos
      </div>
    </div>
  );
}
