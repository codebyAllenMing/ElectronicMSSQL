# ElectronicMSSQL

A personal Electron desktop app for browsing and querying MSSQL databases. Built as an internal tool for inspecting database structures, previewing data, and exporting schemas or row data as SQL scripts.

## Why

Managing remote MSSQL databases often requires heavy tools like SSMS or Azure Data Studio. This app provides a lightweight, cross-platform alternative focused on schema browsing and data export — nothing more, nothing less.

## What It Does

- **Connect** to any MSSQL server via SQL Login (with optional SSL/Azure encryption)
- **Browse** databases, schemas, and tables in a sidebar tree view
- **Inspect** table schemas: column types, primary keys, foreign keys, identity, defaults
- **Query** table data with advanced filters (equals, not equals, comparison operators, LIKE, IN)
- **Toggle columns** on/off to focus on relevant fields (reduces SQL SELECT for performance)
- **Select rows** and export as INSERT statements (FK-aware topological sort)
- **Preview SQL** in a separate window before exporting
- **Export DDL** (CREATE TABLE) for single or multiple tables as `.sql` files
- **Auto-update** via GitHub Releases with a forced update overlay

## Features

- Light / Dark mode toggle
- Connection status indicator with connect/disconnect toggle
- Settings modal with tabs: connection config + system config (Slack webhook)
- Password and Slack webhook encrypted via Electron `safeStorage`
- Slack notifications for connection errors, update errors, and unhandled exceptions
- SQL injection protection: parameterized queries, operator whitelist, column name sanitization
- Child window system for opening multiple independent preview windows
- Custom app icon for macOS and Windows

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron (latest stable) |
| Frontend | React 19 + TypeScript (strict) |
| Build | Vite via electron-vite |
| Styling | Tailwind CSS |
| Database | mssql (npm) — SQL Login only |
| Font | Inter Variable (self-hosted) |
| Updates | electron-updater + GitHub Releases |

## Setup

1. Install dependencies:

```bash
nvm use 20
pnpm install
```

2. Create `appsettings.json` in the project root:

```json
{
  "connection": {
    "server": "your-server",
    "port": 1433,
    "database": "your-database",
    "user": "your-user",
    "password": "your-password",
    "encrypt": false
  }
}
```

> Passwords are automatically encrypted on first launch. `appsettings.json` is excluded from git.

3. (Optional) Add Slack webhook for error notifications — either in `appsettings.json` or via Settings > System tab in the app.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development mode with hot reload |
| `pnpm build` | Compile to `out/` |
| `pnpm package` | Build + package app to `dist/` |
| `pnpm typecheck` | Run TypeScript type check |

## Project Structure

```
src/
├── main/                  # Electron main process
│   └── ipc/               # IPC handlers (connection, schema, updater, child-window)
├── preload/               # contextBridge API exposure
├── renderer/src/          # React app
│   ├── components/
│   │   ├── child/         # Child window components (sql-preview)
│   │   ├── layout/        # Sidebar, MainContent
│   │   ├── search/        # SearchBar, SearchRow, TagInput
│   │   ├── table/         # TableOverview, SchemaDetail, TableData
│   │   ├── tree/          # Tree view nodes
│   │   ├── export/        # DdlBlock
│   │   └── ui/            # Button, Checkbox, ThemeToggle, SettingsModal, UpdateBanner
│   └── hooks/             # use-theme, use-database, use-loading
└── types/                 # Shared TypeScript types
```

## License

Private — personal use only.
