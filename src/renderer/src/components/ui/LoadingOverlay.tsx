import { useLoading } from '../../hooks/use-loading'

export default function LoadingOverlay(): JSX.Element | null {
    const { isLoading } = useLoading()
    if (!isLoading) return null

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 dark:bg-gray-950/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2.5">
                <svg
                    className="w-4 h-4 animate-spin text-gray-400 dark:text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                </svg>
                <span className="text-xs text-gray-400 dark:text-gray-500">Loading...</span>
            </div>
        </div>
    )
}
