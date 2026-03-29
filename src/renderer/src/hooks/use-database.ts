import { useState, useEffect } from 'react'
import type { TableInfo, ColumnInfo, ConnectionInfo } from '../../../types/schema'

declare global {
  interface Window {
    api: {
      getConnectionInfo: () => Promise<ConnectionInfo>
      getDatabases: () => Promise<string[]>
      getTables: (database: string) => Promise<TableInfo[]>
      getColumns: (database: string, tableSchema: string, tableName: string) => Promise<ColumnInfo[]>
      getTableCount: (database: string, tableSchema: string, tableName: string) => Promise<number>
      getTableData: (database: string, tableSchema: string, tableName: string, limit: number, offset: number) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
      generateDdl: (database: string, tables: { tableSchema: string; tableName: string }[]) => Promise<string>
      exportDdl: (ddl: string, suggestedName: string) => Promise<{ success: boolean; filePath?: string }>
    }
  }
}

export function useDatabases(): {
  databases: string[]
  connectionInfo: ConnectionInfo | null
  loading: boolean
  error: string | null
} {
  const [databases, setDatabases] = useState<string[]>([])
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
  }, [])

  return { databases, connectionInfo, loading, error }
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

export function useColumns(database: string | null, tableSchema: string | null, tableName: string | null): {
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
