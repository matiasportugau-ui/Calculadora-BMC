import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MAX_H } from "../../utils/bmcLogisticaCargo.js";
import { packageLabelCompact, packageLabelTiny } from "../../utils/logistica/packageIdentity.js";
import {
  formatPackageDimsLabel,
  packagePhysicalDims,
  packageRowYOffset,
} from "../../utils/logistica/packageDims.js";

const TRUCK_W = 2.4;
const ROW_W = 1.2;
const CAB_LEN_M = 2.4;
const CAB_HEIGHT_M = 1.5;

function hexToColor(hex) {
  if (!hex || typeof hex !== "string" || hex[0] !== "#") return "#888888";
  return hex;
}

function TruckCabin({ shiftX }) {
  const len = CAB_LEN_M;
  const h = CAB_HEIGHT_M;
  const cx = shiftX - len / 2;
  const cy = h / 2;
  const cz = TRUCK_W / 2;
  return (
    <group>
      <mesh position={[cx, cy, cz]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[len * 0.92, h * 0.85, TRUCK_W * 0.92]} />
        <meshStandardMaterial
          color="#7dd3fc"
          metalness={0.2}
          roughness={0.25}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[cx + len * 0.28, cy + h * 0.12, cz]} castShadow={false}>
        <boxGeometry args={[len * 0.12, h * 0.35, TRUCK_W * 0.88]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Free-drag: horizontal plane at current height (X along bed, Z across width → row).
 * Hold Shift while dragging to change height (Y / zBase).
 */
function CargoBox({
  pkg,
  shiftX,
  selected,
  dimmed,
  label,
  onSelect,
  freeDragEnabled,
  onFreeDragMove,
  onFreeDragEnd,
  onDragStateChange,
}) {
  const dims = packagePhysicalDims(pkg);
  const len = dims.L;
  const h = dims.H;
  const w = dims.W;
  const meshRef = useRef(null);
  const dragRef = useRef(null);
  const liveRef = useRef(null);
  const { camera, gl } = useThree();
  const [live, setLive] = useState(null);

  const setLiveBoth = useCallback((next) => {
    liveRef.current = next;
    setLive(next);
  }, []);

  const xStart = live?.xStart ?? pkg.xStart;
  const zBase = live?.zBase ?? pkg.zBase;
  const row = live?.row ?? pkg.row;

  const cx = shiftX + xStart + len / 2;
  const y0 = row === 1 ? ROW_W : 0;
  // accessories use packageRowYOffset for width centering; free-drag keeps row band
  const baseY0 = pkg.freeDrag || live ? y0 : packageRowYOffset({ ...pkg, row });
  const cz = baseY0 + w / 2;
  const cy = zBase + h / 2;
  const col = pkg.ov ? "#ff3b30" : pkg.freeDrag || live ? "#f59e0b" : hexToColor(pkg.sCol);
  const opacity = pkg.ov ? 0.85 : dimmed ? 0.22 : 1;

  const projectToPlane = useCallback(
    (clientX, clientY, planeY) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      return hit;
    },
    [camera, gl],
  );

  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      onSelect(pkg.id);
      if (!freeDragEnabled || !onFreeDragMove) return;
      e.target.setPointerCapture?.(e.pointerId);
      const planeY = cy;
      dragRef.current = {
        pointerId: e.pointerId,
        planeY,
        shiftHeight: Boolean(e.shiftKey),
        startClientY: e.clientY,
        startZBase: zBase,
      };
      onDragStateChange?.(true);
      setLiveBoth({ xStart, zBase, row });
    },
    [freeDragEnabled, onFreeDragMove, onSelect, pkg.id, cy, xStart, zBase, row, onDragStateChange, setLiveBoth],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || !freeDragEnabled) return;
      e.stopPropagation();

      if (e.shiftKey || d.shiftHeight) {
        // Vertical: 1px ≈ 0.01 m
        const dy = (d.startClientY - e.clientY) * 0.01;
        const nextZ = Math.max(0, d.startZBase + dy);
        const base = liveRef.current || { xStart, zBase, row };
        setLiveBoth({ ...base, zBase: nextZ });
        return;
      }

      const hit = projectToPlane(e.clientX, e.clientY, d.planeY);
      if (!hit) return;
      const nextXStart = hit.x - shiftX - len / 2;
      const nextRow = hit.z >= ROW_W ? 1 : 0;
      const base = liveRef.current || { xStart, zBase, row };
      setLiveBoth({ ...base, xStart: nextXStart, row: nextRow });
    },
    [freeDragEnabled, projectToPlane, shiftX, len, xStart, zBase, row, setLiveBoth],
  );

  const endDrag = useCallback(
    (e) => {
      if (!dragRef.current) return;
      e?.stopPropagation?.();
      const finalLive = liveRef.current;
      dragRef.current = null;
      onDragStateChange?.(false);
      if (finalLive && onFreeDragEnd) {
        onFreeDragEnd(pkg.stableKey, {
          xStart: finalLive.xStart,
          zBase: finalLive.zBase,
          row: finalLive.row,
          len,
        });
      }
      setLiveBoth(null);
    },
    [onFreeDragEnd, pkg.stableKey, len, onDragStateChange, setLiveBoth],
  );

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      onSelect(pkg.id);
    },
    [onSelect, pkg.id],
  );

  return (
    <mesh
      ref={meshRef}
      position={[cx, cy, cz]}
      castShadow
      receiveShadow
      userData={{ packageId: pkg.id, stableKey: pkg.stableKey }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <boxGeometry args={[len, h, w]} />
      <meshStandardMaterial
        color={col}
        metalness={0.15}
        roughness={0.55}
        opacity={opacity}
        transparent={Boolean(pkg.ov) || dimmed || Boolean(live) || Boolean(pkg.freeDrag)}
        emissive={selected || live ? "#ffffff" : "#000000"}
        emissiveIntensity={selected || live ? 0.38 : 0}
      />
      <Html
        center
        distanceFactor={10}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          textAlign: "center",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.15,
          textShadow: "0 1px 2px rgba(0,0,0,.85)",
          whiteSpace: "nowrap",
          opacity: dimmed ? 0.35 : 1,
        }}
        zIndexRange={[0, 0]}
      >
        <div>
          {label || packageLabelTiny(pkg, null, 22)}
          {pkg.freeDrag || live ? " · FREE" : ""}
        </div>
      </Html>
    </mesh>
  );
}

function TruckFloor({ shiftX, truckL, maxLen, totalLen }) {
  const cz = TRUCK_W / 2;
  const cxTruck = shiftX + truckL / 2;
  const salienteLen = maxLen > truckL ? maxLen - truckL : 0;
  const cxSaliente = shiftX + truckL + salienteLen / 2;
  const cxGround = shiftX + totalLen / 2;

  return (
    <group>
      <mesh position={[cxTruck, 0.012, cz]} receiveShadow>
        <boxGeometry args={[truckL, 0.024, TRUCK_W]} />
        <meshStandardMaterial color="#0d2137" metalness={0.05} roughness={0.9} />
      </mesh>
      {salienteLen > 0 ? (
        <mesh position={[cxSaliente, 0.011, cz]} receiveShadow>
          <boxGeometry args={[salienteLen, 0.022, TRUCK_W]} />
          <meshStandardMaterial color="#ff9f0a" metalness={0.05} roughness={0.85} transparent opacity={0.22} />
        </mesh>
      ) : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cxGround, 0, cz]} receiveShadow>
        <planeGeometry args={[totalLen + 2.5 + CAB_LEN_M, TRUCK_W + 2.5]} />
        <meshStandardMaterial color="#1a2f4a" metalness={0.02} roughness={1} />
      </mesh>
    </group>
  );
}

function HeightGuides({ shiftX, truckL }) {
  const h = MAX_H;
  const mat = "#ff3b30";
  const edges = [
    [
      [shiftX, 0, 0],
      [shiftX + truckL, 0, 0],
    ],
    [
      [shiftX, TRUCK_W, 0],
      [shiftX + truckL, TRUCK_W, 0],
    ],
    [
      [shiftX, 0, h],
      [shiftX + truckL, 0, h],
    ],
    [
      [shiftX, TRUCK_W, h],
      [shiftX + truckL, TRUCK_W, h],
    ],
    [
      [shiftX, 0, 0],
      [shiftX, 0, h],
    ],
    [
      [shiftX, TRUCK_W, 0],
      [shiftX, TRUCK_W, h],
    ],
    [
      [shiftX + truckL, 0, 0],
      [shiftX + truckL, 0, h],
    ],
    [
      [shiftX + truckL, TRUCK_W, 0],
      [shiftX + truckL, TRUCK_W, h],
    ],
  ];
  return (
    <group>
      {edges.map(([a, b], i) => (
        <Line key={i} points={[a, b]} color={mat} lineWidth={1} opacity={0.4} transparent />
      ))}
    </group>
  );
}

function SceneContent({
  placed,
  shiftX,
  truckL,
  maxLen,
  totalLen,
  selectedId,
  onSelectPackage,
  highlightKeys,
  bultoCounts,
  freeDragEnabled,
  onFreeDragMove,
  onFreeDragEnd,
  orbitEnabled,
  onDragStateChange,
}) {
  const cx = totalLen / 2;
  const targetY = MAX_H * 0.35;

  return (
    <>
      <color attach="background" args={["#0b1628"]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.05}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, 6, -2]} intensity={0.35} />
      <TruckCabin shiftX={shiftX} />
      <TruckFloor shiftX={shiftX} truckL={truckL} maxLen={maxLen} totalLen={totalLen} />
      <HeightGuides shiftX={shiftX} truckL={truckL} />
      {placed.map((pkg) => {
        const inGroup = !highlightKeys || highlightKeys.size === 0 || highlightKeys.has(pkg.stableKey);
        const isSelected =
          selectedId === pkg.id || (highlightKeys && highlightKeys.size > 0 && highlightKeys.has(pkg.stableKey));
        return (
          <CargoBox
            key={pkg.id}
            pkg={pkg}
            shiftX={shiftX}
            selected={Boolean(isSelected)}
            dimmed={!inGroup}
            label={packageLabelTiny(pkg, bultoCounts, 22)}
            onSelect={onSelectPackage}
            freeDragEnabled={freeDragEnabled}
            onFreeDragMove={onFreeDragMove}
            onFreeDragEnd={onFreeDragEnd}
            onDragStateChange={onDragStateChange}
          />
        );
      })}
      <OrbitControls
        makeDefault
        enabled={orbitEnabled}
        enableDamping
        dampingFactor={0.08}
        target={[cx, targetY, TRUCK_W / 2]}
        minDistance={2}
        maxDistance={28}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
    </>
  );
}

/**
 * Vista WebGL: bultos con etiqueta, free-drag opcional (toggle desde ops).
 */
export default function LogisticaCargoScene3d({
  placed,
  shiftX,
  truckL,
  maxLen,
  totalLen,
  onSelectStableKey,
  onForceRow,
  bultoCounts = null,
  highlightKeys = null,
  selectedPkgId = null,
  freeDragEnabled = false,
  onFreeDragEnd = null,
  onClearFreeDrag = null,
}) {
  const [selectedId, setSelectedId] = useState(selectedPkgId || null);
  const [dragging, setDragging] = useState(false);
  const cx = totalLen / 2;
  const cam = useMemo(() => [cx + 4.2, MAX_H + 2.4, TRUCK_W + 5.2], [cx]);

  useEffect(() => {
    if (selectedPkgId != null) setSelectedId(selectedPkgId);
  }, [selectedPkgId]);

  const onSelectPackage = useCallback(
    (id) => {
      setSelectedId(id);
      const pkg = placed.find((p) => p.id === id);
      if (pkg && onSelectStableKey) onSelectStableKey(pkg.stableKey, pkg);
    },
    [placed, onSelectStableKey],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!placed.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [placed, selectedId]);

  const selectedPkg = selectedId ? placed.find((p) => p.id === selectedId) : null;
  const selectedDims = selectedPkg ? packagePhysicalDims(selectedPkg) : null;

  return (
    <div style={{ width: "100%", height: 300, minHeight: 280, borderRadius: 8, overflow: "hidden", position: "relative" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: cam, fov: 48, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0b1628");
        }}
        onPointerMissed={() => {
          if (!dragging) setSelectedId(null);
        }}
      >
        <SceneContent
          placed={placed}
          shiftX={shiftX}
          truckL={truckL}
          maxLen={maxLen}
          totalLen={totalLen}
          selectedId={selectedId}
          onSelectPackage={onSelectPackage}
          highlightKeys={highlightKeys}
          bultoCounts={bultoCounts}
          freeDragEnabled={freeDragEnabled}
          onFreeDragMove={onFreeDragEnd}
          onFreeDragEnd={onFreeDragEnd}
          orbitEnabled={!dragging}
          onDragStateChange={setDragging}
        />
      </Canvas>
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 10,
          right: 10,
          fontSize: 12,
          color: "rgba(255,255,255,.9)",
          pointerEvents: selectedPkg ? "auto" : "none",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {selectedPkg ? (
          <div
            style={{
              background: "rgba(0,0,0,.55)",
              border: "1px solid rgba(255,255,255,.25)",
              borderRadius: 8,
              padding: "8px 10px",
              maxWidth: "100%",
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {packageLabelCompact(selectedPkg, bultoCounts)}
              {selectedPkg.freeDrag ? (
                <span style={{ marginLeft: 6, fontSize: 10, color: "#fbbf24" }}>FREE-DRAG</span>
              ) : null}
            </div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 11 }}>
              Cliente: <b>{selectedPkg.sCli || "—"}</b>
              {" · "}Pedido: <b>{selectedPkg.sPed || "—"}</b>
            </div>
            <div style={{ color: "rgba(255,255,255,.75)", fontSize: 11 }}>
              {selectedPkg.tipo || "—"} · {selectedPkg.n || 0} u. · Fila {selectedPkg.row === 0 ? "A" : "B"}
              {" · "}
              {formatPackageDimsLabel(selectedPkg, { includeVol: true })}
              {selectedPkg.stackId != null ? ` · pila ${selectedPkg.stackId}` : ""}
              {selectedPkg.ov ? " · ⚠️ altura" : ""}
            </div>
            {selectedDims ? (
              <div style={{ color: "rgba(255,255,255,.5)", fontSize: 10, marginTop: 2 }}>
                pos x={Number(selectedPkg.xStart).toFixed(2)}m · h={Number(selectedPkg.zBase).toFixed(2)}m
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {typeof onForceRow === "function" && !freeDragEnabled ? (
                <>
                  <button type="button" onClick={() => onForceRow(selectedPkg.stableKey, 0)} style={btnMini}>
                    → Fila A
                  </button>
                  <button type="button" onClick={() => onForceRow(selectedPkg.stableKey, 1)} style={btnMini}>
                    → Fila B
                  </button>
                </>
              ) : null}
              {freeDragEnabled && selectedPkg.freeDrag && typeof onClearFreeDrag === "function" ? (
                <button type="button" onClick={() => onClearFreeDrag(selectedPkg.stableKey)} style={btnMini}>
                  Quitar free-drag
                </button>
              ) : null}
              <button type="button" onClick={() => setSelectedId(null)} style={btnMini}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <span style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>
            {freeDragEnabled
              ? "Free-Drag ON · arrastrá bultos (Shift = altura) · naranja = posición libre"
              : "Clic en un bulto · k/N · #pedido · cliente · cabina a la izquierda"}
          </span>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 10,
          right: 10,
          fontSize: 11,
          color: freeDragEnabled ? "rgba(251,191,36,.85)" : "rgba(255,255,255,.45)",
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        {freeDragEnabled
          ? "FREE-DRAG · arrastrar bulto = mover · Shift+arrastrar = altura · órbita al soltar"
          : "Arrastrar · rueda zoom · clic derecho pan · vacío deselecciona"}
      </div>
    </div>
  );
}

const btnMini = {
  marginTop: 0,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,.3)",
  background: "rgba(255,255,255,.12)",
  color: "#fff",
  cursor: "pointer",
};
