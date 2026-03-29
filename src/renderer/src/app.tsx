import { useState } from 'react'
import { useTheme } from './hooks/use-theme'
import Sidebar from './components/layout/Sidebar'
import MainContent from './components/layout/MainContent'
import ThemeToggle from './components/ui/ThemeToggle'
import type { TableInfo } from '../../types/schema'

export type AppView =
  | { type: 'empty' }
  | { type: 'table-overview'; database: string; tables: TableInfo[] }
  | { type: 'schema-detail'; database: string; tableName: string }

export default function App(): JSX.Element {
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<AppView>({ type: 'empty' })

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
        <Sidebar onViewChange={setView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex justify-end p-2 border-b border-gray-200 dark:border-gray-800">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <MainContent view={view} onViewChange={setView} />
        </div>
      </div>
    </div>
  )
}
