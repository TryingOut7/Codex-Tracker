# Codex Switcher

> A macOS menubar app that tracks [OpenAI Codex](https://platform.openai.com/docs/guides/codex) (ChatGPT) usage across multiple accounts so you always know which one has quota left.

**[Download latest release](https://github.com/TryingOut7/Codex-Tracker/releases/latest)** · [Privacy Policy](https://tryingout7.github.io/Codex-Tracker/privacy.html)

---

## Features

- **Multi-account dashboard** — add as many ChatGPT accounts as you need; drag cards to reorder
- **Live quota bars** — 5-hour and weekly usage bars with color-coded severity
- **"Best right now" banner** — instantly see which account has the most remaining quota
- **Background polling** — configurable 5–60 minute interval, with exponential backoff on rate limits
- **Usage alerts** — bell icon on cards below a configurable threshold (e.g. warn at 20% remaining)
- **Stale data indicator** — clock icon when data is older than 5 minutes
- **Rate-limit visibility** — amber banner shows "Rate limited · retrying in ~Xm" during backoff
- **Auto-update** — checks for new releases from the GitHub Releases page
- **Keychain storage** — OAuth tokens live in macOS Keychain, never in plaintext; zeroed on delete
- **Structured logs** — rolling daily JSON logs at `~/Library/Logs/com.motosan.codex-switcher/`

## Install

1. Go to [Releases](https://github.com/TryingOut7/Codex-Tracker/releases/latest)
2. Download `Codex.Switcher_<version>_aarch64.dmg` (Apple Silicon) or `x86_64.dmg` (Intel)
3. Open the DMG, drag **Codex Switcher** to `/Applications`
4. Right-click the app → **Open** on first launch (unsigned build; macOS Gatekeeper prompt)

The app appears in your menubar. There is no Dock icon (`LSUIElement=true`).

## Usage

1. Click the menubar icon → **Open Codex Switcher**
2. Click **Add** → complete the OAuth flow in your browser
3. Usage data refreshes automatically on the configured interval
4. The "Best right now" banner updates after each refresh

**Keyboard shortcuts**

| Shortcut | Action |
|---|---|
| `⌘R` | Refresh all accounts |
| `⌘Q` | Quit |
| `⌘⌥I` | Open Web Inspector (debug) |

## Build from source

**Prerequisites:** Rust stable ≥ 1.82, Node.js ≥ 20, Xcode Command Line Tools, macOS 13+

```bash
git clone https://github.com/TryingOut7/Codex-Tracker.git
cd Codex-Tracker
npm install
npm run tauri dev
```

To build a release bundle:

```bash
npm run tauri build -- --target aarch64-apple-darwin   # Apple Silicon
npm run tauri build -- --target x86_64-apple-darwin    # Intel
```

## Architecture

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS v3, Vite, lucide-react |
| Backend | Tauri 2, Rust, tokio async runtime |
| Storage | SQLite via sqlx (usage snapshots, settings), macOS Keychain (OAuth tokens) |
| Auth | `codex-oauth` crate — PKCE flow, opens system browser |
| Networking | `reqwest` with rustls, HTTPS only |
| Logging | `tracing` + `tracing-appender` — daily rolling JSON log files |

The background poller uses exponential backoff: 1 → 3 → 7 → 15 → 16 ticks on rate-limit errors, capped at 8 on network errors.

## Security

- OAuth tokens stored in macOS Keychain under `com.motosan.codex-switcher`, zeroed with `zeroize` before deallocation
- Frontend never receives raw tokens — only serialized DTOs
- Strict CSP in production: `connect-src ipc: http://ipc.localhost` only
- No analytics, no crash reporting servers, no telemetry of any kind

## Privacy

See [privacy policy](https://tryingout7.github.io/Codex-Tracker/privacy.html). Short version: all data stays on your Mac.

## License

MIT
