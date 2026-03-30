import { safeStorage } from 'electron'

let webhookUrl: string | null = null

export function initSlack(storedUrl: string): void {
    if (!storedUrl) {
        webhookUrl = null
        return
    }
    if (storedUrl.startsWith('enc:')) {
        try {
            webhookUrl = safeStorage.decryptString(Buffer.from(storedUrl.slice(4), 'base64'))
        } catch {
            webhookUrl = null
        }
    } else {
        webhookUrl = storedUrl
    }
}

export function encryptWebhookUrl(plain: string): string {
    if (!plain) return ''
    if (plain.startsWith('enc:')) return plain
    if (safeStorage.isEncryptionAvailable()) {
        return 'enc:' + safeStorage.encryptString(plain).toString('base64')
    }
    return plain
}

async function send(text: string): Promise<void> {
    if (!webhookUrl) return
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        })
    } catch {
        // Slack notification failure should never crash the app
    }
}

export function notifyUpdateError(message: string): Promise<void> {
    return send(`:warning: *[ElectronicMSSQL] Auto-Update Error*\n\`\`\`${message}\`\`\``)
}

export function notifyConnectionError(context: string, message: string): Promise<void> {
    return send(`:x: *[ElectronicMSSQL] Connection Error*\n*Context:* ${context}\n\`\`\`${message}\`\`\``)
}

export function notifyUnhandledError(err: unknown): Promise<void> {
    const message = err instanceof Error
        ? `${err.message}\n${err.stack ?? ''}`
        : String(err)
    return send(`:rotating_light: *[ElectronicMSSQL] Unhandled Error*\n\`\`\`${message}\`\`\``)
}
