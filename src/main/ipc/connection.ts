import { ipcMain, app, safeStorage } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import sql from 'mssql'
import { notifyConnectionError, encryptWebhookUrl, initSlack } from '../slack'

type AppSettings = {
    connection: {
        server: string
        port: number
        database: string
        user: string
        password: string // stored as "enc:<base64>" or plain (legacy)
        encrypt: boolean
    }
    slack?: {
        webhookUrl: string
    }
}

function settingsPath(): string {
    return app.isPackaged
        ? join(app.getPath('userData'), 'appsettings.json')
        : join(process.cwd(), 'appsettings.json')
}

const defaultSettings: AppSettings = {
    connection: { server: '', port: 1433, database: '', user: '', password: '', encrypt: true }
}

export function loadSettings(): AppSettings {
    try {
        const raw = readFileSync(settingsPath(), 'utf-8')
        return JSON.parse(raw) as AppSettings
    } catch {
        return defaultSettings
    }
}

function decryptPassword(stored: string): string {
    if (stored.startsWith('enc:')) {
        try {
            return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
        } catch {
            return ''
        }
    }
    // Legacy plain text — return as-is (will be re-encrypted on next save)
    return stored
}

function encryptPassword(plain: string): string {
    if (safeStorage.isEncryptionAvailable()) {
        return 'enc:' + safeStorage.encryptString(plain).toString('base64')
    }
    // Encryption not available (rare edge case), keep plain
    return plain
}

function buildConfig(settings: AppSettings): sql.config {
    const { server, port, database, user, password, encrypt } = settings.connection
    return {
        server,
        port,
        database,
        user,
        password: decryptPassword(password),
        options: {
            encrypt,
            trustServerCertificate: !encrypt
        }
    }
}

export function registerConnectionHandlers(): void {
    ipcMain.handle('db:getDatabases', async () => {
        const settings = loadSettings()
        const config = buildConfig(settings)
        config.database = 'master'

        try {
            const pool = await new sql.ConnectionPool(config).connect()
            const result = await pool.request().query(`
        SELECT name
        FROM sys.databases
        WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
        ORDER BY name
      `)
            await pool.close()
            return result.recordset.map((row) => row.name as string)
        } catch (err) {
            notifyConnectionError(
                `${config.server}:${config.port}`,
                err instanceof Error ? err.message : String(err)
            )
            throw err
        }
    })

    ipcMain.handle('db:getConnectionInfo', () => {
        const settings = loadSettings()
        return { server: settings.connection.server, port: settings.connection.port }
    })

    // Returns settings WITHOUT password — renderer never receives the password
    ipcMain.handle('db:getConnectionSettings', () => {
        const settings = loadSettings()
        const { password, ...rest } = settings.connection
        return { ...rest, passwordSet: password.length > 0 }
    })

    ipcMain.handle(
        'db:testConnection',
        async (
            _,
            incoming: {
                server: string
                port: number
                database: string
                user: string
                password: string
                encrypt: boolean
            }
        ) => {
            const existing = loadSettings()
            const plainPassword =
                incoming.password.length > 0
                    ? incoming.password
                    : decryptPassword(existing.connection.password)

            try {
                const pool = await new sql.ConnectionPool({
                    server: incoming.server,
                    port: incoming.port,
                    database: 'master',
                    user: incoming.user,
                    password: plainPassword,
                    options: {
                        encrypt: incoming.encrypt,
                        trustServerCertificate: !incoming.encrypt
                    }
                }).connect()
                await pool.close()
                return { success: true }
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : 'Connection failed'
                }
            }
        }
    )

    ipcMain.handle(
        'db:saveConnectionSettings',
        async (
            _,
            incoming: {
                server: string
                port: number
                database: string
                user: string
                password: string
                encrypt: boolean
            }
        ) => {
            const existing = loadSettings()

            // If password field is blank, keep the existing stored password
            const storedPassword =
                incoming.password.length > 0
                    ? encryptPassword(incoming.password)
                    : existing.connection.password

            // Resolve plain password for connection test
            const plainPassword =
                incoming.password.length > 0
                    ? incoming.password
                    : decryptPassword(existing.connection.password)

            // Test connection before saving
            try {
                const pool = await new sql.ConnectionPool({
                    server: incoming.server,
                    port: incoming.port,
                    database: 'master',
                    user: incoming.user,
                    password: plainPassword,
                    options: {
                        encrypt: incoming.encrypt,
                        trustServerCertificate: !incoming.encrypt
                    }
                }).connect()
                await pool.close()
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : 'Connection failed'
                }
            }

            const connection = {
                server: incoming.server,
                port: incoming.port,
                database: incoming.database,
                user: incoming.user,
                password: storedPassword,
                encrypt: incoming.encrypt
            }

            const saved: AppSettings = { connection }
            if (existing.slack?.webhookUrl) {
                saved.slack = { webhookUrl: existing.slack.webhookUrl }
            }
            writeFileSync(settingsPath(), JSON.stringify(saved, null, 2), 'utf-8')
            return { success: true }
        }
    )

    ipcMain.handle('db:getSlackSettings', () => {
        const settings = loadSettings()
        const stored = settings.slack?.webhookUrl ?? ''
        if (!stored) return { webhookSet: false, maskedUrl: '' }
        let plain = stored
        if (stored.startsWith('enc:')) {
            try {
                plain = safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
            } catch {
                return { webhookSet: true, maskedUrl: '******' }
            }
        }
        const visible = plain.slice(0, 40)
        return { webhookSet: true, maskedUrl: `${visible}******` }
    })

    ipcMain.handle('db:saveSlackSettings', (_, webhookUrl: string) => {
        const settings = loadSettings()
        const encrypted = webhookUrl ? encryptWebhookUrl(webhookUrl) : ''
        settings.slack = { webhookUrl: encrypted }
        writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
        initSlack(encrypted)
        return { success: true }
    })
}
