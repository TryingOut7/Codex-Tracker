#!/bin/bash
APP="/Applications/Codex Switcher.app"

if [ ! -d "$APP" ]; then
  echo "Codex Switcher not found in /Applications."
  echo "Please drag the app to your Applications folder first, then run this script again."
  read -rp "Press Enter to close..."
  exit 1
fi

xattr -dr com.apple.quarantine "$APP"
echo "Done! Codex Switcher is ready to open."
read -rp "Press Enter to close..."
