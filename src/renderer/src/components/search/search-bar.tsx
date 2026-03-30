import { useState } from 'react'
import SearchRow from './search-row'
import type { SearchFilter } from './search-row'

type Props = {
    columns: string[]
    onSearch: (filters: SearchFilter[]) => void
}

export default function SearchBar({ columns, onSearch }: Props): JSX.Element {
    const [filters, setFilters] = useState<SearchFilter[]>([])
    const [searched, setSearched] = useState(false)

    const addFilter = (): void => {
        setFilters((prev) => [...prev, { column: '', operator: '=', value: '', values: [], likeMode: 'CONTAINS', logic: 'AND' }])
    }

    const updateFilter = (index: number, filter: SearchFilter): void => {
        setFilters((prev) => prev.map((f, i) => (i === index ? filter : f)))
    }

    const removeFilter = (index: number): void => {
        const next = filters.filter((_, i) => i !== index)
        setFilters(next)
        if (next.length === 0 && searched) {
            onSearch([])
            setSearched(false)
        }
    }

    const handleSearch = (): void => {
        const valid = filters.filter((f) =>
            f.column && (f.operator === 'IN' ? f.values.length > 0 : f.value)
        )
        onSearch(valid)
        setSearched(valid.length > 0)
    }

    const handleReset = (): void => {
        setFilters([])
        setSearched(false)
        onSearch([])
    }

    return (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <button
                    onClick={addFilter}
                    className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                >
                    + Filter
                </button>
                {filters.length > 0 && (
                    <button
                        onClick={handleSearch}
                        className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                        Search
                    </button>
                )}
                {searched && (
                    <button
                        onClick={handleReset}
                        className="text-xs px-3 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                    >
                        Reset
                    </button>
                )}
            </div>
            {filters.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 bg-gray-50/50 dark:bg-gray-800/30">
                    {filters.map((filter, i) => (
                        <SearchRow
                            key={i}
                            columns={columns.filter((col) =>
                                col === filter.column || !filters.some((f, j) => j !== i && f.column === col)
                            )}
                            filter={filter}
                            isFirst={i === 0}
                            onChange={(f) => updateFilter(i, f)}
                            onRemove={() => removeFilter(i)}
                            onSearch={handleSearch}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
