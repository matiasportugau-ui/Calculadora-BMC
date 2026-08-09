/**
 * Procedural BMC truck visual for LogisticaCargoScene3d.
 * Visual only — does not affect packing, free-drag, or cargo coordinates.
 *
 * Coords (must match scene contract):
 *   TRUCK_W = 2.4
 *   Cargo X: [shiftX, shiftX + truckL]
 *   Cargo Z: [0, TRUCK_W], center = TRUCK_W/2
 *   Cab sits at X < shiftX (left of cargo)
 *   Truck nose / front faces −X (away from bed); cab rear faces +X (toward bulkhead)
 *
 * Props: { shiftX, truckL } only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { axleCount } from "../../utils/logistica/truckAxles.js";

const TRUCK_W = 2.4;
const CAB_LEN = 2.4;
const CAB_H = 2.35;
const DECK_Y = 0.028; // just above TruckFloor deck (y≈0.024 top) to avoid z-fight
const SILL_H = 0.12;
const BULKHEAD_H = 0.55;
const WHEEL_R = 0.42;
const WHEEL_W = 0.22;
/** Cab-click headlights + interior light duration (ms). */
export const CAB_LIGHTS_MS = 10_000;

const BMC_BLUE = "#0B3D91";
const BMC_BLUE_MID = "#1a4d7a";
const BMC_DARK = "#0f2a45";
const WOOD = "#b07d4e"; // slightly lighter for readability under work lighting
const METAL = "#4a5562";
const GLASS = "#b8dcf0";
const RUBBER = "#1c1c1c";
const HEADLIGHT_OFF = "#e4e4e7";
const HEADLIGHT_ON = "#fff7d6";
/** Slight emissive on paint so cab/bed don’t sink into dark environment */
const PAINT_EMISSIVE = "#0a1f3a";
const PAINT_EMISSIVE_I = 0.06;

// Re-export for callers that import axle helper from the visual module.
export { axleCount };

function Wheel({ position, dual = false }) {
  const one = (zOffset) => (
    <group position={[position[0], position[1], position[2] + zOffset]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, WHEEL_W, 20]} />
        <meshStandardMaterial color={RUBBER} roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <cylinderGeometry args={[WHEEL_R * 0.45, WHEEL_R * 0.45, WHEEL_W * 1.05, 12]} />
        <meshStandardMaterial color={METAL} roughness={0.45} metalness={0.55} />
      </mesh>
    </group>
  );

  if (!dual) {
    return (
      <group>
        {one(-TRUCK_W * 0.42)}
        {one(TRUCK_W * 0.42)}
      </group>
    );
  }

  // Duals: two tires per side under bed
  const gap = WHEEL_W * 1.15;
  return (
    <group>
      {one(-TRUCK_W * 0.42 - gap / 2)}
      {one(-TRUCK_W * 0.42 + gap / 2)}
      {one(TRUCK_W * 0.42 - gap / 2)}
      {one(TRUCK_W * 0.42 + gap / 2)}
    </group>
  );
}

function CabDriver({ lit }) {
  // Prefer bmo-mascot; fall back to panelin body_base; never crash on missing texture.
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

  const emissive = lit ? 0.55 : 0.12;
  const opacity = lit ? 0.95 : 0.72;

  // Face truck front (−X): plane default faces +Z; −Y90 → looks along −X
  if (tex) {
    return (
      <mesh position={[-0.12, 1.15, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.55, 0.7]} />
        <meshStandardMaterial
          map={tex}
          transparent
          opacity={opacity}
          emissive="#88ccee"
          emissiveIntensity={emissive}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    );
  }

  // Emissive box silhouette fallback (Panelín-ish screen + body)
  return (
    <group position={[-0.08, 1.05, 0]}>
      <mesh>
        <boxGeometry args={[0.35, 0.45, 0.28]} />
        <meshStandardMaterial
          color="#2a9d8f"
          emissive={lit ? "#4ecdc4" : "#1a5c55"}
          emissiveIntensity={lit ? 0.7 : 0.15}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[-0.12, 0.08, 0]}>
        <boxGeometry args={[0.18, 0.2, 0.22]} />
        <meshStandardMaterial
          color="#111"
          emissive={lit ? "#66e0ff" : "#0a3040"}
          emissiveIntensity={lit ? 0.9 : 0.2}
        />
      </mesh>
    </group>
  );
}

function BmcCab({ cabCenterX, lightsOn, onCabClick }) {
  const cz = TRUCK_W / 2;
  const bodyH = CAB_H * 0.72;
  const bodyY = bodyH / 2 + 0.55;
  const roofH = 0.38;
  const roofY = bodyY + bodyH / 2 + roofH / 2 - 0.04;

  const stop = useCallback(
    (e) => {
      e.stopPropagation?.();
      if (e.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
    },
    [],
  );

  const handleClick = useCallback(
    (e) => {
      stop(e);
      onCabClick?.(e);
    },
    [onCabClick, stop],
  );

  const headEmissive = lightsOn ? HEADLIGHT_ON : HEADLIGHT_OFF;
  const headIntensity = lightsOn ? 1.2 : 0.05;

  // Local X: −X = truck nose (away from bed), +X = cab rear (toward cargo bulkhead at shiftX)
  return (
    <group position={[cabCenterX, 0, cz]}>
      {/* Main body */}
      <mesh position={[-0.05, bodyY, 0]} castShadow={false}>
        <boxGeometry args={[CAB_LEN * 0.88, bodyH, TRUCK_W * 0.9]} />
        <meshStandardMaterial
          color={BMC_BLUE}
          metalness={0.28}
          roughness={0.42}
          emissive={PAINT_EMISSIVE}
          emissiveIntensity={PAINT_EMISSIVE_I}
        />
      </mesh>
      {/* High roof / sleeper bias slightly rearward */}
      <mesh position={[0.05, roofY, 0]} castShadow={false}>
        <boxGeometry args={[CAB_LEN * 0.72, roofH, TRUCK_W * 0.86]} />
        <meshStandardMaterial
          color={BMC_BLUE_MID}
          metalness={0.26}
          roughness={0.46}
          emissive={PAINT_EMISSIVE}
          emissiveIntensity={PAINT_EMISSIVE_I}
        />
      </mesh>
      {/* Windshield — nose */}
      <mesh position={[-CAB_LEN * 0.32, bodyY + 0.25, 0]} castShadow={false}>
        <boxGeometry args={[0.08, bodyH * 0.55, TRUCK_W * 0.78]} />
        <meshStandardMaterial
          color={GLASS}
          transparent
          opacity={0.35}
          metalness={0.1}
          roughness={0.15}
          depthWrite={false}
        />
      </mesh>
      {/* Side windows */}
      <mesh position={[-0.05, bodyY + 0.22, TRUCK_W * 0.46]} castShadow={false}>
        <boxGeometry args={[CAB_LEN * 0.5, bodyH * 0.35, 0.04]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh position={[-0.05, bodyY + 0.22, -TRUCK_W * 0.46]} castShadow={false}>
        <boxGeometry args={[CAB_LEN * 0.5, bodyH * 0.35, 0.04]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {/* Grille — nose */}
      <mesh position={[-CAB_LEN * 0.42, 0.85, 0]} castShadow={false}>
        <boxGeometry args={[0.1, 0.55, TRUCK_W * 0.7]} />
        <meshStandardMaterial color={BMC_DARK} metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Bumper — nose */}
      <mesh position={[-CAB_LEN * 0.45, 0.38, 0]} castShadow={false}>
        <boxGeometry args={[0.18, 0.22, TRUCK_W * 0.95]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Headlights — nose */}
      <mesh position={[-CAB_LEN * 0.46, 0.72, TRUCK_W * 0.32]} castShadow={false}>
        <boxGeometry args={[0.12, 0.16, 0.22]} />
        <meshStandardMaterial
          color={headEmissive}
          emissive={headEmissive}
          emissiveIntensity={headIntensity}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[-CAB_LEN * 0.46, 0.72, -TRUCK_W * 0.32]} castShadow={false}>
        <boxGeometry args={[0.12, 0.16, 0.22]} />
        <meshStandardMaterial
          color={headEmissive}
          emissive={headEmissive}
          emissiveIntensity={headIntensity}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>
      {/* Mirrors — near A-pillar / front doors */}
      <mesh position={[-CAB_LEN * 0.2, bodyY + 0.35, TRUCK_W * 0.52]} castShadow={false}>
        <boxGeometry args={[0.12, 0.28, 0.08]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-CAB_LEN * 0.2, bodyY + 0.35, -TRUCK_W * 0.52]} castShadow={false}>
        <boxGeometry args={[0.12, 0.28, 0.08]} />
        <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Fuel tank silhouette (driver side, mid-cab toward rear) */}
      <mesh position={[CAB_LEN * 0.15, 0.7, -TRUCK_W * 0.48]} castShadow={false}>
        <cylinderGeometry args={[0.16, 0.16, 0.7, 12]} />
        <meshStandardMaterial color={METAL} metalness={0.55} roughness={0.45} />
      </mesh>
      {/* Cab rear wall facing cargo bulkhead */}
      <mesh position={[CAB_LEN * 0.42, bodyY, 0]} castShadow={false}>
        <boxGeometry args={[0.1, bodyH * 0.95, TRUCK_W * 0.92]} />
        <meshStandardMaterial color={BMC_DARK} metalness={0.25} roughness={0.55} />
      </mesh>
      {/* Interior cabin floor / seat block */}
      <mesh position={[0.1, 0.85, 0]} castShadow={false}>
        <boxGeometry args={[CAB_LEN * 0.55, 0.15, TRUCK_W * 0.7]} />
        <meshStandardMaterial color={BMC_DARK} roughness={0.8} />
      </mesh>
      {/* Interior light when on */}
      {lightsOn ? (
        <pointLight position={[0, 1.9, 0]} intensity={1.4} distance={4} color="#fff4e0" />
      ) : null}
      {lightsOn ? (
        <>
          {/* Spotlights sit at nose (−X); default −Z aim is fine for ambient fill */}
          <spotLight
            position={[-CAB_LEN * 0.55, 0.95, TRUCK_W * 0.28]}
            angle={0.5}
            penumbra={0.45}
            intensity={2.4}
            distance={14}
            color="#fff7d6"
            castShadow={false}
          />
          <spotLight
            position={[-CAB_LEN * 0.55, 0.95, -TRUCK_W * 0.28]}
            angle={0.5}
            penumbra={0.45}
            intensity={2.4}
            distance={14}
            color="#fff7d6"
            castShadow={false}
          />
          <pointLight position={[-CAB_LEN * 0.6, 0.7, 0]} intensity={1.1} distance={10} color="#fff7d6" />
        </>
      ) : null}
      <CabDriver lit={lightsOn} />
      {/* Click catcher — full cab volume, invisible */}
      <mesh
        position={[0, bodyY, 0]}
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
        <boxGeometry args={[CAB_LEN * 0.95, CAB_H * 0.95, TRUCK_W * 0.98]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CargoBed({ shiftX, truckL }) {
  const cz = TRUCK_W / 2;
  const cx = shiftX + truckL / 2;
  const deckT = 0.04;
  // Decorative wood deck slightly above TruckFloor — packing still uses TruckFloor plane
  return (
    <group>
      {/* Flat wood deck */}
      <mesh position={[cx, DECK_Y, cz]} receiveShadow castShadow={false}>
        <boxGeometry args={[truckL * 0.995, deckT, TRUCK_W * 0.98]} />
        <meshStandardMaterial color={WOOD} roughness={0.78} metalness={0.04} emissive="#3a2410" emissiveIntensity={0.04} />
      </mesh>
      {/* Front bulkhead at shiftX */}
      <mesh position={[shiftX + 0.04, DECK_Y + BULKHEAD_H / 2, cz]} castShadow={false}>
        <boxGeometry args={[0.08, BULKHEAD_H, TRUCK_W * 0.98]} />
        <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.55} />
      </mesh>
      {/* Low side sills only — no barandas */}
      <mesh position={[cx, DECK_Y + SILL_H / 2, 0.04]} castShadow={false}>
        <boxGeometry args={[truckL * 0.99, SILL_H, 0.06]} />
        <meshStandardMaterial color={METAL} metalness={0.35} roughness={0.6} />
      </mesh>
      <mesh position={[cx, DECK_Y + SILL_H / 2, TRUCK_W - 0.04]} castShadow={false}>
        <boxGeometry args={[truckL * 0.99, SILL_H, 0.06]} />
        <meshStandardMaterial color={METAL} metalness={0.35} roughness={0.6} />
      </mesh>
      {/* Rear sill tip */}
      <mesh position={[shiftX + truckL - 0.04, DECK_Y + SILL_H / 2, cz]} castShadow={false}>
        <boxGeometry args={[0.06, SILL_H, TRUCK_W * 0.98]} />
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

  const cabCenterX = shiftX - CAB_LEN / 2;
  const nAxles = axleCount(truckL);
  const wheelY = WHEEL_R * 0.92;

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

  // Axle X positions — front under nose (−X of cab), rear dual(s) under bed
  const frontAxleX = cabCenterX - CAB_LEN * 0.28;
  const bedStart = shiftX;
  const rearAxles =
    nAxles === 2
      ? [bedStart + truckL * 0.72]
      : [bedStart + truckL * 0.55, bedStart + truckL * 0.82];

  return (
    <group>
      <BmcCab cabCenterX={cabCenterX} lightsOn={lightsOn} onCabClick={onCabClick} />
      <CargoBed shiftX={shiftX} truckL={truckL} />
      {/* Front axle (singles) */}
      <Wheel position={[frontAxleX, wheelY, TRUCK_W / 2]} dual={false} />
      {/* Rear dual axle(s) */}
      {rearAxles.map((x) => (
        <Wheel key={x} position={[x, wheelY, TRUCK_W / 2]} dual />
      ))}
    </group>
  );
}
