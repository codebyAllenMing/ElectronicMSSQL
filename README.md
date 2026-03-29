# ElectronicMSSQL

A personal Electron desktop app for browsing MSSQL database structure and exporting DDL.

**Version:** 1.0.2

---

## Tech Stack

- Electron 33 + electron-vite 5
- React 19
- TypeScript (strict)
- Tailwind CSS
- mssql 11

---

## Features

### Database Browser
- Connect to MSSQL via `appsettings.json` (SQL Login)
- Left sidebar tree: Server → Databases → Schema → Tables (lazy-loaded)

### Data Tab (default view)
- Browse table rows with pagination (100 / 500 / 1000 rows per page)
- Displays total row count
- Drag column headers to reorder
- Drag column edges to resize width
- Double-click a cell to copy its value to clipboard

### Schema Tab
- Column details: name, type, max length, nullable, default, PK, FK
- Show DDL inline with copy button
- Export DDL as `.sql` file (system save dialog)
- Bulk export: select multiple tables from the overview and export all at once

### UI
- Light / Dark mode toggle (top-right corner)
- Monospace font throughout

---

## Setup

1. Copy `appsettings.json` and fill in your connection details:

```json
{
  "connection": {
    "server": "your-server",
    "port": 1433,
    "database": "your-database",
    "user": "your-user",
    "password": "your-password"
  }
}
```

> `appsettings.json` is excluded from git.

2. Install dependencies:

```bash
nvm use 20
pnpm install
```

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development mode with hot reload |
| `pnpm build` | Compile to `out/` |
| `pnpm package` | Build + package app to `dist/` |
| `pnpm typecheck` | Run TypeScript type check |

---

## Project Structure

```
src/
├── main/               # Electron main process
│   └── ipc/            # IPC handlers (connection, schema, DDL)
├── preload/            # contextBridge API exposure
├── renderer/src/       # React app
│   ├── components/
│   │   ├── layout/     # Sidebar, MainContent
│   │   ├── tree/       # Tree view nodes
│   │   ├── table/      # TableOverview, SchemaDetail, TableData
│   │   ├── export/     # DdlBlock
│   │   └── ui/         # Button, Checkbox, ThemeToggle
│   └── hooks/          # use-theme, use-database
└── types/              # Shared TypeScript types
```

---

## Changelog

<!-- New versions go below the previous one -->

### 1.0.2 — 2026-03-29
- Data tab: row checkboxes to select specific rows for export
- Top bar: "Export Data (N rows)" button appears when any rows are selected
- Data export generates INSERT statements with FK-aware topological sort (referenced tables inserted first)
- Selected rows persist when switching between tables or pages
- Switching to a different database clears all row selections

### 1.0.1 — 2026-03-29
- Fix: DDL now includes schema prefix (`[schema].[table]`)
- Fix: DDL now correctly handles `IDENTITY` columns
- Fix: `getColumns` now filters by schema, preventing duplicate columns when same table name exists in multiple schemas
- Fix: `getTables` row count now correctly scoped per schema
- Fix: DDL foreign key `REFERENCES` now includes schema prefix
- Sidebar tree now groups tables by schema: Server → Database → Schema → Tables
- Table overview toolbar shows schema filter dropdown when multiple schemas exist

### 1.0.0 — 2026-03-29
- Initial release
- MSSQL connection via appsettings.json (SQL Login)
- Left sidebar tree: Server → Database → Tables
- Data tab: pagination (100/500/1000), total count, column drag-reorder, column resize, double-click cell to copy
- Schema tab: column details, DDL inline preview, single/bulk DDL export as .sql
- Light / Dark mode toggle
