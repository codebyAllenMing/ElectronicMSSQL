import { useState } from 'react'
import { useTables } from '../../hooks/use-database'
import TreeNode from './TreeNode'
import type { AppView } from '../../app'

type Props = {
  database: string
  onViewChange: (view: AppView) => void
}

export default function TreeNodeDatabase({ database, onViewChange }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { tables, loading } = useTables(expanded ? database : null)

  const handleToggle = (): void => {
    setExpanded((prev) => !prev)
    if (!expanded) {
      onViewChange({ type: 'empty' })
    }
  }

  const handleDatabaseClick = (): void => {
    if (!expanded) {
      setExpanded(true)
    }
    if (tables.length > 0) {
      onViewChange({ type: 'table-overview', database, tables })
    }
  }

  return (
    <li>
      <div
        className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 group"
        onClick={handleDatabaseClick}
      >
        <button
          className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            handleToggle()
          }}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <span className="text-sm truncate text-gray-700 dark:text-gray-300">{database}</span>
      </div>

      {expanded && (
        <ul className="ml-4 border-l border-gray-200 dark:border-gray-700">
          {loading && (
            <li className="px-3 py-1 text-xs text-gray-400">Loading...</li>
          )}
          {tables.map((table) => (
            <TreeNode
              key={table.tableName}
              label={table.tableName}
              onClick={() =>
                onViewChange({
                  type: 'schema-detail',
                  database,
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
