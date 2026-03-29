type Props = {
    label: string
    onClick: () => void
}

export default function TreeNode({ label, onClick }: Props): JSX.Element {
    return (
        <li>
            <button
                onClick={onClick}
                className="w-full text-left px-3 py-1 text-sm truncate text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
                {label}
            </button>
        </li>
    )
}
