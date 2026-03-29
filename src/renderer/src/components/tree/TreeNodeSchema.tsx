import { useState } from 'react'
import TreeNode from './TreeNode'
import type { TableInfo } from '../../../../types/schema'
import type { AppView } from '../../app'

type Props = {
  schema: string
  tables: TableInfo[]
  database: string
  defaultExpanded?: boolean
  onViewChange: (view: AppView) => void
}

export default function TreeNodeSchema({ schema, tables, database, defaultExpanded = false, onViewChange }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <li>
      <div
        className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setExpanded((v) => !v)}
      >
        <button className="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0">
          {expanded ? '▾' : '▸'}
        </button>
        <span className="text-xs truncate text-gray-500 dark:text-gray-400">{schema}</span>
        <span className="ml-auto text-xs text-gray-300 dark:text-gray-600 shrink-0">{tables.length}</span>
      </div>

      {expanded && (
        <ul className="ml-4 border-l border-gray-200 dark:border-gray-700">
          {tables.map((table) => (
            <TreeNode
              key={table.tableName}
              label={table.tableName}
              onClick={() =>
                onViewChange({
                  type: 'schema-detail',
                  database,
                  tableSchema: table.tableSchema,
                  tableName: table.tableName
                })
              }
            />
          ))}
        </ul>
      )}
    </li>
  )
}
