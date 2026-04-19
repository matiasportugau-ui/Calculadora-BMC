#!/usr/bin/env python3
import argparse
import subprocess
from collections import defaultdict
from pathlib import Path

from common import REPO_ROOT, load_config, load_index
from render_release_html import write_release_html


def run_git(args):
    res = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip() or f"git {' '.join(args)} failed")
    return res.stdout.strip()


def commits_since(ref):
    if not ref:
        return None
    hashes = run_git(["log", f"{ref}..HEAD", "--pretty=format:%H"]).splitlines()
    return set(hashes)


def latest_tag():
    try:
        return run_git(["describe", "--tags", "--abbrev=0"])
    except Exception:
        return ""


def render_release_notes_md(version, commits, previous_ref):
    grouped = defaultdict(list)
    for c in commits:
        grouped[c.get("type", "other")].append(c)

    lines = [
        f"# AUTOTRACE — Release notes — {version}",
        "",
        f"Comparación: **{previous_ref or 'inicio del historial'}** → `HEAD` (índice documentado).",
        "",
        "## Resumen",
        "",
        f"- Commits incluidos: **{len(commits)}**",
        f"- Posible regresión (heurística): **{sum(1 for c in commits if (c.get('signals') or {}).get('possible_regression'))}**",
        f"- Con tests / validación: **{sum(1 for c in commits if (c.get('signals') or {}).get('tests_touched'))}**",
        "",
    ]

    for t in ["feat", "fix", "refactor", "perf", "docs", "chore", "ci", "build", "test", "other"]:
        items = grouped.get(t, [])
        if not items:
            continue
        lines.extend([f"## {t.title()}", ""])
        for c in items:
            scope = f"({c['scope']})" if c.get("scope") else ""
            sig = c.get("signals") or {}
            flags = []
            if sig.get("possible_regression"):
                flags.append("regresión?")
            if sig.get("tests_touched"):
                flags.append("tests")
            if sig.get("breaking_mentioned"):
                flags.append("breaking")
            extra = f" — _{', '.join(flags)}_" if flags else ""
            lines.append(f"- `{c['short_hash']}` **{t}**{scope}: {c['title']}{extra}")
        lines.append("")
    lines.extend(
        [
            "---",
            "",
            "Abrir también `docs/dev-trace/AUTOTRACE-RELEASE.html` para la vista visual.",
            "",
        ]
    )
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate AUTOTRACE release notes (MD + HTML)")
    parser.add_argument("--version", required=False, help="Version label, e.g. v3.2.0")
    parser.add_argument("--from-ref", required=False, help="Git ref/tag to compare from")
    args = parser.parse_args()

    cfg = load_config()
    paths = cfg["paths"]
    data = load_index(REPO_ROOT / paths["index_file"])
    all_commits = data.get("commits", [])

    version = args.version or "unversioned"
    from_ref = args.from_ref or latest_tag()
    allowed_hashes = commits_since(from_ref)
    selected = [c for c in all_commits if allowed_hashes is None or c["hash"] in allowed_hashes]

    out_md = REPO_ROOT / paths["release_notes_file"]
    out_md.write_text(render_release_notes_md(version, selected, from_ref), encoding="utf-8")

    project = cfg.get("project_name", "Project")
    html_path = write_release_html(REPO_ROOT, paths, project, version, from_ref, selected)
    print(f"[OK] release notes MD: {out_md.relative_to(REPO_ROOT)}")
    print(f"[OK] release notes HTML: {html_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
