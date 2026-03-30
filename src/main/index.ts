import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerConnectionHandlers, loadSettings } from './ipc/connection'
import { registerSchemaHandlers } from './ipc/schema'
import { registerUpdaterHandlers } from './ipc/updater'
import { registerChildWindowHandlers } from './ipc/child-window'
import { initSlack, encryptWebhookUrl, notifyUnhandledError } from './slack'

function createWindow(): BrowserWindow {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return mainWindow
}

process.on('uncaughtException', (err) => notifyUnhandledError(err))
process.on('unhandledRejection', (reason) => notifyUnhandledError(reason))

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.electronicmssql')

    const settings = loadSettings()
    const rawWebhook = settings.slack?.webhookUrl ?? ''
    initSlack(rawWebhook)

    // Auto-encrypt plain webhook URL on first run
    if (rawWebhook && !rawWebhook.startsWith('enc:')) {
        const encrypted = encryptWebhookUrl(rawWebhook)
        if (encrypted !== rawWebhook) {
            settings.slack = { webhookUrl: encrypted }
            const { writeFileSync } = require('fs')
            const { join } = require('path')
            const settingsPath = app.isPackaged
                ? join(app.getPath('userData'), 'appsettings.json')
                : join(process.cwd(), 'appsettings.json')
            writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
        }
    }

    app.on('browser-window-created', (_, window) => {
        if (is.dev) optimizer.watchWindowShortcuts(window)
    })

    ipcMain.handle('app:getVersion', () => app.getVersion())

    registerConnectionHandlers()
    registerSchemaHandlers()

    const mainWindow = createWindow()
    registerChildWindowHandlers(mainWindow)
    registerUpdaterHandlers(mainWindow)

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    app.quit()
})
