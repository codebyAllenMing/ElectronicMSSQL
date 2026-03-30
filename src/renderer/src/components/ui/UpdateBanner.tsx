import { useState, useEffect } from 'react'

type UpdateState =
    | { status: 'idle' }
    | { status: 'available'; version: string }
    | { status: 'downloading'; percent: number }
    | { status: 'ready' }
    | { status: 'error'; message: string }

export default function UpdateBanner(): JSX.Element | null {
    const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })

    useEffect(() => {
        window.api.onUpdateAvailable((version) => setUpdate({ status: 'available', version }))
        window.api.onUpdateProgress((percent) => setUpdate({ status: 'downloading', percent }))
        window.api.onUpdateDownloaded(() => setUpdate({ status: 'ready' }))
        window.api.onUpdateError((message) => setUpdate({ status: 'error', message }))
    }, [])

    if (update.status === 'idle') return null

    // Error: small banner, non-blocking
    if (update.status === 'error') {
        return (
            <div className="flex items-center gap-3 px-4 py-2 text-white text-xs shrink-0 bg-red-600">
                <span>Update error: {update.message}</span>
            </div>
        )
    }

    // Downloading / available / ready: full-screen overlay, blocks all interaction
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-xl px-10 py-8 flex flex-col items-center gap-5 w-80">
                <div className="text-white text-base font-semibold">
                    {update.status === 'ready' ? 'Update Ready' : 'Updating...'}
                </div>

                {(update.status === 'available' || update.status === 'downloading') && (
                    <>
                        <p className="text-gray-400 text-sm text-center">
                            {update.status === 'available'
                                ? 'Preparing download...'
                                : `Downloading... ${update.percent}%`}
                        </p>
                        <div className="w-full h-1.5 bg-gray-700 rounded overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded transition-all duration-300"
                                style={{ width: `${update.status === 'available' ? 0 : update.percent}%` }}
                            />
                        </div>
                    </>
                )}

                {update.status === 'ready' && (
                    <>
                        <p className="text-gray-400 text-sm text-center">
                            The new version has been downloaded and is ready to install.
                        </p>
                        <button
                            onClick={() => window.api.installUpdate()}
                            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                        >
                            Restart & Install
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
