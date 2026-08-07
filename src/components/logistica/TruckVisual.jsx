/**
 * Procedural BMC truck visual for LogisticaCargoScene3d.
 * Port of Grok sandbox TruckModel recipe (BmcCab / CargoBed / Wheel / CabDriver)
 * with coordinate remap to Calculadora packing space.
 *
 * Visual only — does NOT affect packing, free-drag, or cargo coordinates.
 *
 * Coords:
 *   TRUCK_W = 2.4
 *   Cargo X: [shiftX, shiftX + truckL]
 *   Cargo Z: [0, TRUCK_W], center = TRUCK_W/2
 *   Cab rear ≈ shiftX - 0.02 (X < shiftX)
 *
 * Props: { shiftX, truckL } only.
 *
 * Deck Y: packing-aligned (hybrid). Recipe deckTop=1.15 is scaled down so cargo
 * boxes at y≈0 sit on the visual deck; cab multi-mesh proportions preserved relative to chassis.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { axleCount } from "../../utils/logistica/truckAxles.js";

export { axleCount };
export const CAB_LIGHTS_MS = 10_000;

const TRUCK_W = 2.4;
const CABIN_LEN = 2.55;
const CABIN_WIDTH = 2.4;

// Colors — recipe B.1
const BMC_BLUE = "#1a4d7a";
const BMC_BLUE_LIT = "#2563a8";
const BMC_DARK = "#0f2a45";
const WOOD = "#9a6b42";
const WOOD_PLANK = "#7d5534";
const WOOD_DARK = "#5a3a22";
const METAL = "#3d4652";
const METAL_LIGHT = "#6a7480";
const CHROME = "#b8c0c8";
const RUBBER = "#1c1c1c";
const GLASS = "#9ec8e8";

// Hybrid vertical: packing boxes live near y=0 — keep deck low.
// Wheels/cab use readable ops scale (not full 1.15m deck).
const DECK_TOP = 0.055;
const DECK_THICK = 0.04;
const WHEEL_R = 0.42;
const WHEEL_Y = WHEEL_R * 0.92;
const TIRE_W = 0.26;

function paintMat(lit) {
  return {
    color: lit ? BMC_BLUE_LIT : BMC_BLUE,
    metalness: 0.28,
    roughness: 0.38,
    emissive: lit ? "#1a3a5c" : "#000000",
    emissiveIntensity: lit ? 0.28 : 0,
  };
}

function Wheel({ position, dual = false }) {
  const axleRot = [Math.PI / 2, 0, 0];
  const gap = TIRE_W * 0.58;
  const Tire = ({ zOff }) => (
    <group position={[0, 0, zOff]}>
      <mesh rotation={axleRot} castShadow={false}>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, TIRE_W, 16]} />
        <meshStandardMaterial color={RUBBER} roughness={0.95} metalness={0.05} />
      </mesh>
      <mesh rotation={axleRot} castShadow={false}>
        <cylinderGeometry args={[WHEEL_R * 0.55, WHEEL_R * 0.55, TIRE_W * 0.5, 12]} />
        <meshStandardMaterial color={METAL_LIGHT} metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  );
  return (
    <group position={position}>
      {dual ? (
        <>
          <Tire zOff={gap} />
          <Tire zOff={-gap} />
        </>
      ) : (
        <Tire zOff={0} />
      )}
    </group>
  );
}

function CabDriver({ lit }) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const tryUrl = (url, next) => {
      loader.load(
        url,
        (t) => {
          if (cancelled) return;
          t.colorSpace = THREE.SRGBColorSpace;
          t.needsUpdate = true;
          setTex(t);
        },
        undefined,
        () => {
          if (!cancelled && next) next();
          else if (!cancelled) setTex(null);
        },
      );
    };
    tryUrl("/bmo-mascot.png", () => tryUrl("/panelin-character/body_base.png", null));
    return () => {
      cancelled = true;
    };
  }, []);

  const h = 0.95;
  const w = h * (392 / 528);

  if (tex) {
    return (
      <group>
        <mesh position={[0, -0.45, 0]}>
          <boxGeometry args={[0.4, 0.1, 0.38]} />
          <meshStandardMaterial color={BMC_DARK} roughness={0.85} />
        </mesh>
        <mesh position={[0.12, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial
            map={tex}
            transparent
            opacity={lit ? 1 : 0.55}
            alphaTest={lit ? 0.08 : 0.12}
            color={lit ? "#ffffff" : "#0a0c10"}
            emissive={lit ? "#88ccee" : "#000000"}
            emissiveIntensity={lit ? 0.45 : 0}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={!lit}
          />
        </mesh>
        {lit ? (
          <pointLight position={[0.2, 0.1, 0]} intensity={2.2} distance={2.6} decay={1.4} color="#ffe6b0" />
        ) : null}
      </group>
    );
  }

  // Emissive silhouette fallback
  return (
    <group position={[0.1, 0, 0]}>
      <mesh>
        <boxGeometry args={[0.38, 0.55, 0.32]} />
        <meshStandardMaterial
          color="#2a9d8f"
          emissive={lit ? "#4ecdc4" : "#1a5c55"}
          emissiveIntensity={lit ? 0.75 : 0.15}
        />
      </mesh>
      <mesh position={[0.14, 0.08, 0]}>
        <boxGeometry args={[0.16, 0.22, 0.24]} />
        <meshStandardMaterial
          color="#111"
          emissive={lit ? "#66e0ff" : "#0a3040"}
          emissiveIntensity={lit ? 1.0 : 0.2}
        />
      </mesh>
      {lit ? <pointLight position={[0.25, 0.2, 0]} intensity={2.0} distance={2.5} color="#ffe6b0" /> : null}
    </group>
  );
}

/**
 * Multi-mesh FH cab. Local X: rear of cab at 0, front toward −X (sandbox convention).
 * World placement: group at z = TRUCK_W/2, rearX world = shiftX - 0.02.
 */
function BmcCab({ rearX, width, cabLit, onCabClick }) {
  const L = CABIN_LEN;
  const W = width;
  const y0 = 0.42;
  const paint = paintMat(cabLit);
  const glassOp = cabLit ? 0.32 : 0.48;
  const headEmissive = cabLit ? 2.8 : 0.55;

  const stop = useCallback((e) => {
    e.stopPropagation?.();
  }, []);

  const handleClick = useCallback(
    (e) => {
      stop(e);
      onCabClick?.(e);
    },
    [onCabClick, stop],
  );

  // World: cab local origin at rear; place so rear is at rearX (local x=0 → world rearX)
  // Sandbox BmcCab positions use negative X toward front from rear origin.
  return (
    <group position={[rearX, 0, TRUCK_W / 2]}>
      {/* Local coords: rear at x=0, front at x=-L */}
      <mesh position={[-L * 0.48, y0 + 0.72, 0]} castShadow={false}>
        <boxGeometry args={[L * 0.96, 1.35, W]} />
        <meshStandardMaterial {...paint} />
      </mesh>
      <mesh position={[-L * 0.42, y0 + 1.85, 0]} castShadow={false}>
        <boxGeometry args={[L * 0.78, 0.95, W * 0.96]} />
        <meshStandardMaterial {...paint} />
      </mesh>
      <mesh position={[-L * 0.42, y0 + 2.38, 0]} castShadow={false}>
        <boxGeometry args={[L * 0.72, 0.12, W * 0.88]} />
        <meshStandardMaterial color={BMC_DARK} metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh position={[-L * 0.78, y0 + 2.2, 0]} rotation={[0, 0, -0.25]} castShadow={false}>
        <boxGeometry args={[0.55, 0.18, W * 0.75]} />
        <meshStandardMaterial {...paint} />
      </mesh>
      {/* Windshield */}
      <mesh position={[-L * 0.92, y0 + 1.55, 0]} rotation={[0, 0, -0.38]} castShadow={false}>
        <boxGeometry args={[0.06, 1.05, W * 0.88]} />
        <meshStandardMaterial
          color={GLASS}
          transparent
          opacity={glassOp}
          metalness={0.1}
          roughness={0.12}
          depthWrite={false}
          emissive={cabLit ? "#9ec8e8" : "#000"}
          emissiveIntensity={cabLit ? 0.15 : 0}
        />
      </mesh>
      <mesh position={[-L * 0.9, y0 + 1.55, 0]} rotation={[0, 0, -0.38]} castShadow={false}>
        <boxGeometry args={[0.04, 1.12, W * 0.94]} />
        <meshStandardMaterial color={BMC_DARK} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Side glass */}
      <mesh position={[-L * 0.5, y0 + 1.55, W / 2 - 0.02]} castShadow={false}>
        <boxGeometry args={[L * 0.45, 0.7, 0.04]} />
        <meshStandardMaterial color={GLASS} transparent opacity={glassOp * 0.85} depthWrite={false} />
      </mesh>
      <mesh position={[-L * 0.5, y0 + 1.55, -(W / 2 - 0.02)]} castShadow={false}>
        <boxGeometry args={[L * 0.45, 0.7, 0.04]} />
        <meshStandardMaterial color={GLASS} transparent opacity={glassOp * 0.85} depthWrite={false} />
      </mesh>
      {/* Door panels */}
      <mesh position={[-L * 0.48, y0 + 0.75, W / 2 + 0.02]} castShadow={false}>
        <boxGeometry args={[L * 0.55, 1.2, 0.05]} />
        <meshStandardMaterial {...paint} />
      </mesh>
      <mesh position={[-L * 0.48, y0 + 0.75, -(W / 2 + 0.02)]} castShadow={false}>
        <boxGeometry args={[L * 0.55, 1.2, 0.05]} />
        <meshStandardMaterial {...paint} />
      </mesh>
      {/* Handles */}
      <mesh position={[-L * 0.35, y0 + 0.95, W / 2 + 0.06]} castShadow={false}>
        <boxGeometry args={[0.16, 0.05, 0.04]} />
        <meshStandardMaterial color={CHROME} metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[-L * 0.35, y0 + 0.95, -(W / 2 + 0.06)]} castShadow={false}>
        <boxGeometry args={[0.16, 0.05, 0.04]} />
        <meshStandardMaterial color={CHROME} metalness={0.85} roughness={0.25} />
      </mesh>
      {/* Bumper + grille */}
      <mesh position={[-L * 0.98, y0 + 0.28, 0]} castShadow={false}>
        <boxGeometry args={[0.22, 0.38, W * 0.98]} />
        <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[-L * 0.98, y0 + 0.85, 0]} castShadow={false}>
        <boxGeometry args={[0.1, 0.7, W * 0.62]} />
        <meshStandardMaterial color={BMC_DARK} metalness={0.45} roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[-L * 1.01, y0 + 0.55 + i * 0.12, 0]} castShadow={false}>
          <boxGeometry args={[0.04, 0.03, W * 0.55]} />
          <meshStandardMaterial color={CHROME} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {/* Headlights */}
      <mesh position={[-L * 0.99, y0 + 0.55, W * 0.34]} castShadow={false}>
        <boxGeometry args={[0.12, 0.2, 0.28]} />
        <meshStandardMaterial
          color="#fff7d6"
          emissive="#fde68a"
          emissiveIntensity={headEmissive}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[-L * 0.99, y0 + 0.55, -W * 0.34]} castShadow={false}>
        <boxGeometry args={[0.12, 0.2, 0.28]} />
        <meshStandardMaterial
          color="#fff7d6"
          emissive="#fde68a"
          emissiveIntensity={headEmissive}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>
      {/* Mirrors */}
      <mesh position={[-L * 0.88, y0 + 1.7, W / 2 + 0.22]} castShadow={false}>
        <boxGeometry args={[0.12, 0.35, 0.18]} />
        <meshStandardMaterial color={BMC_DARK} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[-L * 0.88, y0 + 1.7, -(W / 2 + 0.22)]} castShadow={false}>
        <boxGeometry args={[0.12, 0.35, 0.18]} />
        <meshStandardMaterial color={BMC_DARK} metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[-L * 0.88, y0 + 1.55, W / 2 + 0.12]} castShadow={false}>
        <boxGeometry args={[0.06, 0.06, 0.2]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-L * 0.88, y0 + 1.55, -(W / 2 + 0.12)]} castShadow={false}>
        <boxGeometry args={[0.06, 0.06, 0.2]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Steps */}
      <mesh position={[-L * 0.5, y0 + 0.08, W / 2 + 0.08]} castShadow={false}>
        <boxGeometry args={[L * 0.4, 0.08, 0.18]} />
        <meshStandardMaterial color={METAL} metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh position={[-L * 0.5, y0 + 0.08, -(W / 2 + 0.08)]} castShadow={false}>
        <boxGeometry args={[L * 0.4, 0.08, 0.18]} />
        <meshStandardMaterial color={METAL} metalness={0.45} roughness={0.5} />
      </mesh>
      {/* Rear wall (faces bed) */}
      <mesh position={[-0.04, y0 + 1.2, 0]} castShadow={false}>
        <boxGeometry args={[0.1, 2.2, W * 0.96]} />
        <meshStandardMaterial color={BMC_DARK} metalness={0.25} roughness={0.55} />
      </mesh>
      {/* Small rear window so rear isn't a blank wall */}
      <mesh position={[-0.02, y0 + 1.65, 0]} castShadow={false}>
        <boxGeometry args={[0.06, 0.45, W * 0.45]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {/* Fuel tank */}
      <mesh position={[-L * 0.25, y0 + 0.35, W / 2 + 0.05]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.28, 0.28, 0.9, 14]} />
        <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.45} />
      </mesh>
      {/* Interior backplate + Panelín (face +X toward windshield / cabin interior) */}
      <mesh position={[-L * 0.55, y0 + 1.35, 0]} castShadow={false}>
        <boxGeometry args={[0.08, 1.1, W * 0.7]} />
        <meshStandardMaterial color="#0a1018" roughness={0.9} />
      </mesh>
      <group position={[-L * 0.48, y0 + 1.45, W * 0.08]}>
        <CabDriver lit={cabLit} />
      </group>
      {cabLit ? (
        <>
          <pointLight position={[-L * 0.4, y0 + 1.9, 0]} intensity={3.2} distance={3.6} decay={1.25} color="#fff2d0" />
          <spotLight
            position={[-L * 1.02, y0 + 0.55, W * 0.28]}
            angle={0.42}
            penumbra={0.45}
            intensity={14}
            distance={22}
            decay={1.15}
            color="#fff5d6"
            castShadow={false}
          />
          <spotLight
            position={[-L * 1.02, y0 + 0.55, -W * 0.28]}
            angle={0.42}
            penumbra={0.45}
            intensity={14}
            distance={22}
            decay={1.15}
            color="#fff5d6"
            castShadow={false}
          />
        </>
      ) : null}
      {/* Click hitbox */}
      <mesh
        position={[-L * 0.5, y0 + 1.2, 0]}
        onClick={handleClick}
        onPointerDown={stop}
        onPointerUp={stop}
        onPointerOver={(e) => {
          stop(e);
          if (typeof document !== "undefined") document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (typeof document !== "undefined") document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[L + 0.3, 2.9, W * 1.15]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Flat cargo bed — local origin at bed center, ±halfL / ±halfW.
 * deckTop packing-aligned (hybrid).
 */
function CargoBed({ lengthM, widthM }) {
  const halfL = lengthM / 2;
  const halfW = widthM / 2;
  const deckTop = DECK_TOP;
  const chassisY = deckTop - 0.08;
  const plankCount = Math.max(8, Math.round(lengthM * 3));
  const plankW = lengthM / plankCount;

  const planks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < plankCount; i++) {
      const x = -halfL + plankW * (i + 0.5);
      arr.push({ x, color: i % 2 === 0 ? WOOD : WOOD_PLANK });
    }
    return arr;
  }, [halfL, plankCount, plankW]);

  const crossN = Math.max(4, Math.round(lengthM / 1.2));
  const crosses = useMemo(() => {
    const arr = [];
    for (let i = 0; i < crossN; i++) {
      arr.push(-halfL + (lengthM * (i + 0.5)) / crossN);
    }
    return arr;
  }, [crossN, halfL, lengthM]);

  return (
    <group>
      {/* Chassis long beams */}
      <mesh position={[0, chassisY, halfW * 0.35]} castShadow={false}>
        <boxGeometry args={[lengthM + 0.2, 0.1, 0.12]} />
        <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.55} />
      </mesh>
      <mesh position={[0, chassisY, -halfW * 0.35]} castShadow={false}>
        <boxGeometry args={[lengthM + 0.2, 0.1, 0.12]} />
        <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.55} />
      </mesh>
      {crosses.map((x) => (
        <mesh key={x} position={[x, chassisY, 0]} castShadow={false}>
          <boxGeometry args={[0.08, 0.08, widthM * 0.72]} />
          <meshStandardMaterial color={METAL} metalness={0.35} roughness={0.6} />
        </mesh>
      ))}
      {/* Deck slab — just under packing plane */}
      <mesh position={[0, deckTop - DECK_THICK / 2, 0]} receiveShadow castShadow={false}>
        <boxGeometry args={[lengthM, DECK_THICK, widthM]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.88} metalness={0.04} />
      </mesh>
      {/* Wood planks */}
      {planks.map((p, i) => (
        <mesh key={i} position={[p.x, deckTop + 0.004, 0]} receiveShadow castShadow={false}>
          <boxGeometry args={[plankW * 0.92, 0.008, widthM * 0.985]} />
          <meshStandardMaterial color={p.color} roughness={0.9} metalness={0.03} />
        </mesh>
      ))}
      {/* Side sills only — no barandas */}
      <mesh position={[0, deckTop + 0.015, halfW - 0.015]} castShadow={false}>
        <boxGeometry args={[lengthM, 0.02, 0.03]} />
        <meshStandardMaterial color={METAL} metalness={0.35} roughness={0.6} />
      </mesh>
      <mesh position={[0, deckTop + 0.015, -(halfW - 0.015)]} castShadow={false}>
        <boxGeometry args={[lengthM, 0.02, 0.03]} />
        <meshStandardMaterial color={METAL} metalness={0.35} roughness={0.6} />
      </mesh>
      {/* Front bulkhead (cab side = −X local) */}
      <mesh position={[-halfL + 0.05, deckTop + 0.35, 0]} castShadow={false}>
        <boxGeometry args={[0.08, 0.7, widthM * 0.98]} />
        <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.55} />
      </mesh>
      <mesh position={[-halfL + 0.08, deckTop + 0.32, 0]} castShadow={false}>
        <boxGeometry args={[0.04, 0.62, widthM * 0.7]} />
        <meshStandardMaterial color={BMC_DARK} metalness={0.3} roughness={0.55} />
      </mesh>
      {/* Rear underrun */}
      <mesh position={[halfL + 0.06, deckTop - 0.12, 0]} castShadow={false}>
        <boxGeometry args={[0.1, 0.14, widthM * 0.92]} />
        <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.55} />
      </mesh>
      {/* Rear sill tip */}
      <mesh position={[halfL - 0.03, deckTop + 0.015, 0]} castShadow={false}>
        <boxGeometry args={[0.05, 0.02, widthM * 0.98]} />
        <meshStandardMaterial color={METAL} metalness={0.35} roughness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * @param {{ shiftX: number, truckL: number }} props
 */
export default function TruckVisual({ shiftX, truckL }) {
  const [lightsOn, setLightsOn] = useState(false);
  const timerRef = useRef(null);

  const halfL = truckL / 2;
  const halfW = TRUCK_W / 2;
  const bedCenterX = shiftX + halfL;
  const bedCenterZ = halfW;

  const cabRearX = shiftX - 0.02;
  const cabCenterX = cabRearX - CABIN_LEN / 2;
  const cabWidth = Math.min(TRUCK_W + 0.1, CABIN_WIDTH);
  const axles = axleCount(truckL);

  const frontAxleX = cabCenterX - 0.65;
  const midAxleX = shiftX + truckL * 0.28;
  const rearAxleX = axles === 2 ? shiftX + truckL - 1.0 : shiftX + truckL - 0.75;
  const dualZLocal = halfW - 0.06;
  const frontZLocal = Math.min(halfW + 0.05, 1.15);

  const onCabClick = useCallback(() => {
    setLightsOn(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLightsOn(false);
      timerRef.current = null;
    }, CAB_LIGHTS_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <group>
      <BmcCab rearX={cabRearX} width={cabWidth} cabLit={lightsOn} onCabClick={onCabClick} />

      <group position={[bedCenterX, 0, bedCenterZ]}>
        <CargoBed lengthM={truckL} widthM={TRUCK_W} />
      </group>

      {/* Front singles */}
      <Wheel position={[frontAxleX, WHEEL_Y, bedCenterZ + frontZLocal]} dual={false} />
      <Wheel position={[frontAxleX, WHEEL_Y, bedCenterZ - frontZLocal]} dual={false} />

      {/* Mid duals (3-axle only) */}
      {axles === 3 ? (
        <>
          <Wheel position={[midAxleX, WHEEL_Y, bedCenterZ + dualZLocal]} dual />
          <Wheel position={[midAxleX, WHEEL_Y, bedCenterZ - dualZLocal]} dual />
        </>
      ) : null}

      {/* Rear duals */}
      <Wheel position={[rearAxleX, WHEEL_Y, bedCenterZ + dualZLocal]} dual />
      <Wheel position={[rearAxleX, WHEEL_Y, bedCenterZ - dualZLocal]} dual />
    </group>
  );
}
