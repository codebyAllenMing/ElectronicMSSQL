import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getConnectionInfo: () => ipcRenderer.invoke('db:getConnectionInfo'),
  getDatabases: () => ipcRenderer.invoke('db:getDatabases'),
  getTables: (database: string) => ipcRenderer.invoke('db:getTables', database),
  getColumns: (database: string, tableSchema: string, tableName: string) =>
    ipcRenderer.invoke('db:getColumns', database, tableSchema, tableName),
  getTableCount: (database: string, tableSchema: string, tableName: string) =>
    ipcRenderer.invoke('db:getTableCount', database, tableSchema, tableName),
  getTableData: (database: string, tableSchema: string, tableName: string, limit: number, offset: number) =>
    ipcRenderer.invoke('db:getTableData', database, tableSchema, tableName, limit, offset),
  generateDdl: (database: string, tables: { tableSchema: string; tableName: string }[]) =>
    ipcRenderer.invoke('db:generateDdl', database, tables),
  exportDdl: (ddl: string, suggestedName: string) =>
    ipcRenderer.invoke('db:exportDdl', ddl, suggestedName)
})
