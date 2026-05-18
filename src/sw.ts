/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

self.addEventListener('install', () => self.skipWaiting())

// Précache uniquement les assets statiques (pas le JS — toujours depuis le réseau)
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Supabase — jamais de cache (auth + données temps réel)
registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkOnly(),
)

// À chaque mise à jour du SW : vide tous les caches et force le rechargement
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => clients.forEach(client => client.navigate(client.url)))
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
      if ('setAppBadge' in self.registration) {
        (self.registration as any).setAppBadge?.().catch?.(() => {})
      }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
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
