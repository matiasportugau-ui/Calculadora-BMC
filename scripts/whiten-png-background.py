#!/usr/bin/env python3
"""
Flood-fill background from image edges: studio gray gradients + soft shadow → #FFFFFF.
Stops at product edges where RGB jumps exceed --step-tol (terracotta / foam stay).

Usage:
  python3 scripts/whiten-png-background.py --in public/images/foo.png --out public/images/foo.png
"""
from __future__ import annotations

import argparse
from collections import deque

from PIL import Image


def neighbors8(x: int, y: int, w: int, h: int):
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                yield nx, ny


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", dest="out", required=True)
    ap.add_argument("--step-tol", type=int, default=16, help="Max RGB step between adjacent bg pixels")
    ap.add_argument(
        "--chroma-max",
        type=int,
        default=30,
        help="Max (maxRGB-minRGB) for a pixel to count as neutral background (blocks product / terracotta)",
    )
    args = ap.parse_args()

    def chroma(rgb_tuple: tuple[int, int, int]) -> int:
        r, g, b = rgb_tuple
        return max(r, g, b) - min(r, g, b)

    img = Image.open(args.inp).convert("RGBA")
    w, h = img.size
    rgb = img.convert("RGB")
    px = rgb.load()
    out = img.copy()
    opx = out.load()

    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if not visited[y][x]:
            visited[y][x] = True
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        r0, g0, b0 = px[x, y]
        for nx, ny in neighbors8(x, y, w, h):
            if visited[ny][nx]:
                continue
            r1, g1, b1 = px[nx, ny]
            n1 = (r1, g1, b1)
            if chroma(n1) > args.chroma_max:
                continue
            if max(abs(r1 - r0), abs(g1 - g0), abs(b1 - b0)) > args.step_tol:
                continue
            visited[ny][nx] = True
            q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                a = opx[x, y][3]
                opx[x, y] = (255, 255, 255, a)

    out.save(args.out, optimize=True)
    bg_px = sum(visited[y][x] for y in range(h) for x in range(w))
    print(
        f"whiten-png-background: {args.inp} -> {args.out} "
        f"(bg_pixels={bg_px}, step_tol={args.step_tol}, chroma_max={args.chroma_max})"
    )


if __name__ == "__main__":
    main()
