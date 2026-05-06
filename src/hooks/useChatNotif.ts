import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useChatNotif(userId: string) {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('push_subscriptions')
      .select('chat_notif_enabled')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEnabled(data.chat_notif_enabled ?? true)
      })
  }, [userId])

  const toggle = useCallback(async () => {
    if (enabled === null) return
    const next = !enabled
    setEnabled(next)
    await supabase
      .from('push_subscriptions')
      .update({ chat_notif_enabled: next })
      .eq('user_id', userId)
  }, [enabled, userId])

  return { enabled, toggle }
}
