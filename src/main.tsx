import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Recharge automatiquement quand une nouvelle version du SW est disponible
registerSW({
  onNeedRefresh() {
    // Nouvelle version détectée → recharge silencieuse
    window.location.reload()
  },
  onOfflineReady() {
    // App prête pour usage hors ligne
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
