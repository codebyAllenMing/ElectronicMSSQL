# Project: ElectronicMSSQL

## Overview
An Electron desktop app built with React 19 + Vite + TypeScript.
Purpose: Connect to a remote MSSQL database, browse its structure,
and export table schemas as migration files.
This is a personal tool — prioritize maintainability and clean code
over feature richness.

## Tech Stack
- Electron (latest stable)
- React 19
- Vite
- TypeScript (strict mode)
- Tailwind CSS
- mssql (npm package for MSSQL connection)

## Configuration
- Connection string stored in `appsettings.json` at project root
- User provides a full SQL Login connection string
- Structure:
  {
    "connection": {
      "server": "",
      "port": 1433,
      "database": "",
      "user": "",
      "password": ""
    }
  }
- Authentication: SQL Login only (no Windows Auth)

## Layout
- Left sidebar: collapsible tree view
  └── [Server]
      └── [Database]
          └── [Table]
- Main content area: changes based on selection
- Theme toggle button in top-right corner (light / dark)

## Features

### 1. Database Tree Browser
- On startup, connect via appsettings.json
- Tree: Server → Databases → Tables (lazy-loaded on expand)
- Clicking a database shows all tables in main area (overview list)
- Overview list columns: table name, column count, row count

### 2. Table Overview (main area)
- Each row has a checkbox for selection
- Toolbar: Select All / Deselect All / Export Selected
- Click a table row → open Schema Detail View

### 3. Schema Detail View
- Show all columns: name, data type, max length, nullable, PK, FK, default value
- Clean readable table layout

### 4. Schema Export
- Export format: pure MSSQL DDL (CREATE TABLE ... with constraints)
- Also display DDL inline in the UI (copyable code block)
- Export scope: single table or multiple selected tables
- Output: .sql file(s)

## UI / Styling
- Tailwind CSS only — no component libraries
- Custom components built from scratch
- Light / Dark mode with toggle button (top-right corner)
- Layout: fixed left sidebar (tree) + scrollable main content area

## Code Style
- Functional components only, no class components
- Explicit TypeScript types — avoid `any`
- File naming: kebab-case for files, PascalCase for components
- Keep components small and single-responsibility
- No unnecessary abstractions — keep it simple and readable
- Code style will be refined iteratively via prompt adjustments
