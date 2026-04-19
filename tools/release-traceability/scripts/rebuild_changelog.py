#!/usr/bin/env python3
import argparse
from collections import defaultdict
from pathlib import Path

from common import REPO_ROOT, ensure_parent, load_config, load_index


def render_unreleased(commits, types_map):
    grouped = defaultdict(list)
    for c in commits:
        grouped[c.get("type", "other")].append(c)

    lines = [
        "# AUTOTRACE — Unreleased",
        "",
        "Vista incremental desde el índice de commits documentados (no reemplaza `docs/CHANGELOG.md` manual).",
        "",
    ]
    ordered_types = list(types_map.keys()) + sorted(set(grouped.keys()) - set(types_map.keys()))
    for t in ordered_types:
        items = grouped.get(t, [])
        if not items:
            continue
        section = types_map.get(t, t.title())
        lines.extend([f"## {section}", ""])
        for c in items[-80:]:
            scope = f"({c['scope']})" if c.get("scope") else ""
            sig = c.get("signals") or {}
            badges = []
            if sig.get("possible_regression"):
                badges.append("regresión?")
            if sig.get("tests_touched"):
                badges.append("tests")
            if sig.get("breaking_mentioned"):
                badges.append("breaking")
            badge = f" `[{' · '.join(badges)}]`" if badges else ""
            lines.append(f"- `{c['short_hash']}` {t}{scope}: {c['title']}{badge}")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def render_changelog(commits):
    lines = [
        "# AUTOTRACE — Changelog compacto",
        "",
        "Últimos commits registrados en `docs/dev-trace/commits/index.json`.",
        "",
    ]
    for c in commits[-220:]:
        lines.append(f"- {c['date']} {c['time']} — `{c['short_hash']}` — {c['subject']}")
    lines.append("")
    return "\n".join(lines)


def render_development_status(commits):
    total = len(commits)
    by_type = defaultdict(int)
    by_risk = defaultdict(int)
    by_impact = defaultdict(int)
    regression_hits = []

    for c in commits:
        by_type[c.get("type", "other")] += 1
        by_risk[c.get("risk", "N/A")] += 1
        sig = c.get("signals") or {}
        by_impact[sig.get("release_impact", "n/a")] += 1
        if sig.get("possible_regression"):
            regression_hits.append(c)

    lines = [
        "# AUTOTRACE — Development status",
        "",
        f"- Total commits documentados: **{total}**",
        "- Distribución por tipo:",
    ]
    for k, v in sorted(by_type.items()):
        lines.append(f"  - {k}: {v}")
    lines.append("- Distribución por riesgo (tamaño/extensiones):")
    for k, v in sorted(by_risk.items()):
        lines.append(f"  - {k}: {v}")
    lines.append("- Impacto release sugerido (heurística):")
    for k, v in sorted(by_impact.items()):
        lines.append(f"  - {k}: {v}")
    lines.extend(
        [
            "",
            "## Atención QA — posible regresión (heurística)",
            "",
        ]
    )
    if not regression_hits:
        lines.append("_Ningún commit reciente marcado._")
    else:
        tail = regression_hits[-25:]
        for c in reversed(tail):
            lines.append(
                f"- `{c['short_hash']}` {c['date']} — {c['subject']} — impacto: {(c.get('signals') or {}).get('release_impact', 'n/a')}"
            )
    lines.extend(
        [
            "",
            "---",
            "",
            "_Las señales `possible_regression`, `tests_touched` y `release_impact` son heurísticas locales; validar en CI y smoke antes de release._",
            "",
        ]
    )
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Rebuild AUTOTRACE markdown from index")
    parser.parse_args()

    cfg = load_config()
    paths = cfg["paths"]
    index_data = load_index(REPO_ROOT / paths["index_file"])
    commits = index_data.get("commits", [])
    types_map = cfg.get("types_map", {})

    unreleased = REPO_ROOT / paths["unreleased_file"]
    changelog = REPO_ROOT / paths["changelog_file"]
    status = REPO_ROOT / paths["development_status_file"]

    for p in [unreleased, changelog, status]:
        ensure_parent(p)

    unreleased.write_text(render_unreleased(commits, types_map), encoding="utf-8")
    changelog.write_text(render_changelog(commits), encoding="utf-8")
    status.write_text(render_development_status(commits), encoding="utf-8")
    print("[OK] AUTOTRACE markdown rebuilt")


if __name__ == "__main__":
    main()
