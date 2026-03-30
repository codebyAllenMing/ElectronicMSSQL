import { useState, useEffect, useRef } from 'react'
import Button from './Button'

type FormState = {
    server: string
    port: number
    database: string
    user: string
    password: string // always empty on load; only populated when user types a new one
    encrypt: boolean
}

type Props = {
    onClose: () => void
    onSaved: () => void
}

export default function SettingsModal({ onClose, onSaved }: Props): JSX.Element {
    const [form, setForm] = useState<FormState>({
        server: '',
        port: 1433,
        database: '',
        user: '',
        password: '',
        encrypt: true
    })
    const [passwordSet, setPasswordSet] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const passwordRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        window.api.getConnectionSettings().then((s) => {
            setForm({
                server: s.server,
                port: s.port,
                database: s.database,
                user: s.user,
                password: '',
                encrypt: s.encrypt
            })
            setPasswordSet(s.passwordSet)
            setLoading(false)
        })
    }, [])

    const handleSave = async (): Promise<void> => {
        setSaving(true)
        setError(null)
        setSuccess(false)
        try {
            const result = await window.api.saveConnectionSettings(form)
            if (result.success) {
                setSuccess(true)
                setTimeout(() => {
                    onSaved()
                    onClose()
                }, 800)
            } else {
                setError(result.error ?? 'Failed to connect')
            }
        } finally {
            setSaving(false)
        }
    }

    const handleTest = async (): Promise<void> => {
        setTesting(true)
        setTestResult(null)
        setError(null)
        try {
            const result = await window.api.testConnection(form)
            setTestResult(result.success ? 'ok' : 'fail')
            if (!result.success) setError(result.error ?? 'Connection failed')
        } finally {
            setTesting(false)
        }
    }

    const set = (field: keyof FormState, value: string | number | boolean): void => {
        setForm((prev) => ({ ...prev, [field]: value }))
        setError(null)
        setTestResult(null)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-[520px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Connection Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                    {loading ? (
                        <p className="text-sm text-gray-400">Loading...</p>
                    ) : (
                        <>
                            <Field label="Server">
                                <input
                                    type="text"
                                    value={form.server}
                                    onChange={(e) => set('server', e.target.value)}
                                    placeholder="e.g. 192.168.1.100"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Port">
                                <input
                                    type="number"
                                    value={form.port}
                                    onChange={(e) => set('port', Number(e.target.value))}
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Database">
                                <input
                                    type="text"
                                    value={form.database}
                                    onChange={(e) => set('database', e.target.value)}
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="User">
                                <input
                                    type="text"
                                    value={form.user}
                                    onChange={(e) => set('user', e.target.value)}
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Password">
                                <div className="flex-1 relative">
                                    <input
                                        ref={passwordRef}
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={(e) => set('password', e.target.value)}
                                        placeholder={
                                            passwordSet
                                                ? 'Leave blank to keep existing'
                                                : 'Enter password'
                                        }
                                        className={`${inputClass} w-full pr-8`}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            setShowPassword((v) => !v)
                                            passwordRef.current?.focus()
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={1.8}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                                />
                                            </svg>
                                        ) : (
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={1.8}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </Field>
                            {passwordSet && form.password.length === 0 && (
                                <p className="text-xs text-gray-400 pl-24">
                                    Password is set. Enter a new one to replace it.
                                </p>
                            )}
                            <Field label="Encrypt">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.encrypt}
                                        onChange={(e) => set('encrypt', e.target.checked)}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Require encrypted connection (Azure / SSL)
                                    </span>
                                </label>
                            </Field>
                            <div className="flex items-center gap-3 pl-24">
                                <button
                                    type="button"
                                    onClick={handleTest}
                                    disabled={testing || saving || loading}
                                    className="text-xs px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {testing ? 'Testing...' : 'Test Connect'}
                                </button>
                                {testResult === 'ok' && (
                                    <span className="text-xs text-green-500">Connected</span>
                                )}
                                {testResult === 'fail' && (
                                    <span className="text-xs text-red-500">Failed</span>
                                )}
                            </div>
                        </>
                    )}

                    {error && <p className="text-xs text-red-500">{error}</p>}
                    {success && <p className="text-xs text-green-500">Connected! Reloading...</p>}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
                    <Button onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
                        {saving ? 'Testing...' : 'Save & Connect'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
    return (
        <div className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-xs text-gray-500 dark:text-gray-400 text-right">
                {label}
            </label>
            {children}
        </div>
    )
}

const inputClass =
    'flex-1 text-sm px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500'
