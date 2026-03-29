# Project Structure

## Architecture Decisions
- **IPC**: Main process runs `mssql` queries, communicates to renderer via IPC. DB logic stays in main side, renderer handles UI only.
- **appsettings.json**: Root directory for dev. Packaged app reads from `app.getPath('userData')`.
- **DDL Export**: User selects save path via system dialog.

## Directory Structure

```
ElectronicMSSQL/
├── CLAUDE.md
├── PROJECT_STRUCTURE.md
├── appsettings.json              # DB connection config
├── electron.vite.config.ts       # electron-vite config
├── tsconfig.json
├── tsconfig.node.json
├── package.json
│
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.ts              # entry point
│   │   └── ipc/                  # IPC handlers
│   │       ├── connection.ts     # connect, list databases
│   │       └── schema.ts         # get tables, columns, DDL
│   │
│   ├── preload/
│   │   └── index.ts              # contextBridge expose API
│   │
│   └── renderer/                 # React app
│       ├── index.html
│       ├── main.tsx
│       ├── app.tsx
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   └── MainContent.tsx
│       │   ├── tree/
│       │   │   ├── TreeView.tsx
│       │   │   ├── TreeNode.tsx
│       │   │   └── TreeNodeDatabase.tsx
│       │   ├── table/
│       │   │   ├── TableOverview.tsx   # list + checkbox
│       │   │   └── SchemaDetail.tsx    # column detail
│       │   ├── export/
│       │   │   └── DdlBlock.tsx        # DDL display + copy
│       │   └── ui/
│       │       ├── ThemeToggle.tsx
│       │       ├── Checkbox.tsx
│       │       └── Button.tsx
│       │
│       ├── hooks/
│       │   ├── use-theme.ts
│       │   └── use-database.ts
│       │
│       ├── types/
│       │   └── schema.ts         # Column, Table, Database type definitions
│       │
│       └── styles/
│           └── globals.css       # Tailwind base
```
