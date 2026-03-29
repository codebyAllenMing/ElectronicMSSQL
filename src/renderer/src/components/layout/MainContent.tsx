import TableOverview from '../table/TableOverview'
import SchemaDetail from '../table/SchemaDetail'
import ErrorBoundary from '../ErrorBoundary'
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
      <ErrorBoundary key={view.database}>
        <TableOverview
          database={view.database}
          onSelectTable={(tableSchema, tableName) =>
            onViewChange({ type: 'schema-detail', database: view.database, tableSchema, tableName })
          }
        />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary key={`${view.database}.${view.tableSchema}.${view.tableName}`}>
      <SchemaDetail
        database={view.database}
        tableSchema={view.tableSchema}
        tableName={view.tableName}
        onBack={() => onViewChange({ type: 'empty' })}
      />
    </ErrorBoundary>
  )
}
