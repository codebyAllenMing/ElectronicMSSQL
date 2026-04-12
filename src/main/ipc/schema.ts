import { ipcMain, dialog } from 'electron'
import { writeFileSync } from 'fs'
import sql from 'mssql'
import type { TableInfo, ColumnInfo } from '../../types/schema'
import { loadSettings } from './connection'
import { notifyConnectionError } from '../slack'

async function getPool(database: string): Promise<sql.ConnectionPool> {
    const settings = loadSettings()
    const { server, port, user, password, encrypt } = settings.connection

    // Decrypt password (stored as "enc:<base64>")
    let plainPassword = password
    if (password.startsWith('enc:')) {
        const { safeStorage } = await import('electron')
        try {
            plainPassword = safeStorage.decryptString(Buffer.from(password.slice(4), 'base64'))
        } catch {
            plainPassword = ''
        }
    }

    const pool = new sql.ConnectionPool({
        server,
        port,
        database,
        user,
        password: plainPassword,
        options: {
            encrypt: encrypt ?? false,
            trustServerCertificate: !(encrypt ?? false)
        }
    })
    return pool.connect()
}

const ALLOWED_OPERATORS = new Set(['=', '!=', '>=', '>', '<=', '<', 'LIKE', 'IN'])
const ALLOWED_LOGIC = new Set(['AND', 'OR'])

function sanitizeColumnName(col: string): string {
    // Remove any ] characters to prevent bracket escape injection
    return col.replace(/\]/g, '')
}

function buildWhereClause(
    filters:
        | { column: string; operator: string; value: string; values?: string[]; likeMode?: string; logic: string }[]
        | undefined,
    request: sql.Request
): string {
    if (!filters || filters.length === 0) return ''
    const parts = filters.map((f, i) => {
        if (!ALLOWED_OPERATORS.has(f.operator)) return null
        if (i > 0 && !ALLOWED_LOGIC.has(f.logic)) return null
        const col = sanitizeColumnName(f.column)
        let clause: string
        if (f.operator === 'IN' && f.values && f.values.length > 0) {
            const paramNames = f.values.map((v, j) => {
                const name = `filterVal${i}_${j}`
                request.input(name, sql.NVarChar, v)
                return `@${name}`
            })
            clause = `[${col}] IN (${paramNames.join(', ')})`
        } else if (f.operator === 'LIKE') {
            const mode = (f as { likeMode?: string }).likeMode ?? 'CONTAINS'
            const val =
                mode === 'STARTS' ? `${f.value}%` :
                mode === 'ENDS' ? `%${f.value}` :
                `%${f.value}%`
            request.input(`filterVal${i}`, sql.NVarChar, val)
            clause = `[${col}] LIKE @filterVal${i}`
        } else {
            request.input(`filterVal${i}`, sql.NVarChar, f.value)
            clause = `[${col}] ${f.operator} @filterVal${i}`
        }
        return i === 0 ? clause : `${f.logic} ${clause}`
    }).filter(Boolean)
    if (parts.length === 0) return ''
    return ` WHERE ${parts.join(' ')}`
}

function safeHandle(
    channel: string,
    handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>
): void {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await handler(event, ...args)
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            notifyConnectionError(channel, message)
            throw new Error(`Query failed: ${message}`)
        }
    })
}

export function registerSchemaHandlers(): void {
    safeHandle('db:getTables', async (_, database: string) => {
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

    safeHandle(
        'db:getColumns',
        async (_, database: string, tableSchema: string, tableName: string) => {
            const pool = await getPool(database)

            const result = await pool
                .request()
                .input('tableName', sql.NVarChar, tableName)
                .input('tableSchema', sql.NVarChar, tableSchema).query(`
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
        }
    )

    safeHandle(
        'db:generateDdl',
        async (_, database: string, tables: { tableSchema: string; tableName: string }[]) => {
            const pool = await getPool(database)

            // ── Resolve FK parent tables recursively ────────────────────────
            const allTables = new Map(
                tables.map((t) => [`${t.tableSchema}.${t.tableName}`, { ...t }])
            )
            const processed = new Set<string>()
            const toProcess = [...allTables.keys()]

            while (toProcess.length > 0) {
                const key = toProcess.shift()!
                if (processed.has(key)) continue
                processed.add(key)

                const table = allTables.get(key)!
                const fkResult = await pool.request()
                    .input('tableName', sql.NVarChar, table.tableName)
                    .input('tableSchema', sql.NVarChar, table.tableSchema).query(`
                    SELECT DISTINCT rku.TABLE_SCHEMA AS REFERENCED_SCHEMA, rku.TABLE_NAME AS REFERENCED_TABLE
                    FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                        ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE rku
                        ON rc.UNIQUE_CONSTRAINT_NAME = rku.CONSTRAINT_NAME
                    WHERE ku.TABLE_NAME = @tableName AND ku.TABLE_SCHEMA = @tableSchema
                        AND rku.TABLE_NAME <> @tableName
                `)

                for (const row of fkResult.recordset) {
                    const parentKey = `${row.REFERENCED_SCHEMA}.${row.REFERENCED_TABLE}`
                    if (!allTables.has(parentKey)) {
                        allTables.set(parentKey, {
                            tableSchema: row.REFERENCED_SCHEMA as string,
                            tableName: row.REFERENCED_TABLE as string
                        })
                    }
                    if (!processed.has(parentKey)) {
                        toProcess.push(parentKey)
                    }
                }
            }

            // ── Topological sort by FK dependency ───────────────────────────
            const tableSet = new Set(allTables.keys())
            const deps = new Map<string, Set<string>>()

            for (const [key, { tableSchema, tableName }] of allTables) {
                deps.set(key, new Set())

                const fkDepsResult = await pool
                    .request()
                    .input('tableName', sql.NVarChar, tableName)
                    .input('tableSchema', sql.NVarChar, tableSchema).query(`
          SELECT DISTINCT rku.TABLE_SCHEMA AS REFERENCED_SCHEMA, rku.TABLE_NAME AS REFERENCED_TABLE
          FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE rku
            ON rc.UNIQUE_CONSTRAINT_NAME = rku.CONSTRAINT_NAME
          WHERE ku.TABLE_NAME = @tableName AND ku.TABLE_SCHEMA = @tableSchema
            AND rku.TABLE_NAME <> @tableName
        `)

                for (const row of fkDepsResult.recordset) {
                    const refKey = `${row.REFERENCED_SCHEMA}.${row.REFERENCED_TABLE}`
                    if (tableSet.has(refKey)) deps.get(key)!.add(refKey)
                }
            }

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
            const sortedKeys: string[] = []

            while (queue.length > 0) {
                const current = queue.shift()!
                sortedKeys.push(current)
                for (const dependent of adjacency.get(current) ?? []) {
                    const newDegree = (inDegree.get(dependent) ?? 1) - 1
                    inDegree.set(dependent, newDegree)
                    if (newDegree === 0) queue.push(dependent)
                }
            }

            const sortedTables = sortedKeys.map((k) => allTables.get(k)!)

            // ── Generate DDL in sorted order ────────────────────────────────
            const ddlParts: string[] = []

            for (const { tableSchema, tableName } of sortedTables) {
                const colResult = await pool
                    .request()
                    .input('tableName', sql.NVarChar, tableName)
                    .input('tableSchema', sql.NVarChar, tableSchema).query(`
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
                    .input('tableSchema', sql.NVarChar, tableSchema).query(`
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
                    .input('tableSchema', sql.NVarChar, tableSchema).query(`
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
                    .input('tableSchema', sql.NVarChar, tableSchema).query(`
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
                    identityResult.recordset.map((r) => [
                        r.COLUMN_NAME as string,
                        { seed: r.seed_value, increment: r.increment_value }
                    ])
                )

                const colDefs = columns.map((col) => {
                    let typeDef = col.DATA_TYPE as string

                    if (['char', 'varchar', 'nchar', 'nvarchar'].includes(typeDef)) {
                        const len =
                            col.CHARACTER_MAXIMUM_LENGTH === -1
                                ? 'MAX'
                                : col.CHARACTER_MAXIMUM_LENGTH
                        typeDef += `(${len})`
                    } else if (['decimal', 'numeric'].includes(typeDef)) {
                        typeDef += `(${col.NUMERIC_PRECISION}, ${col.NUMERIC_SCALE})`
                    }

                    const identity = identityMap.get(col.COLUMN_NAME as string)
                    const identityDef = identity
                        ? ` IDENTITY(${identity.seed},${identity.increment})`
                        : ''
                    const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'
                    const defaultVal =
                        !identity && col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : ''

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
        }
    )

    safeHandle(
        'db:getTableCount',
        async (
            _,
            database: string,
            tableSchema: string,
            tableName: string,
            filters?: { column: string; operator: string; value: string; logic: string }[]
        ) => {
            const pool = await getPool(database)
            const request = pool.request()
            const where = buildWhereClause(filters, request)
            const result = await request.query(
                `SELECT COUNT(*) AS total FROM [${database}].[${tableSchema}].[${tableName}]${where}`
            )
            await pool.close()
            return result.recordset[0].total as number
        }
    )

    safeHandle(
        'db:getTableData',
        async (
            _,
            database: string,
            tableSchema: string,
            tableName: string,
            limit: number,
            offset: number,
            filters?: { column: string; operator: string; value: string; values?: string[]; likeMode?: string; logic: string }[],
            selectColumns?: string[]
        ) => {
            const pool = await getPool(database)
            const request = pool.request()
            const where = buildWhereClause(filters, request)
            const cols = selectColumns && selectColumns.length > 0
                ? selectColumns.map((c) => `[${sanitizeColumnName(c)}]`).join(', ')
                : '*'
            const orderBy = where ? 'ORDER BY 1' : 'ORDER BY (SELECT NULL)'
            const result = await request.query(`
        SELECT ${cols} FROM [${database}].[${tableSchema}].[${tableName}]${where}
        ${orderBy}
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `)
            await pool.close()
            return {
                columns: result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [],
                rows: result.recordset
            }
        }
    )

    safeHandle(
        'db:generateInserts',
        async (
            _,
            database: string,
            tables: { tableSchema: string; tableName: string; rows: Record<string, unknown>[] }[]
        ) => {
            if (tables.length === 0) return ''

            const pool = await getPool(database)

            // ── Resolve FK parent rows recursively ──────────────────────────
            const allTables = new Map(
                tables.map((t) => [`${t.tableSchema}.${t.tableName}`, { ...t }])
            )
            const processed = new Set<string>()
            const toProcess = [...allTables.keys()]

            while (toProcess.length > 0) {
                const key = toProcess.shift()!
                if (processed.has(key)) continue
                processed.add(key)

                const table = allTables.get(key)!
                if (table.rows.length === 0) continue

                // Find FK relationships for this table
                const fkResult = await pool.request()
                    .input('tableName', sql.NVarChar, table.tableName)
                    .input('tableSchema', sql.NVarChar, table.tableSchema).query(`
                    SELECT
                        ku.COLUMN_NAME,
                        rku.TABLE_SCHEMA AS REFERENCED_SCHEMA,
                        rku.TABLE_NAME AS REFERENCED_TABLE,
                        rku.COLUMN_NAME AS REFERENCED_COLUMN
                    FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                        ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE rku
                        ON rc.UNIQUE_CONSTRAINT_NAME = rku.CONSTRAINT_NAME
                    WHERE ku.TABLE_NAME = @tableName AND ku.TABLE_SCHEMA = @tableSchema
                `)

                for (const fk of fkResult.recordset) {
                    const parentKey = `${fk.REFERENCED_SCHEMA}.${fk.REFERENCED_TABLE}`
                    const childCol = fk.COLUMN_NAME as string
                    const parentCol = fk.REFERENCED_COLUMN as string

                    // Collect FK values from child rows (skip nulls)
                    const fkValues = [...new Set(
                        table.rows
                            .map((r) => r[childCol])
                            .filter((v) => v !== null && v !== undefined)
                            .map((v) => String(v))
                    )]
                    if (fkValues.length === 0) continue

                    // Query parent rows
                    const placeholders = fkValues.map((_, i) => `@fkVal${i}`).join(', ')
                    const req = pool.request()
                    fkValues.forEach((v, i) => req.input(`fkVal${i}`, sql.NVarChar, v))
                    const parentResult = await req.query(
                        `SELECT * FROM [${database}].[${fk.REFERENCED_SCHEMA}].[${fk.REFERENCED_TABLE}] WHERE [${parentCol}] IN (${placeholders})`
                    )

                    if (parentResult.recordset.length > 0) {
                        if (allTables.has(parentKey)) {
                            // Merge rows (deduplicate by PK value)
                            const existing = allTables.get(parentKey)!
                            const existingKeys = new Set(existing.rows.map((r) => String(r[parentCol])))
                            const newRows = parentResult.recordset.filter(
                                (r) => !existingKeys.has(String(r[parentCol]))
                            )
                            existing.rows = [...existing.rows, ...newRows]
                        } else {
                            allTables.set(parentKey, {
                                tableSchema: fk.REFERENCED_SCHEMA as string,
                                tableName: fk.REFERENCED_TABLE as string,
                                rows: parentResult.recordset
                            })
                        }
                        if (!processed.has(parentKey)) {
                            toProcess.push(parentKey)
                        }
                    }
                }
            }

            // ── Build FK dependency graph ────────────────────────────────────
            const tableSet = new Set(allTables.keys())
            const deps = new Map<string, Set<string>>()

            for (const [key, table] of allTables) {
                deps.set(key, new Set())
                const fkResult = await pool.request()
                    .input('tableName', sql.NVarChar, table.tableName)
                    .input('tableSchema', sql.NVarChar, table.tableSchema).query(`
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
                    if (tableSet.has(refKey) && refKey !== key) deps.get(key)!.add(refKey)
                }
            }

            // ── Topological sort ─────────────────────────────────────────────
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

            // ── Gather column metadata ───────────────────────────────────────
            const identityCols = new Map<string, Set<string>>()
            const guidCols = new Map<string, Set<string>>()
            const fkChildCols = new Map<string, Set<string>>()

            for (const [key, table] of allTables) {
                const identResult = await pool.request()
                    .input('tableName', sql.NVarChar, table.tableName)
                    .input('tableSchema', sql.NVarChar, table.tableSchema).query(`
                    SELECT c.name AS COLUMN_NAME
                    FROM sys.identity_columns ic
                    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                    JOIN sys.tables t ON c.object_id = t.object_id
                    JOIN sys.schemas s ON t.schema_id = s.schema_id
                    WHERE t.name = @tableName AND s.name = @tableSchema
                `)
                identityCols.set(key, new Set(identResult.recordset.map((r) => r.COLUMN_NAME as string)))

                const guidResult = await pool.request()
                    .input('tableName', sql.NVarChar, table.tableName)
                    .input('tableSchema', sql.NVarChar, table.tableSchema).query(`
                    SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = @tableName AND TABLE_SCHEMA = @tableSchema
                      AND DATA_TYPE = 'uniqueidentifier'
                `)
                guidCols.set(key, new Set(guidResult.recordset.map((r) => r.COLUMN_NAME as string)))

                // FK columns in this table (child side — should keep original value)
                const fkColResult = await pool.request()
                    .input('tableName', sql.NVarChar, table.tableName)
                    .input('tableSchema', sql.NVarChar, table.tableSchema).query(`
                    SELECT ku.COLUMN_NAME
                    FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                        ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    WHERE ku.TABLE_NAME = @tableName AND ku.TABLE_SCHEMA = @tableSchema
                `)
                fkChildCols.set(key, new Set(fkColResult.recordset.map((r) => r.COLUMN_NAME as string)))
            }

            // Build set of GUID columns referenced by other tables' FK
            const referencedGuidCols = new Map<string, Set<string>>()
            for (const [key, table] of allTables) {
                const refResult = await pool.request()
                    .input('tableName', sql.NVarChar, table.tableName)
                    .input('tableSchema', sql.NVarChar, table.tableSchema).query(`
                    SELECT DISTINCT rku.COLUMN_NAME
                    FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                        ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE rku
                        ON rc.UNIQUE_CONSTRAINT_NAME = rku.CONSTRAINT_NAME
                    WHERE rku.TABLE_NAME = @tableName AND rku.TABLE_SCHEMA = @tableSchema
                `)
                if (refResult.recordset.length > 0) {
                    referencedGuidCols.set(key, new Set(refResult.recordset.map((r) => r.COLUMN_NAME as string)))
                }
            }

            await pool.close()

            // ── Generate INSERT statements ───────────────────────────────────
            const sqlParts: string[] = []

            for (const key of sorted) {
                const table = allTables.get(key)!
                if (table.rows.length === 0) continue

                const allCols = Object.keys(table.rows[0])
                const identity = identityCols.get(key) ?? new Set()
                const guids = guidCols.get(key) ?? new Set()
                const referencedGuids = referencedGuidCols.get(key) ?? new Set()
                const fkCols = fkChildCols.get(key) ?? new Set()

                // Exclude IDENTITY columns
                const cols = allCols.filter((c) => !identity.has(c))
                if (cols.length === 0) continue

                const colList = cols.map((c) => `[${c}]`).join(', ')

                const valueRows = table.rows.map((row) => {
                    const vals = cols.map((col) => {
                        // GUID column that is NOT referenced by FK AND NOT a FK column itself → NEWID()
                        if (guids.has(col) && !referencedGuids.has(col) && !fkCols.has(col)) {
                            return 'NEWID()'
                        }
                        const val = row[col]
                        if (val === null || val === undefined) return 'NULL'
                        if (typeof val === 'boolean') return val ? '1' : '0'
                        if (typeof val === 'number') return String(val)
                        if (val instanceof Date)
                            return `'${val.toISOString().slice(0, 23).replace('T', ' ')}'`
                        return `'${String(val).replace(/'/g, "''")}'`
                    })
                    return `  (${vals.join(', ')})`
                })

                sqlParts.push(
                    `INSERT INTO [${table.tableSchema}].[${table.tableName}] (${colList})\nVALUES\n${valueRows.join(',\n')};`
                )
            }

            return sqlParts.join('\n\n')
        }
    )

    safeHandle('db:exportDdl', async (_, ddl: string, suggestedName: string) => {
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
