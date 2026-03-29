import { ipcMain, app, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import sql from 'mssql'
import type { TableInfo, ColumnInfo } from '../../types/schema'

type AppSettings = {
  connection: {
    server: string
    port: number
    database: string
    user: string
    password: string
  }
}

function loadSettings(): AppSettings {
  const settingsPath = app.isPackaged
    ? join(app.getPath('userData'), 'appsettings.json')
    : join(process.cwd(), 'appsettings.json')

  const raw = readFileSync(settingsPath, 'utf-8')
  return JSON.parse(raw) as AppSettings
}

async function getPool(database: string): Promise<sql.ConnectionPool> {
  const settings = loadSettings()
  const { server, port, user, password } = settings.connection

  const pool = new sql.ConnectionPool({
    server,
    port,
    database,
    user,
    password,
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  })
  return pool.connect()
}

export function registerSchemaHandlers(): void {
  ipcMain.handle('db:getTables', async (_, database: string) => {
    const pool = await getPool(database)

    const result = await pool.request().query(`
      SELECT
        t.TABLE_NAME AS tableName,
        t.TABLE_SCHEMA AS tableSchema,
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA
            AND c.TABLE_NAME = t.TABLE_NAME
        ) AS columnCount,
        (
          SELECT SUM(p.rows)
          FROM sys.tables st
          JOIN sys.schemas sc ON st.schema_id = sc.schema_id
          JOIN sys.partitions p ON st.object_id = p.object_id
          WHERE st.name = t.TABLE_NAME
            AND sc.name = t.TABLE_SCHEMA
            AND p.index_id IN (0, 1)
        ) AS [rowCount]
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_NAME
    `)

    await pool.close()

    return result.recordset as TableInfo[]
  })

  ipcMain.handle('db:getColumns', async (_, database: string, tableSchema: string, tableName: string) => {
    const pool = await getPool(database)

    const result = await pool
      .request()
      .input('tableName', sql.NVarChar, tableName)
      .input('tableSchema', sql.NVarChar, tableSchema)
      .query(`
        SELECT
          c.COLUMN_NAME AS columnName,
          c.DATA_TYPE AS dataType,
          c.CHARACTER_MAXIMUM_LENGTH AS maxLength,
          c.IS_NULLABLE AS isNullable,
          c.COLUMN_DEFAULT AS defaultValue,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS isPrimaryKey,
          CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS isForeignKey,
          CASE WHEN ic.name IS NOT NULL THEN 1 ELSE 0 END AS isIdentity,
          fk.REFERENCED_TABLE AS referencedTable,
          fk.REFERENCED_COLUMN AS referencedColumn
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
          SELECT ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            AND tc.TABLE_NAME = @tableName
            AND tc.TABLE_SCHEMA = @tableSchema
        ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
        LEFT JOIN (
          SELECT
            ku.COLUMN_NAME,
            rku.TABLE_NAME AS REFERENCED_TABLE,
            rku.COLUMN_NAME AS REFERENCED_COLUMN
          FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE rku
            ON rc.UNIQUE_CONSTRAINT_NAME = rku.CONSTRAINT_NAME
          WHERE ku.TABLE_NAME = @tableName
            AND ku.TABLE_SCHEMA = @tableSchema
        ) fk ON c.COLUMN_NAME = fk.COLUMN_NAME
        LEFT JOIN (
          SELECT ic2.name
          FROM sys.identity_columns ic2
          JOIN sys.tables t ON ic2.object_id = t.object_id
          JOIN sys.schemas s ON t.schema_id = s.schema_id
          WHERE t.name = @tableName AND s.name = @tableSchema
        ) ic ON c.COLUMN_NAME = ic.name
        WHERE c.TABLE_NAME = @tableName
          AND c.TABLE_SCHEMA = @tableSchema
        ORDER BY c.ORDINAL_POSITION
      `)

    await pool.close()

    return result.recordset as ColumnInfo[]
  })

  ipcMain.handle('db:generateDdl', async (_, database: string, tables: { tableSchema: string; tableName: string }[]) => {
    const pool = await getPool(database)
    const ddlParts: string[] = []

    for (const { tableSchema, tableName } of tables) {
      const colResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
        .input('tableSchema', sql.NVarChar, tableSchema)
        .query(`
          SELECT
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.NUMERIC_PRECISION,
            c.NUMERIC_SCALE,
            c.IS_NULLABLE,
            c.COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_NAME = @tableName
            AND c.TABLE_SCHEMA = @tableSchema
          ORDER BY c.ORDINAL_POSITION
        `)

      const pkResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
        .input('tableSchema', sql.NVarChar, tableSchema)
        .query(`
          SELECT ku.COLUMN_NAME, tc.CONSTRAINT_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            AND tc.TABLE_NAME = @tableName
            AND tc.TABLE_SCHEMA = @tableSchema
          ORDER BY ku.ORDINAL_POSITION
        `)

      const fkResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
        .input('tableSchema', sql.NVarChar, tableSchema)
        .query(`
          SELECT
            ku.COLUMN_NAME,
            rc.CONSTRAINT_NAME,
            rku.TABLE_NAME AS REFERENCED_TABLE,
            rku.TABLE_SCHEMA AS REFERENCED_SCHEMA,
            rku.COLUMN_NAME AS REFERENCED_COLUMN
          FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE rku
            ON rc.UNIQUE_CONSTRAINT_NAME = rku.CONSTRAINT_NAME
          WHERE ku.TABLE_NAME = @tableName
            AND ku.TABLE_SCHEMA = @tableSchema
        `)

      const identityResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
        .input('tableSchema', sql.NVarChar, tableSchema)
        .query(`
          SELECT c.name AS COLUMN_NAME, ic.seed_value, ic.increment_value
          FROM sys.identity_columns ic
          JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          JOIN sys.tables t ON c.object_id = t.object_id
          JOIN sys.schemas s ON t.schema_id = s.schema_id
          WHERE t.name = @tableName AND s.name = @tableSchema
        `)

      const columns = colResult.recordset
      const pkColumns = pkResult.recordset.map((r) => r.COLUMN_NAME as string)
      const pkConstraintName = pkResult.recordset[0]?.CONSTRAINT_NAME ?? `PK_${tableName}`
      const fkRows = fkResult.recordset
      const identityMap = new Map(
        identityResult.recordset.map((r) => [r.COLUMN_NAME as string, { seed: r.seed_value, increment: r.increment_value }])
      )

      const colDefs = columns.map((col) => {
        let typeDef = col.DATA_TYPE as string

        if (['char', 'varchar', 'nchar', 'nvarchar'].includes(typeDef)) {
          const len = col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH
          typeDef += `(${len})`
        } else if (['decimal', 'numeric'].includes(typeDef)) {
          typeDef += `(${col.NUMERIC_PRECISION}, ${col.NUMERIC_SCALE})`
        }

        const identity = identityMap.get(col.COLUMN_NAME as string)
        const identityDef = identity ? ` IDENTITY(${identity.seed},${identity.increment})` : ''
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'
        const defaultVal = !identity && col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : ''

        return `    [${col.COLUMN_NAME}] ${typeDef.toUpperCase()}${identityDef} ${nullable}${defaultVal}`
      })

      if (pkColumns.length > 0) {
        colDefs.push(
          `    CONSTRAINT [${pkConstraintName}] PRIMARY KEY (${pkColumns.map((c) => `[${c}]`).join(', ')})`
        )
      }

      for (const fk of fkRows) {
        colDefs.push(
          `    CONSTRAINT [${fk.CONSTRAINT_NAME}] FOREIGN KEY ([${fk.COLUMN_NAME}]) REFERENCES [${fk.REFERENCED_SCHEMA}].[${fk.REFERENCED_TABLE}] ([${fk.REFERENCED_COLUMN}])`
        )
      }

      const ddl = `CREATE TABLE [${tableSchema}].[${tableName}] (\n${colDefs.join(',\n')}\n);`
      ddlParts.push(ddl)
    }

    await pool.close()

    return ddlParts.join('\n\n')
  })

  ipcMain.handle('db:getTableCount', async (_, database: string, tableSchema: string, tableName: string) => {
    const pool = await getPool(database)
    const result = await pool
      .request()
      .query(`SELECT COUNT(*) AS total FROM [${database}].[${tableSchema}].[${tableName}]`)
    await pool.close()
    return result.recordset[0].total as number
  })

  ipcMain.handle('db:getTableData', async (_, database: string, tableSchema: string, tableName: string, limit: number, offset: number) => {
    const pool = await getPool(database)
    const result = await pool
      .request()
      .query(`
        SELECT * FROM [${database}].[${tableSchema}].[${tableName}]
        ORDER BY (SELECT NULL)
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `)
    await pool.close()
    return {
      columns: result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [],
      rows: result.recordset
    }
  })

  ipcMain.handle('db:generateInserts', async (_, database: string, tables: { tableSchema: string; tableName: string; rows: Record<string, unknown>[] }[]) => {
    if (tables.length === 0) return ''

    // ── Build FK dependency graph (only between selected tables) ────
    const pool = await getPool(database)
    const tableSet = new Set(tables.map((t) => `${t.tableSchema}.${t.tableName}`))
    const deps = new Map<string, Set<string>>()

    for (const { tableSchema, tableName } of tables) {
      const key = `${tableSchema}.${tableName}`
      deps.set(key, new Set())

      const fkResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
        .input('tableSchema', sql.NVarChar, tableSchema)
        .query(`
          SELECT DISTINCT rku.TABLE_SCHEMA AS REFERENCED_SCHEMA, rku.TABLE_NAME AS REFERENCED_TABLE
          FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE rku
            ON rc.UNIQUE_CONSTRAINT_NAME = rku.CONSTRAINT_NAME
          WHERE ku.TABLE_NAME = @tableName AND ku.TABLE_SCHEMA = @tableSchema
        `)

      for (const row of fkResult.recordset) {
        const refKey = `${row.REFERENCED_SCHEMA}.${row.REFERENCED_TABLE}`
        if (tableSet.has(refKey)) deps.get(key)!.add(refKey)
      }
    }

    await pool.close()

    // ── Topological sort (Kahn's algorithm) ─────────────────────────
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    for (const [key, depSet] of deps) {
      inDegree.set(key, depSet.size)
      for (const dep of depSet) {
        if (!adjacency.has(dep)) adjacency.set(dep, [])
        adjacency.get(dep)!.push(key)
      }
    }

    const queue = [...deps.keys()].filter((k) => (inDegree.get(k) ?? 0) === 0)
    const sorted: string[] = []

    while (queue.length > 0) {
      const current = queue.shift()!
      sorted.push(current)
      for (const dependent of adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 1) - 1
        inDegree.set(dependent, newDegree)
        if (newDegree === 0) queue.push(dependent)
      }
    }

    // ── Generate INSERT statements ───────────────────────────────────
    const tableMap = new Map(tables.map((t) => [`${t.tableSchema}.${t.tableName}`, t]))
    const sqlParts: string[] = []

    for (const key of sorted) {
      const table = tableMap.get(key)!
      if (table.rows.length === 0) continue

      const cols = Object.keys(table.rows[0])
      const colList = cols.map((c) => `[${c}]`).join(', ')

      const valueRows = table.rows.map((row) => {
        const vals = cols.map((col) => {
          const val = row[col]
          if (val === null || val === undefined) return 'NULL'
          if (typeof val === 'boolean') return val ? '1' : '0'
          if (typeof val === 'number') return String(val)
          if (val instanceof Date) return `'${val.toISOString().slice(0, 23).replace('T', ' ')}'`
          return `'${String(val).replace(/'/g, "''")}'`
        })
        return `  (${vals.join(', ')})`
      })

      sqlParts.push(
        `INSERT INTO [${table.tableSchema}].[${table.tableName}] (${colList})\nVALUES\n${valueRows.join(',\n')};`
      )
    }

    return sqlParts.join('\n\n')
  })

  ipcMain.handle('db:exportDdl', async (_, ddl: string, suggestedName: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export DDL',
      defaultPath: suggestedName,
      filters: [{ name: 'SQL Files', extensions: ['sql'] }]
    })

    if (canceled || !filePath) return { success: false }

    writeFileSync(filePath, ddl, 'utf-8')
    return { success: true, filePath }
  })
}
