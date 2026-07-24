#!/usr/bin/env python3
"""
README Agent – keeps documentation synchronized with the codebase.
Runs daily via GitHub Actions. Uses Google Gemini.

Writes are gated by:
  1) Gemini critic that receives current + proposed README text
  2) Deterministic safety checks in doc_agent_safety.py (length + anchors)
"""

import os
import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone

from google import genai

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from doc_agent_safety import normalize_readme, validate_readme_update

REPO_ROOT = _SCRIPTS_DIR.parent
README_PATH = REPO_ROOT / "README.md"

# Prefer current free-tier IDs; fall back if Google retires one.
MODEL_CANDIDATES = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
]

# Keep prompts bounded, but never truncate away the live README SoT.
MAX_STRUCTURE_CHARS = 12_000
MAX_KEY_FILES_JSON_CHARS = 12_000
MAX_README_PROMPT_CHARS = 80_000
MAX_CRITIC_README_CHARS = 40_000

_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not _api_key:
    raise SystemExit("Set GEMINI_API_KEY (or GOOGLE_API_KEY) before running.")
client = genai.Client(api_key=_api_key)


def run(cmd: list[str]) -> str:
    """Run a command without shell interpolation."""
    return subprocess.check_output(cmd, text=True, cwd=REPO_ROOT).strip()


def scan_repo() -> dict:
    structure = run(
        [
            "bash",
            "-lc",
            "find . -type f -not -path './.git/*' -not -path './node_modules/*' | head -100",
        ]
    )
    recent_commits = run(["git", "log", "-10", "--oneline"])
    key_files = []
    for p in [
        "package.json",
        "src/data/calculatorDataVersion.js",
        "AGENTS.md",
        "docs/team/PROJECT-STATE.md",
    ]:
        path = REPO_ROOT / p
        if path.exists() and path.is_file():
            # Skip unresolved merge markers in key-file context (avoid teaching the model garbage).
            content = path.read_text(errors="replace")
            if "<<<<<<<" in content:
                content = content.split("<<<<<<<", 1)[0]
            key_files.append({"path": p, "content": content[:4000]})
    current_readme = README_PATH.read_text() if README_PATH.exists() else ""
    return {
        "structure": structure[:MAX_STRUCTURE_CHARS],
        "recent_commits": recent_commits,
        "key_files": key_files,
        "current_readme": current_readme,
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
Preserve existing sections, links, the AUTO-GENERATED-BLOCK, and legal/license text
unless the scan proves they are wrong.
Return ONLY the full new README.md content (no markdown fences)."""
    current = scan["current_readme"]
    if len(current) > MAX_README_PROMPT_CHARS:
        current = current[:MAX_README_PROMPT_CHARS] + "\n\n<!-- truncated for prompt size -->\n"
    user = f"""Current date: {scan['date']}

Repo structure:
{scan['structure']}

Recent commits:
{scan['recent_commits']}

Key files:
{json.dumps(scan['key_files'], indent=2)[:MAX_KEY_FILES_JSON_CHARS]}

Current README (authoritative — preserve unless inaccurate):
{current}

Produce the complete updated README.md now."""
    return {"readme": call_llm("writer", system, user)}


def critique(scan: dict, proposed: dict) -> bool:
    system = (
        "You are a strict documentation quality gate. Reply with only YES or NO. "
        "YES only if the proposed README is more accurate/useful than the current one "
        "and does not drop important setup, deploy, license, or auto-generated blocks."
    )
    current = scan["current_readme"][:MAX_CRITIC_README_CHARS]
    proposed_text = proposed["readme"][:MAX_CRITIC_README_CHARS]
    user = f"""Does this proposed README improve accuracy based on the scan?

Scan commits:
{scan['recent_commits'][:500]}

Current README length: {len(scan['current_readme'])}
Proposed README length: {len(proposed['readme'])}

Current README:
{current}

Proposed README:
{proposed_text}

Reply YES only if the change is meaningful and correct. Otherwise NO."""
    decision = call_llm("critic", system, user).strip().upper()
    return decision.startswith("YES")


def main():
    print("Scanning repo...")
    scan = scan_repo()
    print("Generating updated docs...")
    proposed = write_docs(scan)
    proposed_readme = normalize_readme(proposed.get("readme", ""))
    proposed = {"readme": proposed_readme}

    ok, reason = validate_readme_update(scan["current_readme"], proposed_readme)
    if not ok:
        print(f"Safety gate rejected update: {reason}")
        return

    print("Critic review...")
    if critique(scan, proposed):
        README_PATH.write_text(proposed_readme)
        print("Documentation updated")
    else:
        print("No meaningful changes – skipping")


if __name__ == "__main__":
    main()
