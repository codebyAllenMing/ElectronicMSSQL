import TableOverview from '../table/TableOverview'
import SchemaDetail from '../table/SchemaDetail'
import ErrorBoundary from '../ErrorBoundary'
import type { AppView } from '../../app'

type Props = {
    view: AppView
    connected: boolean
    onViewChange: (view: AppView) => void
    getSelectedRows: (tableSchema: string, tableName: string) => Record<string, unknown>[]
    onSelectionChange: (
        database: string,
        tableSchema: string,
        tableName: string,
        rows: Record<string, unknown>[]
    ) => void
}

export default function MainContent({
    view,
    connected,
    onViewChange,
    getSelectedRows,
    onSelectionChange
}: Props): JSX.Element {
    if (!connected) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-600">
                <span className="w-4 h-4 rounded-full bg-red-500" />
                <p className="text-sm font-medium">No Connection</p>
            </div>
        )
    }

    if (view.type === 'empty') {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
                <p className="text-sm">Select a database from the sidebar</p>
            </div>
        )
    }

    if (view.type === 'table-overview') {
        return (
            <ErrorBoundary key={view.database}>
                <TableOverview
                    database={view.database}
                    onSelectTable={(tableSchema, tableName) =>
                        onViewChange({
                            type: 'schema-detail',
                            database: view.database,
                            tableSchema,
                            tableName
                        })
                    }
                />
            </ErrorBoundary>
        )
    }

    return (
        <ErrorBoundary key={`${view.database}.${view.tableSchema}.${view.tableName}`}>
            <SchemaDetail
                database={view.database}
                tableSchema={view.tableSchema}
                tableName={view.tableName}
                selectedRows={getSelectedRows(view.tableSchema, view.tableName)}
                onSelectionChange={(rows) =>
                    onSelectionChange(view.database, view.tableSchema, view.tableName, rows)
                }
                onBack={() => onViewChange({ type: 'empty' })}
            />
        </ErrorBoundary>
    )
}
