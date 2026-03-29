import TableOverview from '../table/TableOverview'
import SchemaDetail from '../table/SchemaDetail'
import type { AppView } from '../../app'

type Props = {
  view: AppView
  onViewChange: (view: AppView) => void
}

export default function MainContent({ view, onViewChange }: Props): JSX.Element {
  if (view.type === 'empty') {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
        <p className="text-sm">Select a database from the sidebar</p>
      </div>
    )
  }

  if (view.type === 'table-overview') {
    return (
      <TableOverview
        database={view.database}
        tables={view.tables}
        onSelectTable={(tableName) =>
          onViewChange({ type: 'schema-detail', database: view.database, tableName })
        }
      />
    )
  }

  return (
    <SchemaDetail
      database={view.database}
      tableName={view.tableName}
      onBack={() => onViewChange({ type: 'empty' })}
    />
  )
}
