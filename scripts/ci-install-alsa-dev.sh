#!/usr/bin/env bash
# Install libasound2-dev for easymidi native build on Linux CI.
# ubuntu-latest runners ship a Google Chrome apt source that can flake during
# mirror sync (hash mismatch on Packages.gz) and fail unrelated apt-get update.
set -euo pipefail

shopt -s nullglob
for f in /etc/apt/sources.list.d/google-chrome*.list /etc/apt/sources.list.d/google-chrome*.sources; do
  sudo rm -f "$f"
done

sudo apt-get update
sudo apt-get install -y --no-install-recommends libasound2-dev
