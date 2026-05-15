import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface NotifPreferences {
  chat_notif_enabled:         boolean
  anomalie_notif_enabled:     boolean
  rapport_notif_enabled:      boolean
  chantier_notif_enabled:     boolean
  autocontrole_notif_enabled: boolean
}

const DEFAULTS: NotifPreferences = {
  chat_notif_enabled:         true,
  anomalie_notif_enabled:     true,
  rapport_notif_enabled:      true,
  chantier_notif_enabled:     true,
  autocontrole_notif_enabled: true,
}

export function useNotifPreferences(subscribed: boolean) {
  const [prefs, setPrefs]     = useState<NotifPreferences>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [endpoint, setEndpoint] = useState<string | null>(null)

  // Récupère l'endpoint du navigateur + les préfs en base
  const fetch = useCallback(async () => {
    if (!subscribed) { setLoading(false); return }

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) { setLoading(false); return }

    setEndpoint(sub.endpoint)

    const { data } = await supabase
      .from('push_subscriptions')
      .select('chat_notif_enabled, anomalie_notif_enabled, rapport_notif_enabled, chantier_notif_enabled, autocontrole_notif_enabled')
      .eq('endpoint', sub.endpoint)
      .single()

    if (data) {
      setPrefs({
        chat_notif_enabled:         data.chat_notif_enabled         ?? true,
        anomalie_notif_enabled:     data.anomalie_notif_enabled     ?? true,
        rapport_notif_enabled:      data.rapport_notif_enabled      ?? true,
        chantier_notif_enabled:     data.chantier_notif_enabled     ?? true,
        autocontrole_notif_enabled: data.autocontrole_notif_enabled ?? true,
      })
    }
    setLoading(false)
  }, [subscribed])

  useEffect(() => { fetch() }, [fetch])

  const toggle = useCallback(async (key: keyof NotifPreferences) => {
    if (!endpoint) return
    const newVal = !prefs[key]
    // Optimistic
    setPrefs(p => ({ ...p, [key]: newVal }))
    await supabase
      .from('push_subscriptions')
      .update({ [key]: newVal })
      .eq('endpoint', endpoint)
  }, [prefs, endpoint])

  return { prefs, loading, toggle }
}
