import TreeNodeDatabase from './TreeNodeDatabase'
import type { AppView } from '../../app'

type Props = {
  databases: string[]
  onViewChange: (view: AppView) => void
}

export default function TreeView({ databases, onViewChange }: Props): JSX.Element {
  if (databases.length === 0) {
    return <p className="px-3 py-4 text-sm text-gray-400">No databases found</p>
  }

  return (
    <ul className="py-1">
      {databases.map((db) => (
        <TreeNodeDatabase key={db} database={db} onViewChange={onViewChange} />
      ))}
    </ul>
  )
}
