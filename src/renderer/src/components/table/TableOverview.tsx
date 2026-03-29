import { useState } from 'react'
import { useTables } from '../../hooks/use-database'
import Checkbox from '../ui/Checkbox'
import Button from '../ui/Button'

type Props = {
  database: string
  onSelectTable: (tableSchema: string, tableName: string) => void
}

export default function TableOverview({ database, onSelectTable }: Props): JSX.Element {
  const { tables, loading, error } = useTables(database)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const allChecked = selected.size === tables.length && tables.length > 0
  const someChecked = selected.size > 0 && selected.size < tables.length

  const toggleAll = (checked: boolean): void => {
    setSelected(checked ? new Set(tables.map((t) => t.tableName)) : new Set())
  }

  const toggleOne = (tableName: string, checked: boolean): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      checked ? next.add(tableName) : next.delete(tableName)
      return next
    })
  }

  const handleExport = async (): Promise<void> => {
    if (selected.size === 0) return
    setExporting(true)
    try {
      const ddl = await window.api.generateDdl(database, Array.from(selected))
      const suggestedName = selected.size === 1
        ? `${Array.from(selected)[0]}.sql`
        : `${database}_schema.sql`
      await window.api.exportDdl(ddl, suggestedName)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        Loading tables...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-red-500">{error}</div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{database}</h2>
        <span className="text-xs text-gray-400">{tables.length} tables</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">{selected.size} selected</span>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={selected.size === 0 || exporting}
          >
            {exporting ? 'Exporting...' : 'Export DDL'}
          </Button>
        </div>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="w-10 px-4 py-2 text-left">
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Table</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Columns</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Rows</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => (
              <tr
                key={table.tableName}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                onClick={() => onSelectTable(table.tableSchema, table.tableName)}
              >
                <td className="w-10 px-4 py-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(table.tableName)}
                    onChange={(checked) => toggleOne(table.tableName, checked)}
                  />
                </td>
                <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{table.tableName}</td>
                <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{table.columnCount}</td>
                <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                  {table.rowCount?.toLocaleString() ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
