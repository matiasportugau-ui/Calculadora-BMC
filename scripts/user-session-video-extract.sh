#!/usr/bin/env bash
# Extract Whisper-friendly mono 16 kHz WAV + ~1 fps JPEG frames from a session video.
# Requires: ffmpeg on PATH.
#
# Usage:
#   ./scripts/user-session-video-extract.sh path/to/session.mp4
#   ./scripts/user-session-video-extract.sh path/to/session.mp4 path/to/output_dir
#   npm run session:video-extract -- path/to/session.mp4
#
set -euo pipefail

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

mkdir -p "$OUT/frames"

ffmpeg -y -hide_banner -loglevel error -i "$VIDEO" -vn -acodec pcm_s16le -ar 16000 -ac 1 "$OUT/audio.wav"
ffmpeg -y -hide_banner -loglevel error -i "$VIDEO" -vf fps=1 "$OUT/frames/frame_%04d.jpg"

echo "Extracted:"
echo "  $OUT/audio.wav"
echo "  $OUT/frames/"
