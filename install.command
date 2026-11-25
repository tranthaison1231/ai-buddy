#!/bin/bash
# AI Buddy installer: double-click "install.command" (or run: bash install.command).
# Requires only Raycast. Node.js is downloaded privately into ~/.ai-buddy if not already available.
# Running this script again updates AI Buddy while preserving your hotkeys and settings.
set -euo pipefail

APP_DIR="$HOME/.ai-buddy/app"
NODE_DIR="$HOME/.ai-buddy/node"
NODE_VERSION="v22.12.0"
SRC="$(cd "$(dirname "$0")" && pwd)"

say_step() { printf "\n\033[1;35m▸ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1"; read -r -p "Press Enter to close…"; exit 1; }

say_step "Checking Raycast"
[ -d "/Applications/Raycast.app" ] || { open "https://www.raycast.com"; fail "Please install Raycast first (https://www.raycast.com), launch it once, and then run this installer again."; }

say_step "Checking Node.js"
node_ok() { command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; }
if ! node_ok; then
  export PATH="$NODE_DIR/bin:$PATH"
  if ! node_ok; then
    ARCH=$([ "$(uname -m)" = "arm64" ] && echo arm64 || echo x64)
    echo "Downloading Node.js $NODE_VERSION ($ARCH)…"
    FILE="node-$NODE_VERSION-darwin-$ARCH.tar.gz"
    TMP="$(mktemp -d)"
    curl -fsSL -o "$TMP/$FILE" "https://nodejs.org/dist/$NODE_VERSION/$FILE" &&
      curl -fsSL -o "$TMP/SHASUMS256.txt" "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" ||
      fail "Unable to download Node.js. Please check your internet connection."
    # Only unpack a file that matches the checksum published by nodejs.org.
    (cd "$TMP" && grep " $FILE\$" SHASUMS256.txt | shasum -a 256 -c -) >/dev/null ||
      fail "The Node.js download is corrupted (checksum mismatch). Please run the installer again."
    mkdir -p "$NODE_DIR"
    tar -xzf "$TMP/$FILE" -C "$NODE_DIR" --strip-components 1
    rm -rf "$TMP"
  fi
fi
echo "Node $(node -v)"

say_step "Copying AI Buddy to $APP_DIR"
mkdir -p "$APP_DIR"
rsync -a --delete --exclude node_modules --exclude "install.command" "$SRC/app/" "$APP_DIR/"

say_step "Installing dependencies (this may take about a minute the first time)"
cd "$APP_DIR"
npm ci --no-audit --no-fund --loglevel=error --update-notifier=false || fail "npm install failed."

say_step "Adding AI Buddy to Raycast"
open -a Raycast
LOG="$(mktemp)"
npx ray develop >"$LOG" 2>&1 &
DEV_PID=$!
for _ in $(seq 1 90); do
  grep -q "built extension" "$LOG" && break
  kill -0 "$DEV_PID" 2>/dev/null || break
  sleep 1
done
pkill -f "ray develop" 2>/dev/null || true
grep -q "built extension" "$LOG" || { cat "$LOG"; fail "Raycast could not load AI Buddy. Please review the log output above."; }

printf "\n\033[1;32m✓ AI Buddy is installed.\033[0m\n"
cat <<'EOF'

Next steps in Raycast:
  1. Type "Buddy Home" and press Enter, then open Settings to choose your Active Provider and enter its API key.
  2. Optional hotkeys: Raycast Settings → Extensions → AI Buddy →
     Buddy Translate ⌃⌘T · Buddy Draft Reply ⌃⌘R · Buddy Polish English ⌃⌘E · Buddy Write ⌃⌘W
     Buddy Summarize ⌃⌘S · Buddy Ask ⌃⌘A · Buddy Vision ⌃⌘V

EOF
read -r -p "Press Enter to close…"
