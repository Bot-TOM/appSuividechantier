import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}

export function useChatNotif(userId: string) {
  // null = chargement, false = pas d'abonnement ou désactivé, true = activé
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('push_subscriptions')
      .select('chat_notif_enabled')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSubscribed(true)
          setEnabled(data.chat_notif_enabled ?? true)
        } else {
          setSubscribed(false)
          setEnabled(false)
        }
      })
  }, [userId])

  const toggle = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    if (!subscribed) {
      // Première fois : demander la permission et créer l'abonnement
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      if (!VAPID_PUBLIC_KEY) { console.error('[push] VITE_VAPID_PUBLIC_KEY manquante'); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = sub.toJSON()
      const p256dh = json.keys?.p256dh
      const auth   = json.keys?.auth
      if (!p256dh || !auth) { console.error('[push] clés PushSubscription manquantes'); return }

      await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh,
          auth,
          chat_notif_enabled: true,
        },
        { onConflict: 'endpoint' },
      )

      setSubscribed(true)
      setEnabled(true)
    } else {
      // Déjà abonné : toggle chat_notif_enabled
      const next = !enabled
      setEnabled(next)
      await supabase
        .from('push_subscriptions')
        .update({ chat_notif_enabled: next })
        .eq('user_id', userId)
    }
  }, [enabled, subscribed, userId])

  return { enabled, toggle }
}
