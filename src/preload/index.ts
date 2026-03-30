import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('api', {
    getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
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

    getSlackSettings: () => ipcRenderer.invoke('db:getSlackSettings'),
    saveSlackSettings: (webhookUrl: string) => ipcRenderer.invoke('db:saveSlackSettings', webhookUrl),
    getDatabases: () => ipcRenderer.invoke('db:getDatabases'),
    getTables: (database: string) => ipcRenderer.invoke('db:getTables', database),
    getColumns: (database: string, tableSchema: string, tableName: string) =>
        ipcRenderer.invoke('db:getColumns', database, tableSchema, tableName),
    getTableCount: (
        database: string,
        tableSchema: string,
        tableName: string,
        filters?: { column: string; operator: string; value: string; values?: string[]; likeMode?: string; logic: string }[]
    ) => ipcRenderer.invoke('db:getTableCount', database, tableSchema, tableName, filters),
    getTableData: (
        database: string,
        tableSchema: string,
        tableName: string,
        limit: number,
        offset: number,
        filters?: { column: string; operator: string; value: string; values?: string[]; likeMode?: string; logic: string }[],
        selectColumns?: string[]
    ) =>
        ipcRenderer.invoke(
            'db:getTableData',
            database,
            tableSchema,
            tableName,
            limit,
            offset,
            filters,
            selectColumns
        ),
    generateDdl: (database: string, tables: { tableSchema: string; tableName: string }[]) =>
        ipcRenderer.invoke('db:generateDdl', database, tables),
    generateInserts: (
        database: string,
        tables: { tableSchema: string; tableName: string; rows: Record<string, unknown>[] }[]
    ) => ipcRenderer.invoke('db:generateInserts', database, tables),
    exportDdl: (ddl: string, suggestedName: string) =>
        ipcRenderer.invoke('db:exportDdl', ddl, suggestedName),

    openChildWindow: (
        route: string,
        data: unknown,
        options?: { width?: number; height?: number; title?: string }
    ) => ipcRenderer.invoke('childWindow:open', route, data, options),
    getChildWindowData: () => ipcRenderer.invoke('childWindow:getData'),

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
