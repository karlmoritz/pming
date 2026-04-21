import { useState, useEffect } from 'react'
import { setApiKey, getApiKey } from './api/linear'
import AuthGate from './components/AuthGate'
import RoadmapPage from './components/RoadmapPage'

const LS_KEY = 'linear_api_key'

export default function App() {
  const [apiKey, setApiKeyState] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('roadmap_theme') as 'dark' | 'light') ?? 'dark'
  )

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) {
      setApiKey(stored)
      setApiKeyState(stored)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('roadmap_theme', theme)
  }, [theme])

  function handleAuth(key: string) {
    localStorage.setItem(LS_KEY, key)
    setApiKey(key)
    setApiKeyState(key)
  }

  function handleLogout() {
    localStorage.removeItem(LS_KEY)
    setApiKey('')
    setApiKeyState(null)
  }

  if (!apiKey) {
    return <AuthGate onAuth={handleAuth} />
  }

  return (
    <RoadmapPage
      apiKey={apiKey}
      onLogout={handleLogout}
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    />
  )
}

// Keep getApiKey exported for use in other files if needed
export { getApiKey }
