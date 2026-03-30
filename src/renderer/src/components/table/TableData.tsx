import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useLoading } from '../../hooks/use-loading'
import SearchBar from '../search/search-bar'
import type { SearchFilter } from '../search/search-row'

type Props = {
    database: string
    tableSchema: string
    tableName: string
    selectedRows: Record<string, unknown>[]
    onSelectionChange: (rows: Record<string, unknown>[]) => void
}

const LIMIT_OPTIONS = [100, 500, 1000] as const
type LimitOption = (typeof LIMIT_OPTIONS)[number]

const DEFAULT_COL_WIDTH = 160

export default function TableData({
    database,
    tableSchema,
    tableName,
    selectedRows,
    onSelectionChange
}: Props): JSX.Element {
    const [limit, setLimit] = useState<LimitOption>(100)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState<number | null>(null)
    const [allColumns, setAllColumns] = useState<string[]>([])
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
    const [colTick, setColTick] = useState(0)
    const [columns, setColumns] = useState<string[]>([])
    const [colOrder, setColOrder] = useState<string[]>([])
    const [colWidths, setColWidths] = useState<Record<string, number>>({})
    const [rows, setRows] = useState<Record<string, unknown>[]>([])
    const [error, setError] = useState<string | null>(null)
    const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([])
    const { withLoading } = useLoading()

    const visibleColumns = useMemo(
        () => allColumns.filter((c) => !hiddenColumns.has(c)),
        [allColumns, hiddenColumns]
    )

    // resize state
    const resizing = useRef<{ col: string; startX: number; startWidth: number } | null>(null)

    // drag-reorder state
    const dragCol = useRef<string | null>(null)

    const totalPages = total !== null ? Math.max(1, Math.ceil(total / limit)) : null
    const [copied, setCopied] = useState<string | null>(null)

    // ── Row selection for data export ────────────────────────────────
    const selectedKeys = useMemo(
        () => new Set(selectedRows.map((r) => JSON.stringify(r))),
        [selectedRows]
    )

    const toggleRow = (row: Record<string, unknown>): void => {
        const key = JSON.stringify(row)
        if (selectedKeys.has(key)) {
            onSelectionChange(selectedRows.filter((r) => JSON.stringify(r) !== key))
        } else {
            onSelectionChange([...selectedRows, row])
        }
    }

    const handleCellDoubleClick = (val: unknown): void => {
        if (val === null || val === undefined) return
        const text =
            val instanceof Date
                ? val.toISOString()
                : typeof val === 'object'
                  ? JSON.stringify(val)
                  : String(val)
        navigator.clipboard.writeText(text).then(() => {
            setCopied(text)
            setTimeout(() => setCopied(null), 1500)
        })
    }

    // Load all column names once when table changes
    useEffect(() => {
        setHiddenColumns(new Set())
        window.api
            .getTableData(database, tableSchema, tableName, 1, 0)
            .then((result) => setAllColumns(result.columns))
            .catch(() => setAllColumns([]))
    }, [database, tableSchema, tableName])

    useEffect(() => {
        setPage(1)
    }, [limit, tableName])

    useEffect(() => {
        const filters = activeFilters.length > 0 ? activeFilters : undefined
        window.api
            .getTableCount(database, tableSchema, tableName, filters)
            .then(setTotal)
            .catch(() => setTotal(null))
    }, [database, tableSchema, tableName, activeFilters])

    useEffect(() => {
        setError(null)
        const offset = (page - 1) * limit
        const filters = activeFilters.length > 0 ? activeFilters : undefined
        const selectCols = visibleColumns.length < allColumns.length ? visibleColumns : undefined
        withLoading(() =>
            window.api
                .getTableData(database, tableSchema, tableName, limit, offset, filters, selectCols)
                .then((result) => {
                    setColumns(result.columns)
                    setColOrder(result.columns)
                    setColWidths((prev) => {
                        const next = { ...prev }
                        for (const col of result.columns) {
                            if (!next[col]) next[col] = DEFAULT_COL_WIDTH
                        }
                        return next
                    })
                    setRows(result.rows)
                })
                .catch((err) =>
                    setError(err instanceof Error ? err.message : 'Failed to load data')
                )
        )
    }, [database, tableSchema, tableName, limit, page, activeFilters, colTick])

    // ── Column resize ────────────────────────────────────────────────
    const onResizeStart = useCallback(
        (col: string, e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            resizing.current = {
                col,
                startX: e.clientX,
                startWidth: colWidths[col] ?? DEFAULT_COL_WIDTH
            }

            const onMouseMove = (ev: MouseEvent): void => {
                if (!resizing.current) return
                const delta = ev.clientX - resizing.current.startX
                const newWidth = Math.max(60, resizing.current.startWidth + delta)
                setColWidths((prev) => ({ ...prev, [resizing.current!.col]: newWidth }))
            }

            const onMouseUp = (): void => {
                resizing.current = null
                window.removeEventListener('mousemove', onMouseMove)
                window.removeEventListener('mouseup', onMouseUp)
            }

            window.addEventListener('mousemove', onMouseMove)
            window.addEventListener('mouseup', onMouseUp)
        },
        [colWidths]
    )

    // ── Column drag-reorder ──────────────────────────────────────────
    const onDragStart = (col: string) => {
        dragCol.current = col
    }

    const onDragOver = (e: React.DragEvent, col: string) => {
        e.preventDefault()
        if (!dragCol.current || dragCol.current === col) return
        setColOrder((prev) => {
            const from = prev.indexOf(dragCol.current!)
            const to = prev.indexOf(col)
            if (from === -1 || to === -1) return prev
            const next = [...prev]
            next.splice(from, 1)
            next.splice(to, 0, dragCol.current!)
            return next
        })
    }

    const onDragEnd = () => {
        dragCol.current = null
    }

    const orderedCols = colOrder.length > 0 ? colOrder : columns

    const handleSearch = (filters: SearchFilter[]): void => {
        setActiveFilters(filters)
        setPage(1)
        onSelectionChange([])
    }

    const toggleColumn = (col: string): void => {
        setHiddenColumns((prev) => {
            const next = new Set(prev)
            if (next.has(col)) {
                next.delete(col)
            } else {
                if (allColumns.length - next.size <= 1) return prev
                next.add(col)
            }
            return next
        })
        setPage(1)
        setColTick((t) => t + 1)
        onSelectionChange([])
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Search */}
            <SearchBar columns={allColumns} onSearch={handleSearch} />
            {/* Column chips */}
            {allColumns.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                    {allColumns.map((col) => {
                        const visible = !hiddenColumns.has(col)
                        return (
                            <button
                                key={col}
                                onClick={() => toggleColumn(col)}
                                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                                    visible
                                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                                }`}
                            >
                                {col}
                            </button>
                        )
                    })}
                </div>
            )}
            {/* Toolbar */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Rows per page</span>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value) as LimitOption)}
                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                    >
                        {LIMIT_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </div>

                {total !== null && (
                    <span className="text-xs text-gray-400">
                        Total:{' '}
                        <span className="text-gray-600 dark:text-gray-300">
                            {total.toLocaleString()}
                        </span>{' '}
                        rows
                    </span>
                )}

                {totalPages !== null && (
                    <div className="ml-auto flex items-center gap-1">
                        <button
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                            className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:cursor-not-allowed"
                        >
                            «
                        </button>
                        <button
                            onClick={() => setPage((p) => p - 1)}
                            disabled={page === 1}
                            className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:cursor-not-allowed"
                        >
                            ‹
                        </button>
                        <span className="px-3 py-1 text-xs text-gray-600 dark:text-gray-300">
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page === totalPages}
                            className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:cursor-not-allowed"
                        >
                            ›
                        </button>
                        <button
                            onClick={() => setPage(totalPages)}
                            disabled={page === totalPages}
                            className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:cursor-not-allowed"
                        >
                            »
                        </button>
                    </div>
                )}
            </div>

            {/* Copy toast */}
            {copied !== null && (
                <div className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs shadow-lg max-w-xs truncate">
                    Copied: {copied}
                </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto relative">
                {error && (
                    <div className="flex items-center justify-center h-32 text-sm text-red-500">
                        {error}
                    </div>
                )}
                {!error && columns.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                        No data
                    </div>
                )}
                {columns.length > 0 && (
                    <table
                        className="text-sm border-collapse"
                        style={{
                            tableLayout: 'fixed',
                            width: orderedCols.reduce(
                                (sum, col) => sum + (colWidths[col] ?? DEFAULT_COL_WIDTH),
                                0
                            )
                        }}
                    >
                        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-10">
                            <tr>
                                <th className="w-8 px-2 py-2 shrink-0" style={{ width: 32 }}>
                                    <input
                                        type="checkbox"
                                        checked={rows.length > 0 && rows.every((r) => selectedKeys.has(JSON.stringify(r)))}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const newRows = rows.filter((r) => !selectedKeys.has(JSON.stringify(r)))
                                                onSelectionChange([...selectedRows, ...newRows])
                                            } else {
                                                const currentKeys = new Set(rows.map((r) => JSON.stringify(r)))
                                                onSelectionChange(selectedRows.filter((r) => !currentKeys.has(JSON.stringify(r))))
                                            }
                                        }}
                                        className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                                    />
                                </th>
                                {orderedCols.map((col) => (
                                    <th
                                        key={col}
                                        draggable
                                        onDragStart={() => onDragStart(col)}
                                        onDragOver={(e) => onDragOver(e, col)}
                                        onDragEnd={onDragEnd}
                                        style={{
                                            width: colWidths[col] ?? DEFAULT_COL_WIDTH,
                                            position: 'relative'
                                        }}
                                        className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 select-none cursor-grab active:cursor-grabbing overflow-hidden"
                                    >
                                        <span className="block truncate">{col}</span>
                                        {/* Resize handle */}
                                        <div
                                            onMouseDown={(e) => onResizeStart(col, e)}
                                            className="absolute right-0 top-0 h-full w-[3px] cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-400 transition-colors"
                                        />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr
                                    key={i}
                                    className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 ${selectedKeys.has(JSON.stringify(row)) ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
                                >
                                    <td
                                        className="px-2 py-2 w-8"
                                        style={{ width: 32 }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedKeys.has(JSON.stringify(row))}
                                            onChange={() => toggleRow(row)}
                                            className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                                        />
                                    </td>
                                    {orderedCols.map((col) => {
                                        const val = row[col]
                                        return (
                                            <td
                                                key={col}
                                                onDoubleClick={() => handleCellDoubleClick(val)}
                                                style={{
                                                    width: colWidths[col] ?? DEFAULT_COL_WIDTH,
                                                    maxWidth: colWidths[col] ?? DEFAULT_COL_WIDTH
                                                }}
                                                className="px-4 py-2 text-gray-700 dark:text-gray-300 overflow-hidden cursor-pointer select-none"
                                                title="Double-click to copy"
                                            >
                                                <span className="block truncate">
                                                    {val === null || val === undefined ? (
                                                        <span className="text-gray-400 italic">
                                                            null
                                                        </span>
                                                    ) : val instanceof Date ? (
                                                        val.toISOString()
                                                    ) : typeof val === 'object' ? (
                                                        JSON.stringify(val)
                                                    ) : (
                                                        String(val)
                                                    )}
                                                </span>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
