import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr     = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('unsubscribed')

  // On mount: detect current state
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setStatus(sub ? 'subscribed' : 'unsubscribed')
    })
  }, [])

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setStatus('denied')
      return
    }

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const json   = sub.toJSON()
    const keys   = json.keys as { p256dh: string; auth: string }

    await supabase.from('push_subscriptions').upsert(
      {
        user_id:  user.id,
        endpoint: sub.endpoint,
        p256dh:   keys.p256dh,
        auth:     keys.auth,
      },
      { onConflict: 'endpoint' },
    )

    setStatus('subscribed')
  }, [])

  const unsubscribe = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return

    await sub.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    setStatus('unsubscribed')
  }, [])

  return { status, subscribe, unsubscribe }
}
