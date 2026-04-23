import { useState } from 'react'
import { setApiKey, testConnection } from '../api/linear'

interface AuthGateProps {
  onAuth: (apiKey: string) => void
}

export default function AuthGate({ onAuth }: AuthGateProps) {
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const key = apiKeyInput.trim()
    if (!key) return

    setLoading(true)
    setError(null)

    try {
      setApiKey(key)
      const name = await testConnection()
      onAuth(key)
      console.log('Connected as:', name)
    } catch (err) {
      setApiKey('')
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Connection failed: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="20" fill="#5E6AD2"/>
            <path d="M17.5 63.5L36.5 82.5C37.8 83.8 39.7 84.1 41.2 83.2L83.2 41.2C84.1 39.7 83.8 37.8 82.5 36.5L63.5 17.5C62.2 16.2 60.3 15.9 58.8 16.8L16.8 58.8C15.9 60.3 16.2 62.2 17.5 63.5Z" fill="white"/>
          </svg>
          <div>
            <div className="auth-title">Linear Roadmap</div>
          </div>
        </div>

        <div className="auth-subtitle">
          Enter your Linear API key to visualize and manage your product roadmap.
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="lin_api_..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="primary" disabled={loading || !apiKeyInput.trim()}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </form>

        <div className="auth-link">
          <a href="https://linear.app/settings/account/security" target="_blank" rel="noopener noreferrer">
            Get your API key at linear.app/settings/account/security
          </a>
        </div>
      </div>
    </div>
  )
}
