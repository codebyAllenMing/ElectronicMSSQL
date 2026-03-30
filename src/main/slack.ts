let webhookUrl: string | null = null

export function initSlack(url: string): void {
    webhookUrl = url || null
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
