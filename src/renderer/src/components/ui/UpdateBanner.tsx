import { useState, useEffect } from 'react'

type UpdateState =
    | { status: 'idle' }
    | { status: 'available'; version: string }
    | { status: 'downloading'; percent: number }
    | { status: 'ready' }

export default function UpdateBanner(): JSX.Element | null {
    const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })

    useEffect(() => {
        window.api.onUpdateAvailable((version) =>
            setUpdate({ status: 'available', version })
        )
        window.api.onUpdateProgress((percent) =>
            setUpdate({ status: 'downloading', percent })
        )
        window.api.onUpdateDownloaded(() => setUpdate({ status: 'ready' }))
    }, [])

    if (update.status === 'idle') return null

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-600 text-white text-xs shrink-0">
            {update.status === 'available' && (
                <span>New version {update.version} available — downloading...</span>
            )}
            {update.status === 'downloading' && (
                <>
                    <span>Downloading update... {update.percent}%</span>
                    <div className="flex-1 max-w-[160px] h-1 bg-blue-400 rounded overflow-hidden">
                        <div
                            className="h-full bg-white rounded transition-all"
                            style={{ width: `${update.percent}%` }}
                        />
                    </div>
                </>
            )}
            {update.status === 'ready' && (
                <>
                    <span>Update ready to install.</span>
                    <button
                        onClick={() => window.api.installUpdate()}
                        className="ml-auto px-3 py-1 rounded bg-white text-blue-600 font-medium hover:bg-blue-50"
                    >
                        Restart & Install
                    </button>
                </>
            )}
        </div>
    )
}
