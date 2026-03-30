import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import { notifyUpdateError } from '../slack'

export function registerUpdaterHandlers(mainWindow: BrowserWindow): void {
    if (is.dev) return

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
        mainWindow.webContents.send('update:available', { version: info.version })
    })

    autoUpdater.on('download-progress', (progress) => {
        mainWindow.webContents.send('update:progress', {
            percent: Math.round(progress.percent)
        })
    })

    autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update:downloaded')
    })

    autoUpdater.on('error', (err) => {
        mainWindow.webContents.send('update:error', { message: err.message })
        notifyUpdateError(err.message)
    })

    ipcMain.handle('update:install', () => {
        autoUpdater.quitAndInstall()
    })

    // Check on startup, delay 3s to let the window load first
    setTimeout(() => autoUpdater.checkForUpdates(), 3000)
}
