import { useDatabases } from '../../hooks/use-database'
import TreeView from '../tree/TreeView'
import type { AppView } from '../../app'

type Props = {
  onViewChange: (view: AppView) => void
}

export default function Sidebar({ onViewChange }: Props): JSX.Element {
  const { databases, connectionInfo, loading, error } = useDatabases()

  return (
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
        {loading && (
          <p className="px-3 py-4 text-sm text-gray-400">Connecting...</p>
        )}
        {error && (
          <p className="px-3 py-4 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
        {!loading && !error && (
          <TreeView databases={databases} onViewChange={onViewChange} />
        )}
      </div>
    </aside>
  )
}
