# Changelog

All notable changes are documented here.

## [1.0.8] - 2026-05-07

### Fixed
- Window drag now works on first attempt without needing to switch focus away and back first

## [1.0.7] - 2026-05-07

### Fixed
- "Restart Now" button after an update now correctly relaunches the app (corrected capability to `process:allow-restart`)

## [1.0.5] - 2026-05-07

### Fixed
- "Check for Updates" now correctly shows "You're up to date" instead of "Update check failed" when already on the latest version

## [1.0.4] - 2026-05-06

### Added
- Crash reporting via Sentry (captures unhandled JS errors in the UI)
- First-run welcome screen explaining the app and guiding users to add their first account
- Support section in Settings with links to report bugs, view the changelog, and read the docs

## [1.0.3] - 2026-05-06

### Fixed
- Auto-updater now correctly generates `.app.tar.gz` artifacts so the update mechanism works end-to-end

## [1.0.2] - 2026-05-06

### Added
- Automatic background update check on every launch — shows a "Restart" banner when an update is ready
- Manual "Check for Updates" button in Settings with live download progress bar

## [1.0.1] - 2026-05-01

### Added
- Initial public release
- Track Codex usage across multiple ChatGPT accounts
- One-click copy of the `claude codex` switch command for the account with the most capacity
- macOS menu bar tray icon with per-account status
- Configurable polling interval and low-usage alerts
