#!/usr/bin/env python3
"""
README Agent – keeps documentation synchronized with the codebase.
Runs daily via GitHub Actions. Uses Google Gemini.
"""

import os
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone

from google import genai

REPO_ROOT = Path(__file__).resolve().parent.parent
README_PATH = REPO_ROOT / "README.md"

# Prefer current free-tier IDs; fall back if Google retires one.
MODEL_CANDIDATES = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
]

_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not _api_key:
    raise SystemExit("Set GEMINI_API_KEY (or GOOGLE_API_KEY) before running.")
client = genai.Client(api_key=_api_key)


def run(cmd: str) -> str:
    return subprocess.check_output(cmd, shell=True, text=True, cwd=REPO_ROOT).strip()


def scan_repo() -> dict:
    structure = run(
        "find . -type f -not -path './.git/*' -not -path './node_modules/*' | head -100"
    )
    recent_commits = run("git log -10 --oneline")
    key_files = []
    for p in [
        "package.json",
        "src/data/calculatorDataVersion.js",
        "AGENTS.md",
        "docs/team/PROJECT-STATE.md",
    ]:
        path = REPO_ROOT / p
        if path.exists() and path.is_file():
            key_files.append({"path": p, "content": path.read_text()[:4000]})
    current_readme = README_PATH.read_text() if README_PATH.exists() else ""
    return {
        "structure": structure,
        "recent_commits": recent_commits,
        "key_files": key_files,
        "current_readme": current_readme[:6000],
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }


def call_llm(role: str, system: str, user: str) -> str:
    prompt = f"{system}\n\n---\n\n{user}"
    last_err = None
    for model in MODEL_CANDIDATES:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config={"temperature": 0.2},
            )
            text = (resp.text or "").strip()
            if text:
                print(f"  model={model} ({role})")
                return text
        except Exception as e:
            last_err = e
            print(f"  skip {model}: {e}")
            continue
    raise RuntimeError(f"All Gemini models failed. Last error: {last_err}")


def write_docs(scan: dict) -> dict:
    system = """You are an expert technical writer for production web apps.
Update README.md to stay synchronized with the current codebase.
Focus on: Overview, Architecture, How to Run, Features, Deploy.
Keep it concise and accurate. Use markdown. Do not invent features.
Return ONLY the full new README.md content."""
    user = f"""Current date: {scan['date']}

Repo structure:
{scan['structure']}

Recent commits:
{scan['recent_commits']}

Key files:
{json.dumps(scan['key_files'], indent=2)[:8000]}

Current README:
{scan['current_readme']}

Produce the complete updated README.md now."""
    return {"readme": call_llm("writer", system, user)}


def critique(scan: dict, proposed: dict) -> bool:
    system = "You are a strict documentation quality gate. Reply with only YES or NO."
    user = f"""Does this proposed README improve accuracy based on the scan?
Scan commits: {scan['recent_commits'][:500]}
Proposed length: {len(proposed['readme'])}
Reply YES only if the change is meaningful and correct. Otherwise NO."""
    decision = call_llm("critic", system, user).strip().upper()
    return decision.startswith("YES")


def main():
    print("Scanning repo...")
    scan = scan_repo()
    print("Generating updated docs...")
    proposed = write_docs(scan)
    print("Critic review...")
    if critique(scan, proposed):
        README_PATH.write_text(proposed["readme"])
        print("Documentation updated")
    else:
        print("No meaningful changes – skipping")


if __name__ == "__main__":
    main()
