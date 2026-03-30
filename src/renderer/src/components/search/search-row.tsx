import { useState, useRef, useEffect } from 'react'
import TagInput from './tag-input'

export type SearchFilter = {
    column: string
    operator: string
    value: string
    values: string[]
    likeMode: 'CONTAINS' | 'STARTS' | 'ENDS'
    logic: 'AND' | 'OR'
}

type Props = {
    columns: string[]
    filter: SearchFilter
    isFirst: boolean
    onChange: (filter: SearchFilter) => void
    onRemove: () => void
    onSearch?: () => void
}

export default function SearchRow({ columns, filter, isFirst, onChange, onRemove, onSearch }: Props): JSX.Element {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

    const filtered = columns.filter((col) =>
        col.toLowerCase().includes(search.toLowerCase())
    )

    useEffect(() => {
        const handler = (e: MouseEvent): void => {
            const target = e.target as Node
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                panelRef.current && !panelRef.current.contains(target)
            ) {
                setOpen(false)
                setSearch('')
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const toggleOpen = (): void => {
        if (open) {
            setOpen(false)
            setSearch('')
        } else {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect()
                setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 220) })
            }
            setOpen(true)
            setTimeout(() => searchInputRef.current?.focus(), 0)
        }
    }

    const selectColumn = (col: string): void => {
        onChange({ ...filter, column: col })
        setOpen(false)
        setSearch('')
    }

    return (
        <div className="flex items-center gap-2">
            {/* AND/OR logic */}
            {isFirst ? (
                <span className="text-xs text-gray-400 dark:text-gray-500 w-[52px] text-center">WHERE</span>
            ) : (
                <select
                    value={filter.logic}
                    onChange={(e) => onChange({ ...filter, logic: e.target.value as 'AND' | 'OR' })}
                    className="text-xs px-1 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-[52px]"
                >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                </select>
            )}

            {/* Column selector trigger */}
            <button
                ref={triggerRef}
                onClick={toggleOpen}
                className="text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-left w-[160px] hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center gap-1"
            >
                <span className={`flex-1 truncate ${filter.column ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                    {filter.column || 'Column'}
                </span>
                <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    ref={panelRef}
                    className="fixed z-50 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl flex flex-col"
                    style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                >
                    <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setHighlightIndex(-1)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault()
                                    setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1))
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault()
                                    setHighlightIndex((prev) => Math.max(prev - 1, 0))
                                } else if (e.key === 'Enter') {
                                    e.preventDefault()
                                    if (highlightIndex >= 0 && highlightIndex < filtered.length) {
                                        selectColumn(filtered[highlightIndex])
                                    }
                                } else if (e.key === 'Escape') {
                                    setOpen(false)
                                    setSearch('')
                                }
                            }}
                            placeholder="Search..."
                            className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:border-blue-400"
                        />
                    </div>
                    <ul ref={listRef} className="max-h-[200px] overflow-y-auto py-1">
                        {filtered.length === 0 && (
                            <li className="px-3 py-2 text-xs text-gray-400">No match</li>
                        )}
                        {filtered.map((col, i) => {
                            const isSelected = col === filter.column
                            const isHighlighted = i === highlightIndex
                            return (
                                <li
                                    key={col}
                                    ref={(el) => {
                                        if (isHighlighted && el) {
                                            el.scrollIntoView({ block: 'nearest' })
                                        }
                                    }}
                                    onMouseDown={() => selectColumn(col)}
                                    onMouseEnter={() => setHighlightIndex(i)}
                                    className={`px-3 py-2 text-xs cursor-pointer truncate transition-colors ${
                                        isHighlighted
                                            ? 'bg-gray-100 dark:bg-gray-800'
                                            : ''
                                    } ${
                                        isSelected
                                            ? 'text-blue-600 dark:text-blue-400 font-medium'
                                            : 'text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    {col}
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            <select
                value={filter.operator}
                onChange={(e) => onChange({ ...filter, operator: e.target.value, value: '', values: [] })}
                className="text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 min-w-[120px]"
            >
                <option value="=">等於 (=)</option>
                <option value="!=">不等於 (!=)</option>
                <option value=">=">大於等於 ({'>'}=)</option>
                <option value=">">大於 ({'>'})</option>
                <option value="<=">小於等於 ({'<'}=)</option>
                <option value="<">小於 ({'<'})</option>
                <option value="LIKE">模糊 (%)</option>
                <option value="IN">包含 (IN)</option>
            </select>

            {filter.operator === 'LIKE' && (
                <select
                    value={filter.likeMode}
                    onChange={(e) => onChange({ ...filter, likeMode: e.target.value as 'CONTAINS' | 'STARTS' | 'ENDS' })}
                    className="text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                >
                    <option value="CONTAINS">Contains</option>
                    <option value="STARTS">Starts with</option>
                    <option value="ENDS">Ends with</option>
                </select>
            )}

            {filter.operator === 'IN' ? (
                <TagInput
                    values={filter.values}
                    onChange={(vals) => onChange({ ...filter, values: vals })}
                    onSearch={onSearch}
                />
            ) : (
                <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => onChange({ ...filter, value: e.target.value })}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onSearch?.()
                    }}
                    placeholder="Value"
                    className="text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 min-w-[120px]"
                />
            )}

            <button
                onClick={onRemove}
                className="text-xs px-1.5 py-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove filter"
            >
                ✕
            </button>
        </div>
    )
}
