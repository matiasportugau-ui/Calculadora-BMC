#!/usr/bin/env python3
import argparse
from pathlib import Path

from common import (
    REPO_ROOT,
    deep_description,
    ensure_parent,
    get_head_metadata,
    infer_risk,
    infer_signals,
    load_config,
    load_index,
    write_index,
)


def build_commit_markdown(meta, risk, signals):
    files_md = "\n".join(f"- {f}" for f in meta["files"]) or "- Sin archivos detectados"
    sig_lines = "\n".join(
        [
            f"- Posible regresión (heurística): **{'sí' if signals['possible_regression'] else 'no'}**",
            f"- Tests / validación tocados: **{'sí' if signals['tests_touched'] else 'no'}**",
            f"- Breaking mencionado: **{'sí' if signals['breaking_mentioned'] else 'no'}**",
            f"- Impacto release sugerido: **{signals['release_impact']}**",
            f"- Áreas (prefijos): {', '.join(signals['areas']) or '-'}",
        ]
    )
    return f"""# Commit {meta['short_hash']}

- Fecha: {meta['date']}
- Hora: {meta['time']}
- Autor: {meta['author_name']}
- Email: {meta['author_email']}
- Branch: {meta['branch']}
- Tipo: {meta['type']}
- Scope: {meta['scope'] or '-'}
- Commit: {meta['subject']}

## Resumen
{meta['title']}

## Descripción
{deep_description(meta)}

## Señales automáticas (QA / release)
{sig_lines}

## Archivos modificados
{files_md}

## Diff summary
```text
{meta['stats']}
```

## Riesgo de cambio (tamaño / extensiones)
{risk}
"""


def update_worklog(meta, paths):
    worklog_dir = REPO_ROOT / paths["worklog_root"] / meta["date"][:4] / meta["date"][5:7]
    worklog_file = worklog_dir / f"{meta['date']}.md"
    ensure_parent(worklog_file)
    if not worklog_file.exists():
        worklog_file.write_text(f"# Worklog — {meta['date']}\n\n", encoding="utf-8")
    block = f"""## {meta['time']} — {meta['short_hash']}
**{meta['subject']}**

{deep_description(meta)}

### Archivos
"""
    block += ("\n".join(f"- {f}" for f in meta["files"]) or "- Sin archivos detectados") + "\n\n"
    current = worklog_file.read_text(encoding="utf-8")
    if meta["short_hash"] not in current:
        worklog_file.write_text(current + block, encoding="utf-8")


def update_index(meta, risk, signals, paths):
    index_file = REPO_ROOT / paths["index_file"]
    data = load_index(index_file)
    commits = data.setdefault("commits", [])
    if any(c.get("hash") == meta["hash"] for c in commits):
        return
    commits.append(
        {
            "hash": meta["hash"],
            "short_hash": meta["short_hash"],
            "date": meta["date"],
            "time": meta["time"],
            "author": meta["author_name"],
            "email": meta["author_email"],
            "branch": meta["branch"],
            "type": meta["type"],
            "scope": meta["scope"],
            "title": meta["title"],
            "subject": meta["subject"],
            "files": meta["files"],
            "risk": risk,
            "signals": signals,
        }
    )
    commits.sort(key=lambda x: (x["date"], x["time"], x["short_hash"]))
    write_index(index_file, data)


def main():
    parser = argparse.ArgumentParser(description="Generate dev-trace documentation for current HEAD commit")
    parser.parse_args()

    cfg = load_config()
    paths = cfg["paths"]
    meta = get_head_metadata()
    risk = infer_risk(meta["files"], cfg)
    signals = infer_signals(meta, cfg)

    commit_path = (
        REPO_ROOT
        / paths["commits_root"]
        / meta["date"][:4]
        / meta["date"][5:7]
        / f"{meta['short_hash']}.md"
    )
    ensure_parent(commit_path)
    if not commit_path.exists():
        commit_path.write_text(build_commit_markdown(meta, risk, signals), encoding="utf-8")

    update_worklog(meta, paths)
    update_index(meta, risk, signals, paths)
    print(f"[OK] commit doc generated: {commit_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
