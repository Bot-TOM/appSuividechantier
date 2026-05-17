/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

// Prend le contrôle immédiatement après installation (évite l'écran blanc)
self.addEventListener('install', () => self.skipWaiting())

// Injected by VitePWA at build time
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA fallback
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// JS chunks — NetworkOnly : toujours charger la dernière version après un déploiement
// Les fichiers sont déjà précachés par Workbox via self.__WB_MANIFEST (hashes uniques)
registerRoute(
  /\/assets\/.*\.js$/,
  new NetworkOnly()
)

// Supabase — NetworkOnly : jamais de cache pour l'auth et les données temps réel
// Un token expiré en cache = page blanche après login
registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkOnly()
)

// Take control of all clients immediately when updated
// + vide tous les anciens caches pour forcer le rechargement des assets frais
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all([
        // Supprime tous les caches non liés au precache Workbox courant
        ...keys
          .filter((k) => !k.startsWith('workbox-precache'))
          .map((k) => caches.delete(k)),
        self.clients.claim(),
      ])
    )
  )
})

// ── Push notifications ──────────────────────────────────────────────────────
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
    self.registration.showNotification(title, options).then(() => {
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
