import { useState, useRef, useMemo, useEffect } from 'react'
import { useLoading } from '../../hooks/use-loading'
import type { TableInfo } from '../../../../types/schema'
import Checkbox from '../ui/Checkbox'
import Button from '../ui/Button'

type Props = {
    database: string
    onSelectTable: (tableSchema: string, tableName: string) => void
}

export default function TableOverview({ database, onSelectTable }: Props): JSX.Element {
    const { withLoading } = useLoading()
    const [tables, setTables] = useState<TableInfo[]>([])
    const [error, setError] = useState<string | null>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [exporting, setExporting] = useState(false)
    const [schemaFilter, setSchemaFilter] = useState<Set<string> | null>(null) // null = all
    const [showSchemaDropdown, setShowSchemaDropdown] = useState(false)
    const schemaDropdownRef = useRef<HTMLDivElement>(null)

    const schemas = useMemo(
        () => Array.from(new Set(tables.map((t) => t.tableSchema))).sort(),
        [tables]
    )

    const filteredTables = useMemo(
        () =>
            schemaFilter === null ? tables : tables.filter((t) => schemaFilter.has(t.tableSchema)),
        [tables, schemaFilter]
    )

    // Clear selection when filter changes
    useEffect(() => {
        setSelected(new Set())
    }, [schemaFilter])

    // Fetch tables when database changes
    useEffect(() => {
        setError(null)
        setTables([])
        withLoading(() =>
            window.api
                .getTables(database)
                .then(setTables)
                .catch((err) =>
                    setError(err instanceof Error ? err.message : 'Failed to load tables')
                )
        )
    }, [database])

    // Reset filter when database changes
    useEffect(() => {
        setSchemaFilter(null)
    }, [database])

    // Close dropdown on outside click
    useEffect(() => {
        if (!showSchemaDropdown) return
        const handler = (e: MouseEvent): void => {
            if (
                schemaDropdownRef.current &&
                !schemaDropdownRef.current.contains(e.target as Node)
            ) {
                setShowSchemaDropdown(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showSchemaDropdown])

    const allSchemasSelected = schemaFilter === null
    const someSchemaSelected = schemaFilter !== null && schemaFilter.size > 0

    const toggleAllSchemas = (): void => {
        setSchemaFilter(null)
    }

    const toggleSchema = (schema: string): void => {
        setSchemaFilter((prev) => {
            const current = new Set(prev ?? schemas)
            if (current.has(schema)) {
                current.delete(schema)
            } else {
                current.add(schema)
            }
            return current.size === schemas.length ? null : current
        })
    }

    const tableKey = (t: { tableSchema: string; tableName: string }): string =>
        `${t.tableSchema}.${t.tableName}`

    const allChecked = selected.size === filteredTables.length && filteredTables.length > 0
    const someChecked = selected.size > 0 && selected.size < filteredTables.length

    const toggleAll = (checked: boolean): void => {
        setSelected(checked ? new Set(filteredTables.map(tableKey)) : new Set())
    }

    const toggleOne = (tableSchema: string, tableName: string, checked: boolean): void => {
        const key = tableKey({ tableSchema, tableName })
        setSelected((prev) => {
            const next = new Set(prev)
            checked ? next.add(key) : next.delete(key)
            return next
        })
    }

    const handleExport = async (): Promise<void> => {
        if (selected.size === 0) return
        setExporting(true)
        try {
            const selectedTables = filteredTables.filter((t) => selected.has(tableKey(t)))
            const ddl = await window.api.generateDdl(
                database,
                selectedTables.map((t) => ({ tableSchema: t.tableSchema, tableName: t.tableName }))
            )
            const suggestedName =
                selectedTables.length === 1
                    ? `${selectedTables[0].tableName}.sql`
                    : `${database}_schema.sql`
            await window.api.exportDdl(ddl, suggestedName)
        } finally {
            setExporting(false)
        }
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center text-sm text-red-500">
                {error}
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {database}
                </h2>
                <span className="text-xs text-gray-400">
                    {filteredTables.length === tables.length
                        ? `${tables.length} tables`
                        : `${filteredTables.length} / ${tables.length} tables`}
                </span>

                {/* Schema filter — only show when multiple schemas exist */}
                {schemas.length > 1 && (
                    <div className="relative" ref={schemaDropdownRef}>
                        <button
                            onClick={() => setShowSchemaDropdown((v) => !v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
                                allSchemasSelected
                                    ? 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                                    : 'border-blue-400 dark:border-blue-500 text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950'
                            }`}
                        >
                            <span>
                                {allSchemasSelected
                                    ? 'All schemas'
                                    : someSchemaSelected
                                      ? `${schemaFilter!.size} / ${schemas.length} schemas`
                                      : 'No schemas'}
                            </span>
                            <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>

                        {showSchemaDropdown && (
                            <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
                                {/* All schemas row */}
                                <label className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <Checkbox
                                        checked={allSchemasSelected}
                                        indeterminate={false}
                                        onChange={toggleAllSchemas}
                                    />
                                    <span className="text-xs text-gray-700 dark:text-gray-300">
                                        All schemas
                                    </span>
                                </label>
                                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                {schemas.map((schema) => (
                                    <label
                                        key={schema}
                                        className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        <Checkbox
                                            checked={
                                                schemaFilter === null || schemaFilter.has(schema)
                                            }
                                            indeterminate={false}
                                            onChange={() => toggleSchema(schema)}
                                        />
                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                            {schema}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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

            {/* Table list */}
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
                            <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                                Table
                            </th>
                            {schemas.length > 1 && (
                                <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                                    Schema
                                </th>
                            )}
                            <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                                Columns
                            </th>
                            <th className="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                                Rows
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTables.map((table) => (
                            <tr
                                key={tableKey(table)}
                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                                onClick={() => onSelectTable(table.tableSchema, table.tableName)}
                            >
                                <td className="w-10 px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={selected.has(tableKey(table))}
                                        onChange={(checked) =>
                                            toggleOne(table.tableSchema, table.tableName, checked)
                                        }
                                    />
                                </td>
                                <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                                    {table.tableName}
                                </td>
                                {schemas.length > 1 && (
                                    <td className="px-4 py-2 text-gray-400 dark:text-gray-500 text-xs">
                                        {table.tableSchema}
                                    </td>
                                )}
                                <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                                    {table.columnCount}
                                </td>
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
