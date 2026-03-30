import { useState, useEffect } from 'react'

export default function SqlPreview(): JSX.Element {
    const [sql, setSql] = useState<string>('')
    const [copied, setCopied] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        window.api.getChildWindowData().then((data) => {
            setSql((data as string) ?? '')
            setLoading(false)
        })
    }, [])

    const handleCopy = (): void => {
        navigator.clipboard.writeText(sql).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400 text-sm">
                Loading...
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 shrink-0">
                <button
                    onClick={handleCopy}
                    className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        copied
                            ? 'bg-green-800 text-green-200 border border-green-600'
                            : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                    }`}
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
                <span className="text-xs text-gray-500">
                    {sql.split('\n').length} lines
                </span>
            </div>
            <pre className="flex-1 overflow-auto px-4 py-3 text-xs leading-relaxed font-mono whitespace-pre-wrap break-all text-gray-300">
                {sql}
            </pre>
        </div>
    )
}
