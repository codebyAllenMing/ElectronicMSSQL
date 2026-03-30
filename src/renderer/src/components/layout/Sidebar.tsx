import { useState, useEffect } from 'react'
import { useDatabases } from '../../hooks/use-database'
import TreeView from '../tree/TreeView'
import SettingsModal from '../ui/SettingsModal'
import type { AppView } from '../../app'

type Props = {
    onViewChange: (view: AppView) => void
}

export default function Sidebar({ onViewChange }: Props): JSX.Element {
    const { databases, connectionInfo, loading, error, reload } = useDatabases()
    const [showSettings, setShowSettings] = useState(false)
    const [appVersion, setAppVersion] = useState('')

    useEffect(() => {
        window.api.getAppVersion().then(setAppVersion)
    }, [])

    return (
        <>
            <aside className="w-64 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Server
                    </p>
                    {connectionInfo && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 truncate">
                            {connectionInfo.server}:{connectionInfo.port}
                        </p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && <p className="px-3 py-4 text-sm text-gray-400">Connecting...</p>}
                    {error && (
                        <p className="px-3 py-4 text-sm text-red-500 dark:text-red-400">{error}</p>
                    )}
                    {!loading && !error && (
                        <TreeView databases={databases} onViewChange={onViewChange} />
                    )}
                </div>

                {/* Bottom settings button */}
                <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        title="Connection Settings"
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                        <svg
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                        <span className="text-xs">Connection Settings</span>
                    </button>
                    <p className="text-xs text-gray-400 dark:text-gray-600 px-2 border-t border-gray-200 dark:border-gray-800 pt-2">
                        {appVersion && `v${appVersion}`}
                    </p>
                </div>
            </aside>

            {showSettings && (
                <SettingsModal onClose={() => setShowSettings(false)} onSaved={reload} />
            )}
        </>
    )
}
