import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

type PresencePayload = { user_id: string; name: string; typing: boolean }

export function usePresence(chantierId: string, userId: string, userName: string = '') {
  const [onlineUsers, setOnlineUsers]   = useState<Set<string>>(new Set())
  const [typingNames, setTypingNames]   = useState<string[]>([])
  const channelRef  = useRef<RealtimeChannel | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId || !chantierId) return

    const channel = supabase.channel(`presence-chat-${chantierId}`, {
      config: { presence: { key: userId } },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>()
        const ids   = new Set(Object.keys(state))
        setOnlineUsers(ids)
        // Collecter les noms en train d'écrire (hors soi-même)
        const typing: string[] = []
        for (const [key, entries] of Object.entries(state)) {
          if (key === userId) continue
          const entry = (entries as PresencePayload[])[0]
          if (entry?.typing && entry.name) typing.push(entry.name.split(' ')[0]) // prénom uniquement
        }
        setTypingNames(typing)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, name: userName, typing: false })
        }
      })

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [chantierId, userId, userName])

  // Appeler quand l'utilisateur frappe — s'arrête automatiquement après 2,5s
  const setTyping = useCallback(async () => {
    if (!channelRef.current) return

    if (typingTimer.current) clearTimeout(typingTimer.current)

    await channelRef.current.track({ user_id: userId, name: userName, typing: true })

    typingTimer.current = setTimeout(async () => {
      if (channelRef.current) {
        await channelRef.current.track({ user_id: userId, name: userName, typing: false })
      }
    }, 2500)
  }, [userId, userName])

  return { onlineUsers, typingNames, setTyping }
}
