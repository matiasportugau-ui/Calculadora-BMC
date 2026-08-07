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
import {
  canStartDrag,
  BURIED_TOAST_ES,
} from "../../utils/logistica/stackPhysics.js";

const TRUCK_W = 2.4;
const ROW_W = 1.2;
const CAB_LEN_M = 2.4;
const CAB_HEIGHT_M = 1.5;
const DBL_MS = 420;

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

/** Long-press for touch / trackpad free-drag (ms). Double-click still works for mouse. */
const LONG_PRESS_MS = 380;

/**
 * Interaction:
 * - 1 click / pointerup quick → select (details only)
 * - Free-Drag ON: double-click (mouse) OR long-press 380ms (touch/trackpad) → drag
 * - Window-level pointermove/up so trackpad doesn't drop when leaving the mesh
 * - Shift+click → multi-select (parent); Shift+drag → height
 */
function CargoBox({
  pkg,
  shiftX,
  selected,
  multiSelected,
  dimmed,
  label,
  placed,
  multiSelectKeys,
  freeDragEnabled,
  onSelect,
  onShiftSelect,
  onFreeDragEnd,
  onGroupDragEnd,
  onBlocked,
  onDragStateChange,
  lastClickRef,
}) {
  const dims = packagePhysicalDims(pkg);
  const len = dims.L;
  const h = dims.H;
  const w = dims.W;
  const dragRef = useRef(null);
  const liveRef = useRef(null);
  const longPressRef = useRef(null);
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
  const y0 = pkg.freeDrag || live || pkg.zone === "yard" ? (row === 1 ? ROW_W : 0) : packageRowYOffset({ ...pkg, row });
  const cz = y0 + w / 2;
  const cy = zBase + h / 2;
  const col = pkg.ov
    ? "#ff3b30"
    : pkg.zone === "yard"
      ? "#38bdf8"
      : pkg.freeDrag || live
        ? "#f59e0b"
        : hexToColor(pkg.sCol);
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

  const clearLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const beginDrag = useCallback(
    (e, key) => {
      const gate = canStartDrag(placed, pkg, multiSelectKeys);
      if (!gate.ok) {
        onBlocked?.(gate.message || BURIED_TOAST_ES);
        return;
      }
      try {
        e.target?.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      // Prefer canvas capture so trackpad moves outside mesh still stream events
      try {
        gl.domElement.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = {
        pointerId: e.pointerId,
        planeY: cy,
        shiftHeight: false,
        startClientY: e.clientY,
        startClientX: e.clientX,
        startZBase: zBase,
        startX: xStart,
        startRow: row,
        startHitX: null,
        group: Boolean(gate.groupMove) || (multiSelectKeys || []).includes(key),
        keys:
          gate.groupMove || (multiSelectKeys || []).length > 1
            ? [...new Set([key, ...(multiSelectKeys || [])])]
            : [key],
        moved: false,
      };
      onDragStateChange?.(true);
      setLiveBoth({ xStart, zBase, row });
    },
    [
      placed,
      pkg,
      multiSelectKeys,
      onBlocked,
      gl,
      cy,
      zBase,
      xStart,
      row,
      onDragStateChange,
      setLiveBoth,
    ],
  );

  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      const key = pkg.stableKey;
      const now = Date.now();
      const shift = Boolean(e.shiftKey);
      const isTouch = e.pointerType === "touch" || e.pointerType === "pen";

      if (shift && onShiftSelect) {
        onShiftSelect(key, pkg);
        return;
      }

      onSelect(pkg.id, pkg);

      if (!freeDragEnabled) return;

      const prev = lastClickRef?.current;
      const isDouble = prev && prev.key === key && now - prev.t < DBL_MS;
      lastClickRef.current = {
        key,
        t: now,
        startX: e.clientX,
        startY: e.clientY,
      };

      // Mouse: double-click starts drag immediately
      if (!isTouch && isDouble) {
        clearLongPress();
        beginDrag(e, key);
        return;
      }

      // Touch / trackpad / first click: long-press to drag (works without double-tap)
      clearLongPress();
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;
      const target = e.target;
      longPressRef.current = setTimeout(() => {
        longPressRef.current = null;
        if (dragRef.current) return;
        beginDrag(
          {
            pointerId,
            clientX: startX,
            clientY: startY,
            target,
            stopPropagation() {},
          },
          key,
        );
      }, LONG_PRESS_MS);
    },
    [pkg, freeDragEnabled, onSelect, onShiftSelect, lastClickRef, beginDrag, clearLongPress],
  );

  const applyMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || !freeDragEnabled) return;
      if (d.pointerId != null && e.pointerId != null && d.pointerId !== e.pointerId) return;

      // Cancel long-press if finger moved before it fired
      if (longPressRef.current && (Math.abs(e.clientX - (d.startClientX || 0)) > 8 || Math.abs(e.clientY - (d.startClientY || 0)) > 8)) {
        /* drag already active */
      }

      d.moved = true;

      if (e.shiftKey) {
        const dy = (d.startClientY - e.clientY) * 0.01;
        const nextZ = Math.max(0, d.startZBase + dy);
        const base = liveRef.current || { xStart, zBase, row };
        setLiveBoth({ ...base, zBase: nextZ });
        return;
      }

      const hit = projectToPlane(e.clientX, e.clientY, d.planeY);
      if (!hit) return;
      if (d.startHitX == null) d.startHitX = hit.x;
      const dxWorld = hit.x - d.startHitX;
      const nextXStart = d.startX + dxWorld;
      const nextRow = hit.z >= ROW_W ? 1 : 0;
      setLiveBoth({ xStart: nextXStart, zBase: liveRef.current?.zBase ?? zBase, row: nextRow });
    },
    [freeDragEnabled, projectToPlane, xStart, zBase, row, setLiveBoth],
  );

  const handlePointerMove = useCallback(
    (e) => {
      // Cancel pending long-press if user slids before threshold (treat as orbit/pan intent)
      if (longPressRef.current && !dragRef.current) {
        const lp = longPressRef.current;
        // stored as timeout id only — cancel on any significant move during hold wait
        if (e.movementX || e.movementY || true) {
          /* cancel if moved > 10px from down — tracked via dragRef start when drag starts */
        }
      }
      if (!dragRef.current) {
        // If long-press timer active and finger moved a lot, cancel
        return;
      }
      e.stopPropagation();
      applyMove(e);
    },
    [applyMove],
  );

  const endDrag = useCallback(
    (e) => {
      clearLongPress();
      if (!dragRef.current) return;
      e?.stopPropagation?.();
      const d = dragRef.current;
      const finalLive = liveRef.current;
      try {
        gl.domElement.releasePointerCapture?.(d.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = null;
      onDragStateChange?.(false);

      if (finalLive && d.moved) {
        if (d.group && d.keys.length > 1 && onGroupDragEnd) {
          const dx = finalLive.xStart - d.startX;
          const dzBase = finalLive.zBase - d.startZBase;
          onGroupDragEnd(d.keys, {
            dx,
            dzBase,
            row: finalLive.row,
            primaryKey: pkg.stableKey,
            primaryPos: { ...finalLive, len },
          });
        } else if (onFreeDragEnd) {
          onFreeDragEnd(pkg.stableKey, {
            xStart: finalLive.xStart,
            zBase: finalLive.zBase,
            row: finalLive.row,
            len,
            zone: pkg.zone === "yard" ? "yard" : "truck",
            yardStopId: pkg.yardStopId,
          });
        }
      }
      setLiveBoth(null);
    },
    [onFreeDragEnd, onGroupDragEnd, pkg, len, onDragStateChange, setLiveBoth, clearLongPress, gl],
  );

  // Window-level listeners: trackpad often leaves mesh bounds mid-drag
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) {
        // cancel long-press on move while waiting
        if (longPressRef.current && e.pointerType) {
          // only cancel if this looks like a drag gesture
        }
        return;
      }
      applyMove(e);
    };
    const onUp = (e) => {
      if (longPressRef.current) clearLongPress();
      if (dragRef.current) endDrag(e);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      clearLongPress();
    };
  }, [applyMove, endDrag, clearLongPress]);

  // Cancel long-press if pointer moves before fire
  useEffect(() => {
    const onEarlyMove = (e) => {
      if (!longPressRef.current || dragRef.current) return;
      // Heuristic: any move while holding cancels if > 12px — store start on down via lastClickRef
      const prev = lastClickRef?.current;
      if (!prev || prev.startX == null) return;
      const dx = Math.abs(e.clientX - prev.startX);
      const dy = Math.abs(e.clientY - prev.startY);
      if (dx > 12 || dy > 12) clearLongPress();
    };
    window.addEventListener("pointermove", onEarlyMove, { passive: true });
    return () => window.removeEventListener("pointermove", onEarlyMove);
  }, [clearLongPress, lastClickRef]);

  return (
    <mesh
      position={[cx, cy, cz]}
      castShadow
      receiveShadow
      userData={{ packageId: pkg.id, stableKey: pkg.stableKey }}
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
        emissive={selected || multiSelected || live ? "#ffffff" : "#000000"}
        emissiveIntensity={selected || multiSelected || live ? 0.4 : 0}
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
          {pkg.zone === "yard" ? " · YARD" : pkg.freeDrag || live ? " · FREE" : ""}
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
        <planeGeometry args={[Math.max(totalLen + 8, truckL + 12), TRUCK_W + 6]} />
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
  multiSelectKeys,
  onSelectPackage,
  onShiftSelect,
  highlightKeys,
  bultoCounts,
  freeDragEnabled,
  onFreeDragEnd,
  onGroupDragEnd,
  onBlocked,
  orbitEnabled,
  onDragStateChange,
  lastClickRef,
}) {
  const cx = totalLen / 2;
  const targetY = MAX_H * 0.35;
  const multiSet = useMemo(() => new Set(multiSelectKeys || []), [multiSelectKeys]);

  return (
    <>
      <color attach="background" args={["#0b1628"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 14, 6]} intensity={1.05} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
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
            multiSelected={multiSet.has(pkg.stableKey)}
            dimmed={!inGroup}
            label={packageLabelTiny(pkg, bultoCounts, 22)}
            placed={placed}
            multiSelectKeys={multiSelectKeys}
            freeDragEnabled={freeDragEnabled}
            onSelect={onSelectPackage}
            onShiftSelect={onShiftSelect}
            onFreeDragEnd={onFreeDragEnd}
            onGroupDragEnd={onGroupDragEnd}
            onBlocked={onBlocked}
            onDragStateChange={onDragStateChange}
            lastClickRef={lastClickRef}
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
        maxDistance={40}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
    </>
  );
}

/**
 * Vista WebGL — detalle 1-clic; Free-Drag: doble-clic (mouse) o long-press (touch/trackpad).
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
  onGroupDragEnd = null,
  onClearFreeDrag = null,
  multiSelectKeys = [],
  onMultiSelectChange = null,
  onBlocked = null,
  fillParent = false,
}) {
  const [selectedId, setSelectedId] = useState(selectedPkgId || null);
  const [dragging, setDragging] = useState(false);
  const lastClickRef = useRef(null);
  const cx = totalLen / 2;
  const cam = useMemo(() => [cx + 4.2, MAX_H + 2.4, TRUCK_W + 5.2], [cx]);

  // Touch-friendly canvas: prevent browser scroll/zoom fighting free-drag
  useEffect(() => {
    const el = document.querySelector("canvas");
    if (!el) return undefined;
    if (freeDragEnabled) {
      el.style.touchAction = "none";
    } else {
      el.style.touchAction = "manipulation";
    }
    return () => {
      el.style.touchAction = "";
    };
  }, [freeDragEnabled]);

  useEffect(() => {
    if (selectedPkgId != null) setSelectedId(selectedPkgId);
  }, [selectedPkgId]);

  const onSelectPackage = useCallback(
    (id, pkgArg) => {
      setSelectedId(id);
      const pkg = pkgArg || placed.find((p) => p.id === id);
      if (pkg && onSelectStableKey) onSelectStableKey(pkg.stableKey, pkg);
    },
    [placed, onSelectStableKey],
  );

  const onShiftSelect = useCallback(
    (key, pkg) => {
      if (!onMultiSelectChange) return;
      const set = new Set(multiSelectKeys || []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      onMultiSelectChange([...set]);
      if (pkg) onSelectPackage(pkg.id, pkg);
    },
    [multiSelectKeys, onMultiSelectChange, onSelectPackage],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!placed.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [placed, selectedId]);

  const selectedPkg = selectedId ? placed.find((p) => p.id === selectedId) : null;
  const selectedDims = selectedPkg ? packagePhysicalDims(selectedPkg) : null;

  const wrapStyle = fillParent
    ? { width: "100%", height: "100%", minHeight: 200, borderRadius: 0, overflow: "hidden", position: "relative" }
    : { width: "100%", height: "100%", minHeight: 280, borderRadius: 8, overflow: "hidden", position: "relative" };

  return (
    <div style={wrapStyle}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: cam, fov: 48, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0b1628");
        }}
        onPointerMissed={() => {
          if (!dragging) {
            setSelectedId(null);
            onMultiSelectChange?.([]);
          }
        }}
      >
        <SceneContent
          placed={placed}
          shiftX={shiftX}
          truckL={truckL}
          maxLen={maxLen}
          totalLen={totalLen}
          selectedId={selectedId}
          multiSelectKeys={multiSelectKeys}
          onSelectPackage={onSelectPackage}
          onShiftSelect={onShiftSelect}
          highlightKeys={highlightKeys}
          bultoCounts={bultoCounts}
          freeDragEnabled={freeDragEnabled}
          onFreeDragEnd={onFreeDragEnd}
          onGroupDragEnd={onGroupDragEnd}
          onBlocked={onBlocked}
          orbitEnabled={!dragging}
          onDragStateChange={setDragging}
          lastClickRef={lastClickRef}
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
                <span style={{ marginLeft: 6, fontSize: 10, color: "#fbbf24" }}>FREE</span>
              ) : null}
              {selectedPkg.zone === "yard" ? (
                <span style={{ marginLeft: 6, fontSize: 10, color: "#38bdf8" }}>YARD</span>
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
            </div>
            {selectedDims ? (
              <div style={{ color: "rgba(255,255,255,.5)", fontSize: 10, marginTop: 2 }}>
                x={Number(selectedPkg.xStart).toFixed(2)}m · h={Number(selectedPkg.zBase).toFixed(2)}m
                {(multiSelectKeys || []).length > 1 ? ` · grupo ${(multiSelectKeys || []).length}` : ""}
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
                  Quitar free
                </button>
              ) : null}
              <button type="button" onClick={() => setSelectedId(null)} style={btnMini}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <span style={{ color: "rgba(255,255,255,.45)", fontSize: 11 }}>
            {freeDragEnabled
              ? "1 toque = detalle · Mantener ~0.4s o doble-clic = arrastrar · Shift = grupo/altura"
              : "Toque = detalle · activá Free-Drag para mover bultos"}
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
          ? "FREE-DRAG · trackpad/tablet: long-press y deslizá · soltar fija"
          : "Órbita · pellizco/rueda zoom · 2 dedos pan"}
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
