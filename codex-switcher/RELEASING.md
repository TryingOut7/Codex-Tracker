# Release Checklist

## Prerequisites
- Homebrew tap: `TryingOut7/homebrew-tap` (repo: github.com/TryingOut7/homebrew-tap)
- Updater endpoint: `https://github.com/TryingOut7/Codex-Tracker/releases/latest/download/latest.json`
- Updater pubkey is in `src-tauri/tauri.conf.json` — the matching private key lives in your Tauri keyring

## Steps

### 1. Bump version (two files)
- `src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
- `src-tauri/Cargo.toml` → `version = "X.Y.Z"`

### 2. Build
```bash
source ~/.cargo/env
npm run tauri build
```
Artifacts land in `src-tauri/target/release/bundle/`.

### 3. Get DMG SHA256 (needed for Homebrew cask)
```bash
shasum -a 256 "src-tauri/target/release/bundle/dmg/Codex Switcher_X.Y.Z_aarch64.dmg"
```

### 4. Create GitHub release and upload artifacts
```bash
# DMG (for Homebrew / manual download)
gh release create vX.Y.Z \
  "src-tauri/target/release/bundle/dmg/Codex Switcher_X.Y.Z_aarch64.dmg" \
  --repo TryingOut7/Codex-Tracker \
  --title "vX.Y.Z" \
  --notes "What changed."

# .app.tar.gz (for in-app updater)
gh release upload vX.Y.Z \
  "src-tauri/target/release/bundle/macos/Codex Switcher.app.tar.gz" \
  --repo TryingOut7/Codex-Tracker
```
Note: GitHub renames spaces to dots — the assets will be `Codex.Switcher_X.Y.Z_aarch64.dmg` and `Codex.Switcher.app.tar.gz`.

### 5. Build and upload latest.json (triggers in-app update prompt)
```bash
SIG=$(cat "src-tauri/target/release/bundle/macos/Codex Switcher.app.tar.gz.sig")
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > /tmp/latest.json << EOF
{
  "version": "X.Y.Z",
  "notes": "What changed.",
  "pub_date": "$PUB_DATE",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$SIG",
      "url": "https://github.com/TryingOut7/Codex-Tracker/releases/download/vX.Y.Z/Codex.Switcher.app.tar.gz"
    }
  }
}
EOF

gh release upload vX.Y.Z /tmp/latest.json --repo TryingOut7/Codex-Tracker --clobber
```

### 6. Update Homebrew tap
Edit `Casks/codex-switcher.rb` in the `TryingOut7/homebrew-tap` repo:
- `version "X.Y.Z"`
- `sha256 "<value from step 3>"`

Then commit and push that repo.

### 7. Update local /Applications (your own machine)
```bash
cp -R "src-tauri/target/release/bundle/macos/Codex Switcher.app" "/Applications/Codex Switcher.app"
```

### 8. Commit and push the main repo
```bash
git add src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to X.Y.Z"
git push origin main
```

## How users get updates
- **In-app prompt**: automatic — app checks `latest.json` on launch and shows an update dialog
- **Homebrew**: `brew upgrade --cask codex-switcher`
