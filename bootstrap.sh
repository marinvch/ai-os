#!/usr/bin/env bash
# =============================================================================
#  AI OS Bootstrap
#  Run from any target repository to fetch and execute AI OS installer.
# =============================================================================

set -euo pipefail

REPO_URL="${AI_OS_REPO_URL:-https://github.com/marinvch/ai-os.git}"
TARGET_PWD="$(pwd)"
TMP_ROOT="${TMPDIR:-/tmp}"
TMP_DIR="${TMP_ROOT}/ai-os-bootstrap-$$"

cleanup() {
  if [[ -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

mkdir -p "$TMP_DIR"

echo "→ Fetching AI OS from ${REPO_URL}"
git clone --depth 1 "$REPO_URL" "$TMP_DIR/ai-os" >/dev/null 2>&1

HAS_CWD=false
for arg in "$@"; do
  if [[ "$arg" == "--cwd" || "$arg" == --cwd=* ]]; then
    HAS_CWD=true
    break
  fi
done

if [[ "$HAS_CWD" == "true" ]]; then
  bash "$TMP_DIR/ai-os/install.sh" "$@"
else
  bash "$TMP_DIR/ai-os/install.sh" --cwd "$TARGET_PWD" "$@"
fi
