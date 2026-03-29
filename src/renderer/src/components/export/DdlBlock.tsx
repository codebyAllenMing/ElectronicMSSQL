import { useState } from 'react'

type Props = {
    ddl: string
}

export default function DdlBlock({ ddl }: Props): JSX.Element {
    const [copied, setCopied] = useState(false)

    const handleCopy = async (): Promise<void> => {
        await navigator.clipboard.writeText(ddl)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="relative rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-400 uppercase tracking-wider">DDL</span>
                <button
                    onClick={handleCopy}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="p-4 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre">
                {ddl}
            </pre>
        </div>
    )
}
