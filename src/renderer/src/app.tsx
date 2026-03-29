import { useState, useMemo } from 'react'
import { useTheme } from './hooks/use-theme'
import Sidebar from './components/layout/Sidebar'
import MainContent from './components/layout/MainContent'
import ThemeToggle from './components/ui/ThemeToggle'
import Button from './components/ui/Button'

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
        // Clear selections when switching to a different database
        if (newView.type !== 'empty' && currentDatabase && newView.database !== currentDatabase) {
            setDataSelections(new Map())
        }
        setView(newView)
    }

    const handleExportData = async (): Promise<void> => {
        if (dataSelections.size === 0) return
        setExportingData(true)
        try {
            const firstEntry = dataSelections.values().next().value as DataSelection
            const tables = Array.from(dataSelections.values()).map((s) => ({
                tableSchema: s.tableSchema,
                tableName: s.tableName,
                rows: s.rows
            }))
            const sql = await window.api.generateInserts(firstEntry.database, tables)
            const suggestedName = `${firstEntry.database}_data.sql`
            await window.api.exportDdl(sql, suggestedName)
        } finally {
            setExportingData(false)
        }
    }

    return (
        <div className={theme === 'dark' ? 'dark' : ''}>
            <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
                <Sidebar onViewChange={handleViewChange} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
                        <div>
                            {totalSelectedRows > 0 && (
                                <Button
                                    variant="primary"
                                    onClick={handleExportData}
                                    disabled={exportingData}
                                >
                                    {exportingData
                                        ? 'Exporting...'
                                        : `Export Data (${totalSelectedRows} rows)`}
                                </Button>
                            )}
                        </div>
                        <ThemeToggle theme={theme} onToggle={toggleTheme} />
                    </div>
                    <MainContent
                        view={view}
                        onViewChange={handleViewChange}
                        getSelectedRows={getSelectedRows}
                        onSelectionChange={handleSelectionChange}
                    />
                </div>
            </div>
        </div>
    )
}
