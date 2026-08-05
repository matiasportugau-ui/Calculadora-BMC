import { useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { MAX_H } from "../../utils/bmcLogisticaCargo.js";
import { packageIdentityLabel } from "../../utils/logistica/loadPlanPrintModel.js";

const TRUCK_W = 2.4;
const ROW_W = 1.2;
const CAB_LEN_M = 2.4;
const CAB_HEIGHT_M = 1.5;

function hexToColor(hex) {
  if (!hex || typeof hex !== "string" || hex[0] !== "#") return "#888888";
  return hex;
}

function truncate(s, n = 18) {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function packageLabelShort(pkg) {
  if (!pkg) return "";
  return pkg.kind === "accessory" ? `P${pkg.sOrd}·ACC` : `P${pkg.sOrd}·${pkg.n}`;
}

function TruckCabin({ shiftX }) {
  // Cabina a la izquierda del lecho (x < shiftX). Decorativa — no afecta packing.
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
      {/* windshield hint */}
      <mesh position={[cx + len * 0.28, cy + h * 0.12, cz]} castShadow={false}>
        <boxGeometry args={[len * 0.12, h * 0.35, TRUCK_W * 0.88]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CargoBox({ pkg, shiftX, selected, onSelect }) {
  const len = pkg.len;
  const h = pkg.h;
  const cx = shiftX + pkg.xStart + len / 2;
  const cz = pkg.row * ROW_W + ROW_W / 2;
  const cy = pkg.zBase + h / 2;
  const col = pkg.ov ? "#ff3b30" : hexToColor(pkg.sCol);
  const cli = truncate(pkg.sCli, 16);
  const ped = String(pkg.sPed || "").trim();
  const line2 = ped ? `#${truncate(ped, 14)}` : packageLabelShort(pkg);

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      onSelect(pkg.id);
    },
    [onSelect, pkg.id],
  );

  return (
    <mesh
      position={[cx, cy, cz]}
      castShadow
      receiveShadow
      userData={{ packageId: pkg.id, stableKey: pkg.stableKey }}
      onClick={handleClick}
    >
      <boxGeometry args={[len, h, ROW_W]} />
      <meshStandardMaterial
        color={col}
        metalness={0.15}
        roughness={0.55}
        opacity={pkg.ov ? 0.85 : 1}
        transparent={Boolean(pkg.ov)}
        emissive={selected ? "#ffffff" : "#000000"}
        emissiveIntensity={selected ? 0.38 : 0}
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
        }}
        zIndexRange={[0, 0]}
      >
        <div>
          {cli ? <div>{cli}</div> : null}
          <div style={{ fontSize: 10, opacity: 0.95 }}>{line2}</div>
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
    [[shiftX, 0, 0], [shiftX + truckL, 0, 0]],
    [[shiftX, TRUCK_W, 0], [shiftX + truckL, TRUCK_W, 0]],
    [[shiftX, 0, h], [shiftX + truckL, 0, h]],
    [[shiftX, TRUCK_W, h], [shiftX + truckL, TRUCK_W, h]],
    [[shiftX, 0, 0], [shiftX, 0, h]],
    [[shiftX, TRUCK_W, 0], [shiftX, TRUCK_W, h]],
    [[shiftX + truckL, 0, 0], [shiftX + truckL, 0, h]],
    [[shiftX + truckL, TRUCK_W, 0], [shiftX + truckL, TRUCK_W, h]],
  ];
  return (
    <group>
      {edges.map(([a, b], i) => (
        <Line key={i} points={[a, b]} color={mat} lineWidth={1} opacity={0.4} transparent />
      ))}
    </group>
  );
}

function SceneContent({ placed, shiftX, truckL, maxLen, totalLen, selectedId, onSelectPackage }) {
  const cx = totalLen / 2;
  const targetY = MAX_H * 0.35;

  return (
    <>
      <color attach="background" args={["#0b1628"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 14, 6]} intensity={1.05} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-4, 6, -2]} intensity={0.35} />
      <TruckCabin shiftX={shiftX} />
      <TruckFloor shiftX={shiftX} truckL={truckL} maxLen={maxLen} totalLen={totalLen} />
      <HeightGuides shiftX={shiftX} truckL={truckL} />
      {placed.map((pkg) => (
        <CargoBox key={pkg.id} pkg={pkg} shiftX={shiftX} selected={selectedId === pkg.id} onSelect={onSelectPackage} />
      ))}
      <OrbitControls
        makeDefault
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
 * Vista WebGL: bultos con etiqueta cliente + pedido, cabina translúcida, detalle al clic.
 */
export default function LogisticaCargoScene3d({
  placed,
  shiftX,
  truckL,
  maxLen,
  totalLen,
  onSelectStableKey,
  onForceRow,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const cx = totalLen / 2;
  const cam = [cx + 4.2, MAX_H + 2.4, TRUCK_W + 5.2];

  const onSelectPackage = useCallback(
    (id) => {
      setSelectedId(id);
      const pkg = placed.find((p) => p.id === id);
      if (pkg?.stableKey && onSelectStableKey) onSelectStableKey(pkg.stableKey, pkg);
    },
    [placed, onSelectStableKey],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!placed.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [placed, selectedId]);

  const selectedPkg = selectedId ? placed.find((p) => p.id === selectedId) : null;
  const vol = selectedPkg ? (selectedPkg.len || 0) * ROW_W * (selectedPkg.h || 0) : 0;

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
        onPointerMissed={() => setSelectedId(null)}
      >
        <SceneContent
          placed={placed}
          shiftX={shiftX}
          truckL={truckL}
          maxLen={maxLen}
          totalLen={totalLen}
          selectedId={selectedId}
          onSelectPackage={onSelectPackage}
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
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{packageIdentityLabel(selectedPkg).replace(/\n/g, " · ")}</div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 11 }}>
              Cliente: <b>{selectedPkg.sCli || "—"}</b>
              {" · "}Pedido: <b>{selectedPkg.sPed || "—"}</b>
            </div>
            <div style={{ color: "rgba(255,255,255,.75)", fontSize: 11 }}>
              {selectedPkg.tipo || "—"} · {selectedPkg.n || 0} u. · Fila {selectedPkg.row === 0 ? "A" : "B"}
              {" · "}
              {selectedPkg.len?.toFixed(2)}m × {(ROW_W).toFixed(1)}m × {(selectedPkg.h * 100).toFixed(0)}cm
              {" · "}≈{vol.toFixed(2)} m³
              {selectedPkg.stackId != null ? ` · pila ${selectedPkg.stackId}` : ""}
              {selectedPkg.ov ? " · ⚠️ altura" : ""}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {typeof onForceRow === "function" ? (
                <>
                  <button
                    type="button"
                    onClick={() => onForceRow(selectedPkg.stableKey, 0)}
                    style={btnMini}
                  >
                    → Fila A
                  </button>
                  <button
                    type="button"
                    onClick={() => onForceRow(selectedPkg.stableKey, 1)}
                    style={btnMini}
                  >
                    → Fila B
                  </button>
                </>
              ) : null}
              <button type="button" onClick={() => setSelectedId(null)} style={btnMini}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <span style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>
            Clic en un bulto · etiqueta = cliente + nº pedido · cabina translúcida a la izquierda
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
          color: "rgba(255,255,255,.45)",
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        Arrastrar · rueda zoom · clic derecho pan · vacío deselecciona
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
  border: "1px solid rgba(255,255,255,.35)",
  background: "rgba(255,255,255,.12)",
  color: "#fff",
  cursor: "pointer",
};
