import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('api', {
    getConnectionInfo: () => ipcRenderer.invoke('db:getConnectionInfo'),
    getConnectionSettings: () => ipcRenderer.invoke('db:getConnectionSettings'),
    testConnection: (connection: {
        server: string
        port: number
        database: string
        user: string
        password: string
    }) => ipcRenderer.invoke('db:testConnection', connection),
    saveConnectionSettings: (connection: {
        server: string
        port: number
        database: string
        user: string
        password: string
    }) => ipcRenderer.invoke('db:saveConnectionSettings', connection),

    getDatabases: () => ipcRenderer.invoke('db:getDatabases'),
    getTables: (database: string) => ipcRenderer.invoke('db:getTables', database),
    getColumns: (database: string, tableSchema: string, tableName: string) =>
        ipcRenderer.invoke('db:getColumns', database, tableSchema, tableName),
    getTableCount: (database: string, tableSchema: string, tableName: string) =>
        ipcRenderer.invoke('db:getTableCount', database, tableSchema, tableName),
    getTableData: (
        database: string,
        tableSchema: string,
        tableName: string,
        limit: number,
        offset: number
    ) => ipcRenderer.invoke('db:getTableData', database, tableSchema, tableName, limit, offset),
    generateDdl: (database: string, tables: { tableSchema: string; tableName: string }[]) =>
        ipcRenderer.invoke('db:generateDdl', database, tables),
    generateInserts: (
        database: string,
        tables: { tableSchema: string; tableName: string; rows: Record<string, unknown>[] }[]
    ) => ipcRenderer.invoke('db:generateInserts', database, tables),
    exportDdl: (ddl: string, suggestedName: string) =>
        ipcRenderer.invoke('db:exportDdl', ddl, suggestedName),

    onUpdateAvailable: (cb: (version: string) => void) => {
        ipcRenderer.on('update:available', (_: IpcRendererEvent, info: { version: string }) =>
            cb(info.version)
        )
    },
    onUpdateProgress: (cb: (percent: number) => void) => {
        ipcRenderer.on('update:progress', (_: IpcRendererEvent, data: { percent: number }) =>
            cb(data.percent)
        )
    },
    onUpdateDownloaded: (cb: () => void) => {
        ipcRenderer.on('update:downloaded', cb)
    },
    onUpdateError: (cb: (message: string) => void) => {
        ipcRenderer.on('update:error', (_: IpcRendererEvent, data: { message: string }) =>
            cb(data.message)
        )
    },
    installUpdate: () => ipcRenderer.invoke('update:install')
})
