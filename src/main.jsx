import * as Sentry from '@sentry/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initializeRosterStorage, flushRosterStorage } from './services/rosterStorageService.js'
import { getWorkspaces } from './services/stateWorkspaceService.js'

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_VERCEL_ENV || import.meta.env.MODE,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}

async function start() {
  await initializeRosterStorage()
  getWorkspaces()
  await flushRosterStorage()
  ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  )
}
start().catch(() => {
  // Do not boot an empty default roster over inaccessible saved data.
  const root = document.getElementById('root')
  root.style.cssText = 'padding:24px;color:#fff;background:#0A1628;min-height:100vh;font:16px system-ui'
  const message = document.createElement('p')
  message.textContent = 'Unable to open saved data. Your saved records have not been cleared. Close other Intel tabs and retry. If device storage is full, free some space without clearing this site’s data.'
  const retry = document.createElement('button')
  retry.textContent = 'Retry opening saved data'
  retry.style.cssText = 'min-height:44px;padding:12px;font:inherit'
  retry.onclick = () => window.location.reload()
  root.replaceChildren(message, retry)
})
