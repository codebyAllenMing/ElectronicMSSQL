import { useState } from 'react'
import { useColumns } from '../../hooks/use-database'
import DdlBlock from '../export/DdlBlock'
import Button from '../ui/Button'
import TableData from './TableData'

type Tab = 'schema' | 'data'

type Props = {
  database: string
  tableSchema: string
  tableName: string
  selectedRows: Record<string, unknown>[]
  onSelectionChange: (rows: Record<string, unknown>[]) => void
  onBack: () => void
}

export default function SchemaDetail({ database, tableSchema, tableName, selectedRows, onSelectionChange, onBack }: Props): JSX.Element {
  const { columns, loading, error } = useColumns(database, tableSchema, tableName)
  const [tab, setTab] = useState<Tab>('data')
  const [ddl, setDdl] = useState<string | null>(null)
  const [loadingDdl, setLoadingDdl] = useState(false)

  const handleShowDdl = async (): Promise<void> => {
    setLoadingDdl(true)
    try {
      const result = await window.api.generateDdl(database, [{ tableSchema, tableName }])
      setDdl(result)
    } finally {
      setLoadingDdl(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    const source = ddl ?? (await window.api.generateDdl(database, [{ tableSchema, tableName }]))
    await window.api.exportDdl(source, `${tableName}.sql`)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={onBack}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ← Back
        </button>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{tableName}</h2>
        <span className="text-xs text-gray-400">{database}</span>
        {selectedRows.length > 0 && (
          <span className="text-xs text-blue-500">{selectedRows.length} rows selected for export</span>
        )}
        <div className="ml-auto flex gap-2">
          {tab === 'schema' && (
            <>
              <Button onClick={handleShowDdl} disabled={loadingDdl}>
                {loadingDdl ? 'Loading...' : ddl ? 'Refresh DDL' : 'Show DDL'}
              </Button>
              <Button variant="primary" onClick={handleExport}>
                Export DDL
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 px-4">
        {(['schema', 'data'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === 'schema' && (
          <>
            {loading && <p className="px-4 py-4 text-sm text-gray-400">Loading columns...</p>}
            {error && <p className="px-4 py-4 text-sm text-red-500">{error}</p>}
            {!loading && !error && (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Column</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Nullable</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Default</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">PK</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">FK</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <tr key={col.columnName} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-2 text-gray-800 dark:text-gray-200 font-medium">{col.columnName}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 uppercase">
                        {col.dataType}
                        {col.maxLength ? `(${col.maxLength === -1 ? 'MAX' : col.maxLength})` : ''}
                      </td>
                      <td className="px-4 py-2">
                        {col.isNullable === 'YES' ? (
                          <span className="text-yellow-500">YES</span>
                        ) : (
                          <span className="text-gray-400">NO</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">
                        {col.defaultValue ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        {col.isPrimaryKey && (
                          <span className="text-xs font-semibold text-blue-500">PK</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                        {col.isForeignKey && col.referencedTable
                          ? `→ ${col.referencedTable}.${col.referencedColumn}`
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ddl && (
              <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
                <DdlBlock ddl={ddl} />
              </div>
            )}
          </>
        )}

        {tab === 'data' && (
          <TableData
            database={database}
            tableSchema={tableSchema}
            tableName={tableName}
            selectedRows={selectedRows}
            onSelectionChange={onSelectionChange}
          />
        )}
      </div>
    </div>
  )
}
