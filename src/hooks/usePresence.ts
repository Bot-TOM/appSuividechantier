import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function usePresence(chantierId: string, userId: string) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId || !chantierId) return

    const channel = supabase.channel(`presence-chat-${chantierId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user_id: string }>()
        const ids = new Set(Object.keys(state))
        setOnlineUsers(ids)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [chantierId, userId])

  return { onlineUsers }
}
