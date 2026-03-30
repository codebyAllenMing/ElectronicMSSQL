import { useState, useRef } from 'react'

type Props = {
    values: string[]
    onChange: (values: string[]) => void
    onSearch?: () => void
}

export default function TagInput({ values, onChange, onSearch }: Props): JSX.Element {
    const [input, setInput] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const addTag = (): void => {
        const trimmed = input.trim()
        if (trimmed && !values.includes(trimmed)) {
            onChange([...values, trimmed])
        }
        setInput('')
    }

    const removeTag = (index: number): void => {
        onChange(values.filter((_, i) => i !== index))
    }

    return (
        <div
            className="flex flex-wrap items-center gap-1 min-w-[200px] px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-text"
            onClick={() => inputRef.current?.focus()}
        >
            {values.map((val, i) => (
                <span
                    key={i}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs"
                >
                    {val}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            removeTag(i)
                        }}
                        className="hover:text-red-500 transition-colors ml-0.5"
                    >
                        ✕
                    </button>
                </span>
            ))}
            <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault()
                        if (input.trim()) {
                            addTag()
                        } else if (values.length > 0) {
                            onSearch?.()
                        }
                    } else if (e.key === 'Backspace' && !input && values.length > 0) {
                        removeTag(values.length - 1)
                    }
                }}
                placeholder={values.length === 0 ? 'Type and press Enter' : ''}
                className="flex-1 min-w-[80px] text-xs py-0.5 bg-transparent text-gray-700 dark:text-gray-300 outline-none"
            />
        </div>
    )
}
