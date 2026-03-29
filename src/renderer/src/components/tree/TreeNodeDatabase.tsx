import { useState, useMemo } from 'react'
import { useTables } from '../../hooks/use-database'
import TreeNodeSchema from './TreeNodeSchema'
import type { AppView } from '../../app'

type Props = {
    database: string
    onViewChange: (view: AppView) => void
}

export default function TreeNodeDatabase({ database, onViewChange }: Props): JSX.Element {
    const [expanded, setExpanded] = useState(false)
    const { tables, loading } = useTables(expanded ? database : null)

    const schemaGroups = useMemo(() => {
        const map = new Map<string, typeof tables>()
        for (const table of tables) {
            const group = map.get(table.tableSchema) ?? []
            group.push(table)
            map.set(table.tableSchema, group)
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    }, [tables])

    const handleDatabaseClick = (): void => {
        setExpanded(true)
        onViewChange({ type: 'table-overview', database })
    }

    const handleToggle = (e: React.MouseEvent): void => {
        e.stopPropagation()
        setExpanded((prev) => !prev)
    }

    return (
        <li>
            <div
                className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={handleDatabaseClick}
            >
                <button
                    className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                    onClick={handleToggle}
                >
                    {expanded ? '▾' : '▸'}
                </button>
                <span className="text-sm truncate text-gray-700 dark:text-gray-300">
                    {database}
                </span>
            </div>

            {expanded && (
                <ul className="ml-4 border-l border-gray-200 dark:border-gray-700">
                    {loading && <li className="px-3 py-1 text-xs text-gray-400">Loading...</li>}
                    {schemaGroups.map(([schema, schemaTables]) => (
                        <TreeNodeSchema
                            key={schema}
                            schema={schema}
                            tables={schemaTables}
                            database={database}
                            defaultExpanded={schemaGroups.length === 1}
                            onViewChange={onViewChange}
                        />
                    ))}
                </ul>
            )}
        </li>
    )
}
