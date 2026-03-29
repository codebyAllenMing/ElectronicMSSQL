import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import sql from 'mssql'

type AppSettings = {
  connection: {
    server: string
    port: number
    database: string
    user: string
    password: string
  }
}

function loadSettings(): AppSettings {
  const settingsPath = app.isPackaged
    ? join(app.getPath('userData'), 'appsettings.json')
    : join(process.cwd(), 'appsettings.json')

  const raw = readFileSync(settingsPath, 'utf-8')
  return JSON.parse(raw) as AppSettings
}

function buildConfig(settings: AppSettings): sql.config {
  const { server, port, database, user, password } = settings.connection
  return {
    server,
    port,
    database,
    user,
    password,
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  }
}

export function registerConnectionHandlers(): void {
  ipcMain.handle('db:getDatabases', async () => {
    const settings = loadSettings()
    const config = buildConfig(settings)
    config.database = 'master'

    const pool = await sql.connect(config)
    const result = await pool.request().query(`
      SELECT name
      FROM sys.databases
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name
    `)
    await pool.close()

    return result.recordset.map((row) => row.name as string)
  })

  ipcMain.handle('db:getConnectionInfo', () => {
    const settings = loadSettings()
    return { server: settings.connection.server, port: settings.connection.port }
  })
}
