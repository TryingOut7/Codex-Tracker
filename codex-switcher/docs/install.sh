#!/usr/bin/env bash
set -euo pipefail

REPO="TryingOut7/Codex-Tracker"
APP_NAME="Codex Switcher"
TMP_DIR="$(mktemp -d)"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

err() { echo "Error: $1" >&2; exit 1; }
info() { echo "→ $1"; }

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  arm64)   ARCH_SUFFIX="aarch64" ;;
  x86_64)  ARCH_SUFFIX="x64" ;;
  *)       err "Unsupported architecture: $ARCH" ;;
esac

# Detect macOS
[[ "$(uname -s)" == "Darwin" ]] || err "Codex Switcher requires macOS."

# Check macOS 13+
OS_VER="$(sw_vers -productVersion)"
MAJOR="${OS_VER%%.*}"
[[ "$MAJOR" -ge 13 ]] || err "Codex Switcher requires macOS 13 Ventura or later (you have $OS_VER)."

info "Fetching latest release info..."
LATEST_JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"
TAG="$(echo "$LATEST_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": "\(.*\)".*/\1/')"
VERSION="${TAG#v}"

[[ -n "$VERSION" ]] || err "Could not determine latest version."

DMG_FILE="Codex.Switcher_${VERSION}_${ARCH_SUFFIX}.dmg"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${DMG_FILE}"
DMG_PATH="${TMP_DIR}/${DMG_FILE}"

info "Downloading ${APP_NAME} ${TAG} (${ARCH_SUFFIX})..."
curl -fL --progress-bar "$DOWNLOAD_URL" -o "$DMG_PATH" || err "Download failed."

info "Mounting disk image..."
MOUNT_OUTPUT="$(hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountrandom "$TMP_DIR" 2>&1)"
MOUNT_POINT="$(echo "$MOUNT_OUTPUT" | grep -o '/private/tmp/[^ ]*\|/tmp/[^ ]*' | tail -1)"

[[ -d "$MOUNT_POINT" ]] || err "Could not mount DMG."
unmount_dmg() { hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true; }
trap "unmount_dmg; cleanup" EXIT

info "Installing to /Applications..."
APP_SRC="$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" | head -1)"
[[ -n "$APP_SRC" ]] || err "Could not find .app in DMG."

DEST="/Applications/${APP_NAME}.app"
if [[ -d "$DEST" ]]; then
  info "Removing existing installation..."
  rm -rf "$DEST"
fi

cp -R "$APP_SRC" "/Applications/"

info "Clearing quarantine attribute (required for unsigned builds)..."
xattr -rd com.apple.quarantine "$DEST" 2>/dev/null || true

unmount_dmg

echo ""
echo "✓ ${APP_NAME} ${TAG} installed to /Applications"
echo ""
echo "  To launch: open -a \"${APP_NAME}\""
echo "  On first launch, look for the menubar icon (⌥) near the clock."
