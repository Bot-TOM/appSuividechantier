import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface NotifPreferences {
  chat_notif_enabled:              boolean
  anomalie_notif_enabled:          boolean
  rapport_notif_enabled:           boolean
  chantier_notif_enabled:          boolean
  autocontrole_notif_enabled:      boolean
  global_messages_notif_enabled:   boolean
}

const DEFAULTS: NotifPreferences = {
  chat_notif_enabled:              true,
  anomalie_notif_enabled:          true,
  rapport_notif_enabled:           true,
  chantier_notif_enabled:          true,
  autocontrole_notif_enabled:      true,
  global_messages_notif_enabled:   true,
}

export function useNotifPreferences(subscribed: boolean) {
  const [prefs, setPrefs]       = useState<NotifPreferences>(DEFAULTS)
  const [loading, setLoading]   = useState(true)
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [userId,   setUserId]   = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!subscribed) { setLoading(false); return }

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) { setLoading(false); return }

    const ep = sub.endpoint
    setEndpoint(ep)

    // Récupère l'utilisateur courant pour cibler sa ligne précisément
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    setUserId(uid)

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('chat_notif_enabled, anomalie_notif_enabled, rapport_notif_enabled, chantier_notif_enabled, autocontrole_notif_enabled, global_messages_notif_enabled')
      .eq('endpoint', ep)
      .maybeSingle()   // maybeSingle : pas d'erreur si 0 ligne (RLS peut filtrer)

    if (data) {
      setPrefs({
        chat_notif_enabled:            data.chat_notif_enabled            ?? true,
        anomalie_notif_enabled:        data.anomalie_notif_enabled        ?? true,
        rapport_notif_enabled:         data.rapport_notif_enabled         ?? true,
        chantier_notif_enabled:        data.chantier_notif_enabled        ?? true,
        autocontrole_notif_enabled:    data.autocontrole_notif_enabled    ?? true,
        global_messages_notif_enabled: data.global_messages_notif_enabled ?? true,
      })
    } else if (!error && uid) {
      // Ligne introuvable (race condition rare entre upsert et fetch) :
      // on insère avec les defaults → les boutons fonctionneront immédiatement
      const json = sub.toJSON()
      const keys = json.keys as { p256dh: string; auth: string }
      await supabase.from('push_subscriptions').upsert(
        { user_id: uid, endpoint: ep, p256dh: keys.p256dh, auth: keys.auth, ...DEFAULTS },
        { onConflict: 'endpoint,user_id' },
      )
      setPrefs(DEFAULTS)
    }
    setLoading(false)
  }, [subscribed])

  useEffect(() => { fetch() }, [fetch])

  const toggle = useCallback(async (key: keyof NotifPreferences) => {
    if (!endpoint || !userId) return
    const newVal = !prefs[key]
    setPrefs(p => ({ ...p, [key]: newVal }))
    await supabase
      .from('push_subscriptions')
      .update({ [key]: newVal })
      .eq('endpoint', endpoint)
      .eq('user_id', userId)   // cible exactement la ligne de cet utilisateur
  }, [prefs, endpoint, userId])

  /** Active ou désactive toutes les notifications en un seul appel DB */
  const setAll = useCallback(async (value: boolean) => {
    if (!endpoint || !userId) return
    const newPrefs: NotifPreferences = {
      chat_notif_enabled:              value,
      anomalie_notif_enabled:          value,
      rapport_notif_enabled:           value,
      chantier_notif_enabled:          value,
      autocontrole_notif_enabled:      value,
      global_messages_notif_enabled:   value,
    }
    setPrefs(newPrefs)
    await supabase
      .from('push_subscriptions')
      .update(newPrefs)
      .eq('endpoint', endpoint)
      .eq('user_id', userId)   // cible exactement la ligne de cet utilisateur
  }, [endpoint, userId])

  const allEnabled  = Object.values(prefs).every(v => v === true)
  const allDisabled = Object.values(prefs).every(v => v === false)

  return { prefs, loading, toggle, setAll, allEnabled, allDisabled }
}
