import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getConnectionInfo: () => ipcRenderer.invoke('db:getConnectionInfo'),
  getDatabases: () => ipcRenderer.invoke('db:getDatabases'),
  getTables: (database: string) => ipcRenderer.invoke('db:getTables', database),
  getColumns: (database: string, tableName: string) =>
    ipcRenderer.invoke('db:getColumns', database, tableName),
  generateDdl: (database: string, tableNames: string[]) =>
    ipcRenderer.invoke('db:generateDdl', database, tableNames),
  exportDdl: (ddl: string, suggestedName: string) =>
    ipcRenderer.invoke('db:exportDdl', ddl, suggestedName)
})
