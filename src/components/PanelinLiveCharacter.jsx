/**
 * PanelinLiveCharacter — canvas renderer for the full-screen Panelin
 * character (/panelin/live). Composites the layered sprite parts (reused
 * from the standalone "Interactive Character" app's art — same owner).
 *
 * IMPORTANT sprite caveat, found during manual verification of this build:
 * the filenames do NOT map to isolated, independently-animatable parts.
 * `screen_bg.png` already contains the complete baked-in face (cap, body,
 * bezel, eyes, mouth together); `eye_L`/`eye_R`/`mouth` are unrelated
 * fragment shapes, not clean single-part sprites — scaling `mouth.png`
 * in place (an earlier version of this file did) actually distorted
 * eye-shaped content, since that's what's really drawn in that file. There
 * is no manifest describing true part boundaries (confirmed 404 on the
 * live app during the original review).
 *
 * Given that, this renderer draws all layers statically in a fixed
 * z-order (verified visually to composite correctly) and expresses
 * listening/speaking/emotion through geometry-independent effects — a
 * color-tinted glow and a listening ring — rather than faking lip-sync or
 * blink on sprite content whose true bounds aren't actually known. This is
 * a deliberate v1 simplification: precise part-level animation (real
 * blink, real viseme) needs correctly isolated art from the source app,
 * not a guess.
 */
import { useEffect, useRef, useState } from "react";

const ASSET_BASE = "/panelin-character";

// Bottom → top compositing order — verified visually to reproduce the
// original character correctly when drawn as flat, untransformed layers.
const PARTS_ORDER = [
  "body_base", "screen_bg", "eye_L", "eye_R", "mouth",
  "cap", "belt", "glove_L", "glove_R", "boot_L", "boot_R",
];

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

// Centroid of screen_bg's non-transparent pixels — used purely as the
// reference point for the emotion glow / listening ring (screen_bg is the
// one sprite we're confident represents "the face region", since it's
// the baked-in complete face).
function computeOpaqueCentroid(img) {
  const off = document.createElement("canvas");
  off.width = img.width;
  off.height = img.height;
  const ctx = off.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  let sumX = 0, sumY = 0, count = 0;
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
          PARTS_ORDER.map(async (name) => [name, await loadImage(`${ASSET_BASE}/${name}.png`)])
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
    const W = 880;
    const H = 1184;
    canvas.width = W;
    canvas.height = H;

    let raf;
    let smoothedViseme = 0;

    const draw = (t) => {
      const images = imagesRef.current;
      const emo = emotionRef.current;
      const listening = listeningRef.current;
      const face = faceCenterRef.current;

      const targetViseme = emo === "speaking" ? visemeRef.current : 0;
      smoothedViseme += (targetViseme - smoothedViseme) * 0.35;

      const bob = Math.sin(t / 900) * 4;

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(0, bob);

      for (const name of PARTS_ORDER) {
        const img = images[name];
        if (img) ctx.drawImage(img, 0, 0, W, H);
      }

      // Emotion-tinted glow over the face, pulsing faster/brighter with
      // speech loudness while speaking — a lighting-based "talking" cue
      // in place of literal mouth animation (see file header).
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

      if (listening) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(t / 250) * 0.15;
        ctx.strokeStyle = "#5eead4";
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.ellipse(face.x, face.y, W * 0.32, H * 0.22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
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
      style={{ width: "min(70vw, 480px)", height: "auto", aspectRatio: "880 / 1184", display: "block" }}
      aria-hidden="true"
    />
  );
}
