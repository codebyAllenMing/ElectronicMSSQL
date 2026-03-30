import { useState, useEffect } from 'react'
import type { TableInfo, ColumnInfo, ConnectionInfo } from '../../../types/schema'

declare global {
    interface Window {
        api: {
            getConnectionInfo: () => Promise<ConnectionInfo>
            getConnectionSettings: () => Promise<{
                server: string
                port: number
                database: string
                user: string
                passwordSet: boolean
            }>
            testConnection: (connection: {
                server: string
                port: number
                database: string
                user: string
                password: string
            }) => Promise<{ success: boolean; error?: string }>
            saveConnectionSettings: (connection: {
                server: string
                port: number
                database: string
                user: string
                password: string
            }) => Promise<{ success: boolean; error?: string }>
            getDatabases: () => Promise<string[]>
            getTables: (database: string) => Promise<TableInfo[]>
            getColumns: (
                database: string,
                tableSchema: string,
                tableName: string
            ) => Promise<ColumnInfo[]>
            getTableCount: (
                database: string,
                tableSchema: string,
                tableName: string
            ) => Promise<number>
            getTableData: (
                database: string,
                tableSchema: string,
                tableName: string,
                limit: number,
                offset: number
            ) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
            generateDdl: (
                database: string,
                tables: { tableSchema: string; tableName: string }[]
            ) => Promise<string>
            generateInserts: (
                database: string,
                tables: {
                    tableSchema: string
                    tableName: string
                    rows: Record<string, unknown>[]
                }[]
            ) => Promise<string>
            exportDdl: (
                ddl: string,
                suggestedName: string
            ) => Promise<{ success: boolean; filePath?: string }>
            onUpdateAvailable: (cb: (version: string) => void) => void
            onUpdateProgress: (cb: (percent: number) => void) => void
            onUpdateDownloaded: (cb: () => void) => void
            onUpdateError: (cb: (message: string) => void) => void
            installUpdate: () => Promise<void>
        }
    }
}

export function useDatabases(): {
    databases: string[]
    connectionInfo: ConnectionInfo | null
    loading: boolean
    error: string | null
    reload: () => void
} {
    const [databases, setDatabases] = useState<string[]>([])
    const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [tick, setTick] = useState(0)

    useEffect(() => {
        setLoading(true)
        setError(null)

        async function load(): Promise<void> {
            try {
                const [dbs, info] = await Promise.all([
                    window.api.getDatabases(),
                    window.api.getConnectionInfo()
                ])
                setDatabases(dbs)
                setConnectionInfo(info)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to connect')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [tick])

    const reload = (): void => setTick((t) => t + 1)

    return { databases, connectionInfo, loading, error, reload }
}

export function useTables(database: string | null): {
    tables: TableInfo[]
    loading: boolean
    error: string | null
} {
    const [tables, setTables] = useState<TableInfo[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!database) return

        setLoading(true)
        setError(null)

        window.api
            .getTables(database)
            .then(setTables)
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tables'))
            .finally(() => setLoading(false))
    }, [database])

    return { tables, loading, error }
}

export function useColumns(
    database: string | null,
    tableSchema: string | null,
    tableName: string | null
): {
    columns: ColumnInfo[]
    loading: boolean
    error: string | null
} {
    const [columns, setColumns] = useState<ColumnInfo[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!database || !tableSchema || !tableName) return

        setLoading(true)
        setError(null)

        window.api
            .getColumns(database, tableSchema, tableName)
            .then(setColumns)
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load columns'))
            .finally(() => setLoading(false))
    }, [database, tableSchema, tableName])

    return { columns, loading, error }
}
