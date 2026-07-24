#!/usr/bin/env python3
"""Deterministic safety gates for README Agent writes.

Kept free of Gemini / network imports so CI can unit-test without secrets.
"""

from __future__ import annotations

import re
from typing import Iterable

# Anchors that must survive any automated rewrite. Losing these is treated as
# data loss / broken operator docs (template sync, quickstart, legal).
REQUIRED_README_ANCHORS: tuple[str, ...] = (
    "# Calculadora BMC",
    "<!-- AUTO-GENERATED-BLOCK: scripts/generate-readme-presentation.mjs -->",
    "npm run dev:full",
    "docs/readme/README.template.md",
    "## Licencia",
)

# Reject updates that shrink the curated README too aggressively.
MIN_LENGTH_RATIO = 0.85

_FENCE_RE = re.compile(
    r"^\s*```(?:markdown|md)?\s*\n(?P<body>.*?)\n```\s*$",
    re.IGNORECASE | re.DOTALL,
)


def normalize_readme(text: str) -> str:
    """Strip accidental markdown fences and normalize trailing newline."""
    raw = (text or "").replace("\r\n", "\n").strip()
    m = _FENCE_RE.match(raw)
    if m:
        raw = m.group("body").strip()
    if raw and not raw.endswith("\n"):
        raw += "\n"
    return raw


def missing_anchors(text: str, anchors: Iterable[str] = REQUIRED_README_ANCHORS) -> list[str]:
    return [a for a in anchors if a not in (text or "")]


def validate_readme_update(current: str, proposed: str) -> tuple[bool, str]:
    """Return (ok, reason). ok=False means the write must be skipped."""
    current_n = normalize_readme(current)
    proposed_n = normalize_readme(proposed)

    if not proposed_n.strip():
        return False, "proposed README is empty"

    if current_n.strip():
        min_len = max(1, int(len(current_n) * MIN_LENGTH_RATIO))
        if len(proposed_n) < min_len:
            return (
                False,
                f"proposed README too short ({len(proposed_n)} < {min_len} chars; "
                f"ratio floor {MIN_LENGTH_RATIO:.0%})",
            )

    missing = missing_anchors(proposed_n)
    if missing:
        preview = ", ".join(repr(a[:48]) for a in missing[:4])
        more = f" (+{len(missing) - 4} more)" if len(missing) > 4 else ""
        return False, f"proposed README missing required anchors: {preview}{more}"

    if proposed_n == current_n:
        return False, "proposed README identical to current"

    return True, "ok"


if __name__ == "__main__":
    # Lightweight self-check when run directly.
    sample = (
        "# Calculadora BMC\n"
        "<!-- AUTO-GENERATED-BLOCK: scripts/generate-readme-presentation.mjs -->\n"
        "npm run dev:full\n"
        "docs/readme/README.template.md\n"
        "## Licencia\n"
    )
    ok, reason = validate_readme_update(sample, sample + "\nextra\n")
    assert ok, reason
    ok, reason = validate_readme_update(sample * 20, "# short\n")
    assert not ok, "expected short reject"
    print("doc_agent_safety self-check OK")
