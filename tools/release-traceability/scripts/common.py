#!/usr/bin/env python3
import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

PKG_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = PKG_ROOT / "config" / "release_notes.config.json"


def run_git(args: List[str]) -> str:
    result = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def load_config() -> Dict:
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def parse_commit_subject(subject: str) -> Tuple[str, str, str]:
    m = re.match(
        r"^(?P<type>[a-zA-Z0-9_-]+)(\((?P<scope>[^)]+)\))?!?:\s*(?P<title>.+)$",
        subject,
    )
    if not m:
        return ("other", "", subject.strip())
    return (m.group("type").lower(), (m.group("scope") or "").strip(), m.group("title").strip())


def get_head_metadata() -> Dict:
    fmt = "%H%n%h%n%an%n%ae%n%ad%n%s%n%b"
    out = run_git(["log", "-1", f"--pretty=format:{fmt}", "HEAD"])
    lines = out.split("\n")
    while len(lines) < 7:
        lines.append("")
    full_hash, short_hash, author_name, author_email, authored_at, subject = lines[:6]
    body = "\n".join(lines[6:]).strip()
    branch = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    files = run_git(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]).splitlines()
    stats = run_git(["show", "--stat", "--oneline", "--format=", "HEAD"])
    commit_type, scope, title = parse_commit_subject(subject)
    dt = normalize_git_datetime(authored_at)
    return {
        "hash": full_hash,
        "short_hash": short_hash,
        "author_name": author_name,
        "author_email": author_email,
        "authored_at": dt.isoformat(),
        "date": dt.strftime("%Y-%m-%d"),
        "time": dt.strftime("%H:%M:%S"),
        "subject": subject,
        "body": body,
        "branch": branch,
        "files": files,
        "stats": stats,
        "type": commit_type,
        "scope": scope,
        "title": title,
    }


def normalize_git_datetime(raw: str) -> datetime:
    for fmt in ["%a %b %d %H:%M:%S %Y %z", "%a %b %e %H:%M:%S %Y %z"]:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            pass
    return datetime.now()


def summarize_files(files: List[str]) -> str:
    if not files:
        return "No se detectaron archivos modificados."
    if len(files) == 1:
        return f"Se modificó 1 archivo: {files[0]}."
    preview = ", ".join(files[:5])
    extra = "" if len(files) <= 5 else f" y {len(files) - 5} más"
    return f"Se modificaron {len(files)} archivos: {preview}{extra}."


def infer_risk(files: List[str], cfg: Dict) -> str:
    rules = cfg.get("risk_rules", {})
    high_ext = set(rules.get("high_extensions", []))
    elevated_ext = set(rules.get("elevated_extensions", []))
    med_threshold = int(rules.get("medium_threshold_files", 10))
    high_threshold = int(rules.get("high_threshold_files", 25))

    high_hit = any(Path(f).suffix in high_ext for f in files)
    elevated_hit = any(Path(f).suffix in elevated_ext for f in files)

    if high_hit or len(files) >= high_threshold:
        return "Rojo"
    if elevated_hit or len(files) >= med_threshold:
        return "Amarillo"
    return "Verde"


def infer_signals(meta: Dict, cfg: Dict) -> Dict:
    """Heurísticas para ayudar a QA/release (no sustituyen revisión humana)."""
    subject = (meta.get("subject") or "").lower()
    body = (meta.get("body") or "").lower()
    text = f"{subject}\n{body}"
    ctype = meta.get("type") or "other"
    files = meta.get("files") or []

    def norm(p: str) -> str:
        return p.replace("\\", "/").lower()

    paths = [norm(f) for f in files]

    tests_touched = any(
        "/tests/" in p
        or p.startswith("tests/")
        or "tests\\" in p
        or "validation.js" in p
        or ".test." in p
        or ".spec." in p
        or "/__tests__/" in p
        for p in paths
    )

    regression_kw = (
        "regression",
        "revert",
        "hotfix",
        "workaround",
        "race condition",
        "off-by-one",
        "null pointer",
        "undefined is",
    )
    kw_hit = any(k in text for k in regression_kw)

    possible_regression = bool(
        (ctype == "fix" and (tests_touched or kw_hit))
        or subject.startswith("revert")
        or (meta.get("scope") or "").lower() == "regression"
    )

    breaking_mentioned = bool(
        "breaking change" in text
        or "breaking:" in text
        or "!" in (meta.get("subject") or "").split(":", 1)[0]
    )

    src_touched = any(p.startswith("src/") or p.startswith("server/") for p in paths)

    rules = cfg.get("risk_rules", {})
    high_ext = set(rules.get("high_extensions", []))
    high_hit = any(Path(f).suffix in high_ext for f in files)

    impact = "low"
    if breaking_mentioned or high_hit:
        impact = "high"
    elif src_touched and ctype in ("feat", "refactor", "perf", "fix"):
        impact = "med"

    areas = sorted({p.split("/")[0] for p in paths if "/" in p})[:8]

    return {
        "possible_regression": possible_regression,
        "tests_touched": tests_touched,
        "breaking_mentioned": breaking_mentioned,
        "release_impact": impact,
        "src_touched": src_touched,
        "areas": areas,
    }


def deep_description(meta: Dict) -> str:
    base = f"Este cambio registra el commit `{meta['subject']}` dentro del sistema de trazabilidad del proyecto."
    file_line = summarize_files(meta["files"])
    body = meta["body"].strip()
    if body:
        return f"{base} {file_line}\n\nContexto del commit:\n{body}"
    return f"{base} {file_line}"


def load_index(path: Path) -> Dict:
    if not path.exists():
        return {"EXPORT_SEAL": True, "commits": []}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_index(path: Path, data: Dict) -> None:
    ensure_parent(path)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
