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

  return sql.connect({
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
}

export function registerSchemaHandlers(): void {
  ipcMain.handle('db:getTables', async (_, database: string) => {
    const pool = await getPool(database)

    const result = await pool.request().input('db', sql.NVarChar, database).query(`
      SELECT
        t.TABLE_NAME AS tableName,
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA
            AND c.TABLE_NAME = t.TABLE_NAME
        ) AS columnCount,
        (
          SELECT SUM(p.rows)
          FROM sys.tables st
          JOIN sys.partitions p ON st.object_id = p.object_id
          WHERE st.name = t.TABLE_NAME
            AND p.index_id IN (0, 1)
        ) AS rowCount
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_NAME
    `)

    await pool.close()

    return result.recordset as TableInfo[]
  })

  ipcMain.handle('db:getColumns', async (_, database: string, tableName: string) => {
    const pool = await getPool(database)

    const result = await pool
      .request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT
          c.COLUMN_NAME AS columnName,
          c.DATA_TYPE AS dataType,
          c.CHARACTER_MAXIMUM_LENGTH AS maxLength,
          c.IS_NULLABLE AS isNullable,
          c.COLUMN_DEFAULT AS defaultValue,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS isPrimaryKey,
          CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS isForeignKey,
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
        ) fk ON c.COLUMN_NAME = fk.COLUMN_NAME
        WHERE c.TABLE_NAME = @tableName
        ORDER BY c.ORDINAL_POSITION
      `)

    await pool.close()

    return result.recordset as ColumnInfo[]
  })

  ipcMain.handle('db:generateDdl', async (_, database: string, tableNames: string[]) => {
    const pool = await getPool(database)
    const ddlParts: string[] = []

    for (const tableName of tableNames) {
      const colResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
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
          ORDER BY c.ORDINAL_POSITION
        `)

      const pkResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
        .query(`
          SELECT ku.COLUMN_NAME, tc.CONSTRAINT_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            AND tc.TABLE_NAME = @tableName
          ORDER BY ku.ORDINAL_POSITION
        `)

      const fkResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
        .query(`
          SELECT
            ku.COLUMN_NAME,
            rc.CONSTRAINT_NAME,
            rku.TABLE_NAME AS REFERENCED_TABLE,
            rku.COLUMN_NAME AS REFERENCED_COLUMN
          FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE rku
            ON rc.UNIQUE_CONSTRAINT_NAME = rku.CONSTRAINT_NAME
          WHERE ku.TABLE_NAME = @tableName
        `)

      const columns = colResult.recordset
      const pkColumns = pkResult.recordset.map((r) => r.COLUMN_NAME as string)
      const pkConstraintName = pkResult.recordset[0]?.CONSTRAINT_NAME ?? `PK_${tableName}`
      const fkRows = fkResult.recordset

      const colDefs = columns.map((col) => {
        let typeDef = col.DATA_TYPE as string

        if (['char', 'varchar', 'nchar', 'nvarchar'].includes(typeDef)) {
          const len = col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH
          typeDef += `(${len})`
        } else if (['decimal', 'numeric'].includes(typeDef)) {
          typeDef += `(${col.NUMERIC_PRECISION}, ${col.NUMERIC_SCALE})`
        }

        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'
        const defaultVal = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : ''

        return `    [${col.COLUMN_NAME}] ${typeDef.toUpperCase()} ${nullable}${defaultVal}`
      })

      if (pkColumns.length > 0) {
        colDefs.push(
          `    CONSTRAINT [${pkConstraintName}] PRIMARY KEY (${pkColumns.map((c) => `[${c}]`).join(', ')})`
        )
      }

      for (const fk of fkRows) {
        colDefs.push(
          `    CONSTRAINT [${fk.CONSTRAINT_NAME}] FOREIGN KEY ([${fk.COLUMN_NAME}]) REFERENCES [${fk.REFERENCED_TABLE}] ([${fk.REFERENCED_COLUMN}])`
        )
      }

      const ddl = `CREATE TABLE [${tableName}] (\n${colDefs.join(',\n')}\n);`
      ddlParts.push(ddl)
    }

    await pool.close()

    return ddlParts.join('\n\n')
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
