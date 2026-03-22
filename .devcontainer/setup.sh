#!/usr/bin/env bash
set -euo pipefail

echo "=== Installing Claude Code CLI ==="
curl -fsSL https://claude.ai/install.sh | bash

echo "=== Installing ruflo globally ==="
npm install -g ruflo@latest

echo "=== Installing project dependencies ==="
npm ci

echo "=== Prebuild setup complete ==="
