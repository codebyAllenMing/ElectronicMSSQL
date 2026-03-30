# Changelog

All notable changes to this project will be documented in this file.

## [1.0.17] — 2026-03-31

### Added
- Advanced data search: filter by equals, not equals, comparison operators, LIKE (contains/starts/ends), and IN (tag input)
- AND/OR logic between multiple filter conditions
- Column visibility toggle (chip-based) — hidden columns excluded from SQL SELECT
- Select-all checkbox in table header
- SQL INSERT preview in a separate child window
- Child window system: reusable architecture for opening independent React-based windows
- Settings modal split into tabs: connection settings + system settings
- Slack webhook URL configurable via Settings UI (encrypted with safeStorage)
- SQL injection protection: operator whitelist, logic whitelist, column name sanitization
- Try/catch on all schema IPC handlers with Slack error notifications
- App version displayed in sidebar

### Fixed
- safeHandle recursive call bug (was calling itself instead of ipcMain.handle)
- Search results now clear row selections to prevent stale data
- Column toggle clears row selections to prevent mismatched row structure
- ORDER BY fix: use `ORDER BY 1` with filters, `ORDER BY (SELECT NULL)` without
- Slack webhook preserved when saving connection settings

## [1.0.16] — 2026-03-30

### Added
- Force-update overlay: blocks app interaction until update is installed

### Removed
- Unused root `icon.png`

## [1.0.15] — 2026-03-30

### Added
- Connection status dot (green/yellow/red) next to server address in sidebar
- Connect/disconnect toggle button in sidebar

## [1.0.14] — 2026-03-30

### Fixed
- `icon.ico` replaced with proper multi-resolution ICO format (was PNG renamed to .ico, causing Windows build failure)

## [1.0.13] — 2026-03-30

### Fixed
- Inter font `@import` moved from CSS to JS entry point to resolve CI build failure

## [1.0.8] — 2026-03-30

### Fixed
- `getAppVersion` crash in preload: `app` module is main-process only, now routed via IPC
- Sidebar version number separated from settings button with divider

## [1.0.7] — 2026-03-30

### Added
- Custom app icon (macOS `.icns`, Windows `.ico`)
- Inter Variable font applied globally (self-hosted)
- Encrypt toggle in Connection Settings for Azure SQL / SSL
- Settings modal width increased

## [1.0.6] — 2026-03-30

### Added
- Slack error notifications for update errors, connection errors, and unhandled exceptions
- Auto-update error surfaced in UI banner

## [1.0.5] — 2026-03-30

### Added
- Auto-update via electron-updater + GitHub Releases

### Fixed
- Handle missing `appsettings.json` on first launch (no more crash)
- Publish config uses `releaseType: release` (removes draft mode)

## [1.0.4] — 2026-03-30

### Added
- Connection Settings UI with gear icon in sidebar
- Password encrypted via Electron safeStorage (macOS Keychain / Windows DPAPI)
- Password never transmitted to renderer process
- Eye icon toggle for password visibility
- Prettier applied across all source files

### Fixed
- Close window now quits app on all platforms (including macOS)

## [1.0.3] — 2026-03-29

### Fixed
- DDL export now uses FK-aware topological sort

## [1.0.2] — 2026-03-29

### Added
- Data tab: row checkboxes for selecting specific rows
- Export Data button for generating INSERT statements
- INSERT export with FK-aware topological sort
- Row selections persist across table/page switches
- Database switch clears all selections

## [1.0.1] — 2026-03-29

### Fixed
- DDL includes schema prefix (`[schema].[table]`)
- DDL handles IDENTITY columns correctly
- `getColumns` filters by schema (prevents duplicates)
- `getTables` row count scoped per schema
- FK references include schema prefix

### Added
- Sidebar tree groups tables by schema

## [1.0.0] — 2026-03-29

### Added
- Initial release
- MSSQL connection via appsettings.json (SQL Login)
- Sidebar tree: Server > Database > Tables
- Data tab: pagination, column drag-reorder, column resize, cell copy
- Schema tab: column details, DDL preview, single/bulk DDL export
- Light / Dark mode toggle
