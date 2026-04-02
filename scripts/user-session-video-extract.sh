#!/usr/bin/env bash
# Extract Whisper-friendly mono 16 kHz WAV + JPEG frames for Video-User-interactive-dev.
# Default: one frame every 5 s, scaled down, JPEG quality tuned for small files but readable UI.
#
# Env (optional):
#   BMC_SESSION_VIDEO_FRAME_INTERVAL_SEC  — seconds between frames (default 5)
#   BMC_SESSION_VIDEO_FRAME_MAX_WIDTH     — max width px; 0 = no scale (default 640)
#   BMC_SESSION_VIDEO_JPEG_Q              — mjpeg q:v 2–31, higher = lower quality (default 14)
#
# Usage:
#   ./scripts/user-session-video-extract.sh path/to/session.mp4
#   ./scripts/user-session-video-extract.sh path/to/session.mp4 path/to/output_dir
#   npm run session:video-extract -- path/to/session.mp4
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$SCRIPT_DIR/user-session-video-deps.sh" ensure || exit 1

VIDEO="${1:?Usage: $0 <video.mp4> [output_dir]}"
if [[ ! -f "$VIDEO" ]]; then
  echo "error: file not found: $VIDEO" >&2
  exit 1
fi

if [[ -n "${2:-}" ]]; then
  OUT="$2"
else
  OUT="$(dirname "$VIDEO")/extracted-$(basename "$VIDEO" | sed 's/\.[^.]*$//')"
fi

INTERVAL="${BMC_SESSION_VIDEO_FRAME_INTERVAL_SEC:-5}"
MAX_W="${BMC_SESSION_VIDEO_FRAME_MAX_WIDTH:-640}"
JPEG_Q="${BMC_SESSION_VIDEO_JPEG_Q:-14}"

if ! [[ "$INTERVAL" =~ ^[1-9][0-9]*$ ]]; then
  echo "error: BMC_SESSION_VIDEO_FRAME_INTERVAL_SEC must be a positive integer (got: $INTERVAL)" >&2
  exit 1
fi
if ! [[ "$MAX_W" =~ ^[0-9]+$ ]]; then
  echo "error: BMC_SESSION_VIDEO_FRAME_MAX_WIDTH must be a non-negative integer" >&2
  exit 1
fi
if ! [[ "$JPEG_Q" =~ ^[0-9]+$ ]] || (( JPEG_Q < 2 || JPEG_Q > 31 )); then
  echo "error: BMC_SESSION_VIDEO_JPEG_Q must be 2–31" >&2
  exit 1
fi

mkdir -p "$OUT/frames"

# Audio: full track for transcription / model listening (16 kHz mono WAV)
ffmpeg -y -hide_banner -loglevel error -i "$VIDEO" -vn -acodec pcm_s16le -ar 16000 -ac 1 "$OUT/audio.wav"

# Video: sparse frames (default every INTERVAL s), optional downscale, compressed JPEG
if [[ "$MAX_W" == "0" ]]; then
  VF="fps=1/${INTERVAL}"
else
  VF="fps=1/${INTERVAL},scale=${MAX_W}:-1:flags=lanczos"
fi

ffmpeg -y -hide_banner -loglevel error -i "$VIDEO" -an -vf "$VF" -q:v "$JPEG_Q" "$OUT/frames/frame_%04d.jpg"

echo "Extracted:"
echo "  $OUT/audio.wav  (audio completo, 16 kHz mono — para transcript / adjuntar al modelo)"
echo "  $OUT/frames/     (1 captura cada ${INTERVAL}s, max_w=${MAX_W}px, jpeg q=${JPEG_Q})"
echo "  Ajustá: BMC_SESSION_VIDEO_FRAME_INTERVAL_SEC, BMC_SESSION_VIDEO_FRAME_MAX_WIDTH, BMC_SESSION_VIDEO_JPEG_Q" >&2
