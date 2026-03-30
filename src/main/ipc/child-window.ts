import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const childDataStore = new Map<string, unknown>()
let windowIdCounter = 0

export function registerChildWindowHandlers(mainWindow: BrowserWindow): void {
    // Close all child windows when main window closes
    mainWindow.on('closed', () => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (win !== mainWindow && !win.isDestroyed()) {
                win.close()
            }
        }
    })

    ipcMain.handle(
        'childWindow:open',
        (_, route: string, data: unknown, options?: { width?: number; height?: number; title?: string }) => {
            const id = `child_${++windowIdCounter}`
            childDataStore.set(id, data)

            const win = new BrowserWindow({
                width: options?.width ?? 720,
                height: options?.height ?? 560,
                title: options?.title ?? 'Preview',
                parent: mainWindow,
                autoHideMenuBar: true,
                webPreferences: {
                    preload: join(__dirname, '../preload/index.js'),
                    sandbox: false
                }
            })

            win.on('closed', () => {
                childDataStore.delete(id)
            })

            const query = `?child=${encodeURIComponent(route)}&id=${encodeURIComponent(id)}`

            if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
                win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${query}`)
            } else {
                win.loadFile(join(__dirname, '../renderer/index.html'), {
                    search: query.slice(1)
                })
            }

            return id
        }
    )

    ipcMain.handle('childWindow:getData', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return null
        const url = win.webContents.getURL()
        const match = url.match(/[?&]id=([^&]+)/)
        if (!match) return null
        const id = decodeURIComponent(match[1])
        return childDataStore.get(id) ?? null
    })
}
