/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// ── Conversation active (mis à jour par l'app via postMessage) ───────────────
// Perdu au redémarrage du SW, mais l'app renvoie l'info à chaque montage.
let activeConvId: string | null = null

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'set-active-conv') {
    activeConvId = event.data.convId ?? null
  }
})

// Prend le contrôle immédiatement après installation (évite l'écran blanc)
self.addEventListener('install', () => self.skipWaiting())

// Injected by VitePWA at build time
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA fallback
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// JS chunks — NetworkFirst to always serve latest after deploy
registerRoute(
  /\/assets\/.*\.js$/,
  new NetworkFirst({
    cacheName: 'js-chunks',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 })],
    networkTimeoutSeconds: 10,
  }),
)

// Supabase API — NetworkFirst
registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 })],
  }),
)

// Take control of all clients immediately when updated
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ── Push notifications ──────────────────────────────────────────────────────

/** Extrait l'ID de la cible depuis une URL de notification.
 *  Ex: /manager?tab=chat&group=abc123  → { type: 'group', id: 'abc123' }
 *      /manager?tab=chat&chantier=xyz  → { type: 'chantier', id: 'xyz' }  */
function extractTarget(url: string): { type: string; id: string } | null {
  try {
    const u = new URL(url, self.location.origin)
    const group    = u.searchParams.get('group')
    const chantier = u.searchParams.get('chantier')
    if (group)    return { type: 'group',    id: group }
    if (chantier) return { type: 'chantier', id: chantier }
  } catch { /* ignore */ }
  return null
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data: { title?: string; body?: string; url?: string } = {}
  try { data = event.data.json() } catch { data = { title: 'ChantierPV', body: event.data.text() } }

  const title   = data.title ?? 'ChantierPV'
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: { url: data.url ?? '/' },
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      // Vérifie si l'utilisateur est dans la conversation ciblée ET que l'app est au premier plan
      const appFocused = clients.some(c => c.focused)
      if (appFocused && activeConvId) {
        const target = extractTarget(data.url ?? '/')
        if (target && target.id === activeConvId) {
          // L'utilisateur est déjà en train de lire cette conversation → pas de notification
          return
        }
      }

      await self.registration.showNotification(title, options)
      // Badge API — incrémente le compteur sur l'icône PWA (Chrome/Android)
      if ('setAppBadge' in self.registration) {
        (self.registration as any).setAppBadge?.().catch?.(() => {})
      }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Efface le badge quand l'utilisateur interagit avec la notification
  if ('clearAppBadge' in self.registration) {
    (self.registration as any).clearAppBadge?.().catch?.(() => {})
  }
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    }),
  )
})
