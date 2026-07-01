/**
 * PanelinLiveCharacter — canvas renderer for the full-screen Panelin
 * character (/panelin/live). Composites layered sprite parts with
 * geometry-safe motion (no lip-sync on mislabeled mouth sprites).
 */
import { useEffect, useRef, useState } from "react";

const ASSET_BASE = "/panelin-character";
const W = 880;
const H = 1184;

const PARTS_ORDER = [
  "body_base", "screen_bg", "eye_L", "eye_R", "mouth",
  "cap", "belt", "glove_L", "glove_R", "boot_L", "boot_R",
];

const EYE_PARTS = new Set(["eye_L", "eye_R"]);
const OVERLAY_PARTS = new Set(["cap", "belt", "glove_L", "glove_R", "boot_L", "boot_R"]);

const EMOTION_GLOW = {
  neutral: "rgba(94,234,212,0.22)",
  listening: "rgba(94,234,212,0.45)",
  thinking: "rgba(167,139,250,0.40)",
  speaking: "rgba(248,180,40,0.35)",
  happy: "rgba(74,222,128,0.50)",
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function computeOpaqueCentroid(img) {
  const off = document.createElement("canvas");
  off.width = img.width;
  off.height = img.height;
  const ctx = off.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  const step = 4;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 32) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  if (!count) return { x: width / 2, y: height / 2 };
  return { x: sumX / count, y: sumY / count };
}

function nextBlinkAt(now, emotion) {
  const base = emotion === "speaking" || emotion === "listening" ? 4200 : 2800;
  return now + base + Math.random() * 2200;
}

function drawPart(ctx, img, name, blinkScale) {
  if (!img) return;
  if (EYE_PARTS.has(name) && blinkScale < 0.92) {
    const cx = name === "eye_L" ? W * 0.38 : W * 0.62;
    const cy = H * 0.36;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, blinkScale);
    ctx.translate(-cx, -cy);
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();
    return;
  }
  ctx.drawImage(img, 0, 0, W, H);
}

export default function PanelinLiveCharacter({ emotion = "neutral", visemeLevel = 0, isListening = false }) {
  const canvasRef = useRef(null);
  const imagesRef = useRef({});
  const faceCenterRef = useRef({ x: 440, y: 450 });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const emotionRef = useRef(emotion);
  const visemeRef = useRef(visemeLevel);
  const listeningRef = useRef(isListening);

  useEffect(() => {
    emotionRef.current = emotion;
    visemeRef.current = visemeLevel;
    listeningRef.current = isListening;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          PARTS_ORDER.map(async (name) => [name, await loadImage(`${ASSET_BASE}/${name}.png`)]),
        );
        if (cancelled) return;
        const images = {};
        for (const [name, img] of entries) images[name] = img;
        imagesRef.current = images;
        if (images.screen_bg) faceCenterRef.current = computeOpaqueCentroid(images.screen_bg);
        setReady(true);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;

    let raf;
    let smoothedViseme = 0;
    let entrance = 0;
    let blinkUntil = 0;
    let nextBlink = nextBlinkAt(performance.now(), "neutral");

    const draw = (t) => {
      const images = imagesRef.current;
      const emo = emotionRef.current;
      const listening = listeningRef.current;
      const face = faceCenterRef.current;

      entrance = Math.min(1, entrance + 0.04);

      if (t >= nextBlink && t >= blinkUntil) {
        blinkUntil = t + 130;
        nextBlink = nextBlinkAt(t, emo);
      }
      const blinkT = blinkUntil > t ? (blinkUntil - t) / 130 : 0;
      const blinkScale = blinkT > 0 ? 0.06 + blinkT * 0.94 : 1;

      const targetViseme = emo === "speaking" ? visemeRef.current : 0;
      smoothedViseme += (targetViseme - smoothedViseme) * 0.35;

      const breathe = Math.sin(t / 1100) * 0.012;
      const speakBob = emo === "speaking" ? Math.sin(t / 180) * (3 + smoothedViseme * 6) : 0;
      const happyHop = emo === "happy" ? Math.abs(Math.sin(t / 220)) * 10 : 0;
      const bob = Math.sin(t / 900) * 4 + speakBob + happyHop;
      const sway = Math.sin(t / 2400) * 0.018;
      const scale = 1 + breathe + (emo === "happy" ? 0.02 : 0) + smoothedViseme * 0.018;
      const entranceScale = 0.9 + entrance * 0.1;

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H * 0.92);
      ctx.rotate(sway);
      ctx.scale(scale * entranceScale, scale * entranceScale);
      ctx.translate(-W / 2, -H * 0.92);
      ctx.translate(0, bob);

      for (const name of PARTS_ORDER) {
        if (OVERLAY_PARTS.has(name)) continue;
        drawPart(ctx, images[name], name, blinkScale);
      }

      // Screen bezel glow — safe viseme cue without distorting mouth sprite.
      const screenPulse = emo === "speaking"
        ? 0.25 + smoothedViseme * 0.55
        : emo === "thinking"
          ? 0.2 + Math.sin(t / 400) * 0.15
          : emo === "listening"
            ? 0.18 + Math.sin(t / 320) * 0.12
            : 0.08 + Math.sin(t / 900) * 0.05;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const screenGrad = ctx.createRadialGradient(face.x, face.y, 20, face.x, face.y, W * 0.22);
      screenGrad.addColorStop(0, `rgba(120,255,230,${screenPulse})`);
      screenGrad.addColorStop(0.55, `rgba(60,180,200,${screenPulse * 0.35})`);
      screenGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = screenGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      for (const name of PARTS_ORDER) {
        if (!OVERLAY_PARTS.has(name)) continue;
        drawPart(ctx, images[name], name, blinkScale);
      }

      const speakPulse = smoothedViseme * 0.4;
      const pulse = 0.85 + Math.sin(t / 500) * 0.15 + speakPulse;
      const grad = ctx.createRadialGradient(face.x, face.y, 10, face.x, face.y, W * 0.28 * pulse);
      grad.addColorStop(0, EMOTION_GLOW[emo] || EMOTION_GLOW.neutral);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      if (emo === "thinking") {
        for (let i = 0; i < 3; i++) {
          const angle = t / 900 + (i * Math.PI * 2) / 3;
          const rx = face.x + Math.cos(angle) * W * 0.18;
          const ry = face.y + Math.sin(angle) * H * 0.1;
          ctx.save();
          ctx.globalAlpha = 0.5 + Math.sin(t / 300 + i) * 0.3;
          ctx.fillStyle = "#a78bfa";
          ctx.beginPath();
          ctx.arc(rx, ry, 5 + Math.sin(t / 200 + i) * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (emo === "happy") {
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + t / 600;
          const dist = W * 0.2 + Math.sin(t / 400 + i) * 20;
          const sx = face.x + Math.cos(angle) * dist;
          const sy = face.y - H * 0.08 + Math.sin(angle) * dist * 0.4;
          ctx.save();
          ctx.globalAlpha = 0.35 + Math.sin(t / 250 + i) * 0.25;
          ctx.fillStyle = "#4ade80";
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (listening || emo === "listening") {
        for (let ring = 0; ring < 2; ring++) {
          const phase = ((t / 1400) + ring * 0.5) % 1;
          const expand = 0.28 + phase * 0.08;
          ctx.save();
          ctx.globalAlpha = (1 - phase) * 0.45;
          ctx.strokeStyle = "#5eead4";
          ctx.lineWidth = 10 - ring * 3;
          ctx.beginPath();
          ctx.ellipse(face.x, face.y, W * expand, H * expand * 0.7, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  if (loadError) {
    return (
      <div style={{ color: "#f87171", fontSize: 14, textAlign: "center" }}>
        No se pudo cargar el personaje ({loadError})
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "min(70vw, 480px)",
        height: "auto",
        aspectRatio: "880 / 1184",
        display: "block",
        filter: ready ? "none" : "blur(6px)",
        opacity: ready ? 1 : 0.4,
        transition: "filter 0.4s ease, opacity 0.4s ease",
      }}
      aria-hidden="true"
    />
  );
}