import { useState, useMemo } from 'react'
import { useTheme } from './hooks/use-theme'
import { LoadingContext, useLoadingReducer } from './hooks/use-loading'
import { useDatabases } from './hooks/use-database'
import Sidebar from './components/layout/Sidebar'
import MainContent from './components/layout/MainContent'
import ThemeToggle from './components/ui/ThemeToggle'
import Button from './components/ui/Button'
import LoadingOverlay from './components/ui/LoadingOverlay'
import UpdateBanner from './components/ui/UpdateBanner'

export type AppView =
    | { type: 'empty' }
    | { type: 'table-overview'; database: string }
    | { type: 'schema-detail'; database: string; tableSchema: string; tableName: string }

type DataSelection = {
    database: string
    tableSchema: string
    tableName: string
    rows: Record<string, unknown>[]
}

export default function App(): JSX.Element {
    const { theme, toggleTheme } = useTheme()
    const loadingCtx = useLoadingReducer()
    const { databases, connectionInfo, loading: dbLoading, error: dbError, disconnected, reload, disconnect } = useDatabases()
    const connected = !dbLoading && !dbError && !disconnected
    const [view, setView] = useState<AppView>({ type: 'empty' })
    const [dataSelections, setDataSelections] = useState<Map<string, DataSelection>>(new Map())
    const [exportingData, setExportingData] = useState(false)

    const totalSelectedRows = useMemo(
        () => Array.from(dataSelections.values()).reduce((sum, s) => sum + s.rows.length, 0),
        [dataSelections]
    )

    const currentDatabase = view.type !== 'empty' ? view.database : null

    const getSelectedRows = (tableSchema: string, tableName: string): Record<string, unknown>[] => {
        const key = `${tableSchema}.${tableName}`
        return dataSelections.get(key)?.rows ?? []
    }

    const handleSelectionChange = (
        database: string,
        tableSchema: string,
        tableName: string,
        rows: Record<string, unknown>[]
    ): void => {
        const key = `${tableSchema}.${tableName}`
        setDataSelections((prev) => {
            const next = new Map(prev)
            if (rows.length === 0) {
                next.delete(key)
            } else {
                next.set(key, { database, tableSchema, tableName, rows })
            }
            return next
        })
    }

    const handleViewChange = (newView: AppView): void => {
        setDataSelections(new Map())
        setView(newView)
    }

    const getInsertSql = async (): Promise<{ sql: string; database: string }> => {
        const firstEntry = dataSelections.values().next().value as DataSelection
        const tables = Array.from(dataSelections.values()).map((s) => ({
            tableSchema: s.tableSchema,
            tableName: s.tableName,
            rows: s.rows
        }))
        const sql = await window.api.generateInserts(firstEntry.database, tables)
        return { sql, database: firstEntry.database }
    }

    const handleExportData = async (): Promise<void> => {
        if (dataSelections.size === 0) return
        setExportingData(true)
        try {
            const { sql, database } = await getInsertSql()
            const suggestedName = `${database}_data.sql`
            await window.api.exportDdl(sql, suggestedName)
        } finally {
            setExportingData(false)
        }
    }

    const handlePreviewData = async (): Promise<void> => {
        if (dataSelections.size === 0) return
        const { sql, database } = await getInsertSql()
        await window.api.openChildWindow('sql-preview', sql, {
            title: `${database} — INSERT Preview`
        })
    }

    return (
        <LoadingContext.Provider value={loadingCtx}>
            <div className={theme === 'dark' ? 'dark' : ''}>
                <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
                    <Sidebar
                        databases={databases}
                        connectionInfo={connectionInfo}
                        loading={dbLoading}
                        error={dbError}
                        connected={connected}
                        reload={reload}
                        disconnect={disconnect}
                        onViewChange={handleViewChange}
                    />
                    <div className="relative flex-1 flex flex-col overflow-hidden">
                        <UpdateBanner />
                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-2">
                                {totalSelectedRows > 0 && connected && (
                                    <>
                                        <Button
                                            variant="primary"
                                            onClick={handleExportData}
                                            disabled={exportingData}
                                        >
                                            {exportingData
                                                ? 'Exporting...'
                                                : `Export Data (${totalSelectedRows} rows)`}
                                        </Button>
                                        <Button onClick={handlePreviewData}>
                                            Preview
                                        </Button>
                                    </>
                                )}
                            </div>
                            <ThemeToggle theme={theme} onToggle={toggleTheme} />
                        </div>
                        <MainContent
                            view={view}
                            connected={connected}
                            onViewChange={handleViewChange}
                            getSelectedRows={getSelectedRows}
                            onSelectionChange={handleSelectionChange}
                        />
                        <LoadingOverlay />
                    </div>
                </div>
            </div>
        </LoadingContext.Provider>
    )
}
