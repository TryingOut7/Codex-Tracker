# Codex Switcher

Track Codex usage across multiple ChatGPT accounts. macOS desktop app built on Tauri 2.

The app stores per-account OAuth tokens in macOS Keychain, periodically polls
`chatgpt.com/backend-api/wham/usage`, and surfaces the account with the most
remaining quota in a "best right now" banner.

## Prerequisites

- Rust stable ≥ **1.82** (`rustup update stable`)
- Node.js ≥ 20, npm ≥ 10
- Xcode Command Line Tools (`xcode-select --install`)
- macOS 13 or newer

## Quick start

```bash
cd codex-switcher
npm install
npm run tauri dev
```

The first launch will:

1. Create the SQLite database under `~/Library/Application Support/com.motosan.codex-switcher/codex_switcher.db`.
2. Prompt you to allow Keychain access the first time you log in.
3. Open a system browser tab pointing at `auth.openai.com` for the OAuth flow.

## Build a signed release

Edit `src-tauri/tauri.conf.json` and replace the `signingIdentity` value with
your Developer ID, then:

```bash
npm run tauri build
```

The `.app` bundle has `LSUIElement=true` (menubar app — no Dock icon).

## Architecture

- Frontend: React 18 + TypeScript + Tailwind v3 + lucide-react.
- Backend: Tauri 2 + sqlx (raw SQL against SQLite), `keyring` for Keychain,
  `reqwest` with rustls for TLS, and `codex-oauth = "=0.1.0"` for the PKCE flow.
- Background poller (tokio) refreshes usage on a configurable interval with
  exponential backoff on rate-limit / network errors.

## Security

- OAuth tokens are stored in macOS Keychain under service
  `com.motosan.codex-switcher`. The frontend never sees a token — only DTOs
  that omit secrets.
- Strict CSP in production (no inline scripts, no eval); a relaxed `devCsp`
  is used for Vite HMR.
- `cargo deny` config is checked in at `src-tauri/deny.toml`.

See `docs/plans/codex_account_switcher_fd86f2cd.plan.md` (rev 3) for the full
build plan, edge cases, and validation checklist.
