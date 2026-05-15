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

// Quand le nouveau SW prend le contrôle (skipWaiting + clients.claim),
// on recharge la page pour charger les nouveaux assets (nouveaux hashes).
// Sans ça, la page garde les anciens hashes en mémoire et le CDN retourne
// du HTML à la place du JS → erreur MIME "text/html".
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      reloading = true
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
