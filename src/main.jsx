import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SharedResult } from './SharedResult.jsx'

function getShareTokenFromPath(pathname) {
  const match = pathname.match(/^\/result\/([A-Za-z0-9_-]+)$/)
  return match?.[1] || null
}

const shareToken = getShareTokenFromPath(window.location.pathname)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {shareToken ? <SharedResult token={shareToken} /> : <App />}
  </StrictMode>,
)
