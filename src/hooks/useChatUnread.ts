import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ── Clés localStorage ─────────────────────────────────────────────────────────
const lastSeenKey = (type: 'chantier' | 'group', id: string) =>
  `chat-last-seen-${type}-${id}`

export function useChatUnread(
  userId: string,
  chantierIds: string[],
  groupIds: string[],
) {
  // unreadMap : { [convId]: nombre de messages non lus }
  const [unreadMap,       setUnreadMap]       = useState<Record<string, number>>({})
  // lastActivityMap : { [convId]: ISO timestamp du dernier message (tous utilisateurs) }
  const [lastActivityMap, setLastActivityMap] = useState<Record<string, string>>({})

  const chantiersKey = useMemo(() => chantierIds.join(','), [chantierIds])
  const groupsKey    = useMemo(() => groupIds.join(','),    [groupIds])

  const checkUnread = useCallback(async () => {
    if (!userId) return
    const nextUnread:   Record<string, number> = {}
    const nextActivity: Record<string, string> = {}

    // ── Chantiers ──────────────────────────────────────────────────────────────
    if (chantierIds.length > 0) {
      const { data } = await supabase
        .from('messages')
        .select('chantier_id, created_at, user_id')
        .in('chantier_id', chantierIds)
        .order('created_at', { ascending: false })

      for (const cId of chantierIds) {
        const msgs     = (data ?? []).filter(m => m.chantier_id === cId)
        const lastSeen = localStorage.getItem(lastSeenKey('chantier', cId)) ?? '1970-01-01'

        // Dernier message toutes personnes confondues → pour le tri
        nextActivity[cId] = msgs[0]?.created_at ?? '1970-01-01'

        // Non-lus : messages des autres plus récents que last seen
        nextUnread[cId] = msgs.filter(
          m => m.user_id !== userId && m.created_at > lastSeen
        ).length
      }
    }

    // ── Groupes ────────────────────────────────────────────────────────────────
    if (groupIds.length > 0) {
      const { data } = await supabase
        .from('group_messages')
        .select('group_id, created_at, user_id')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })

      for (const gId of groupIds) {
        const msgs     = (data ?? []).filter(m => m.group_id === gId)
        const lastSeen = localStorage.getItem(lastSeenKey('group', gId)) ?? '1970-01-01'

        nextActivity[gId] = msgs[0]?.created_at ?? '1970-01-01'
        nextUnread[gId]   = msgs.filter(
          m => m.user_id !== userId && m.created_at > lastSeen
        ).length
      }
    }

    setUnreadMap(nextUnread)
    setLastActivityMap(nextActivity)
  }, [userId, chantiersKey, groupsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { checkUnread() }, [checkUnread])

  // Realtime : rafraîchit badges + ordre à chaque nouveau message
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('unread-watcher')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },      checkUnread)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, checkUnread)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, checkUnread])

  const markAsRead = useCallback((id: string, type: 'chantier' | 'group') => {
    localStorage.setItem(lastSeenKey(type, id), new Date().toISOString())
    setUnreadMap(prev => ({ ...prev, [id]: 0 }))
  }, [])

  const totalUnread = useMemo(
    () => Object.values(unreadMap).reduce((s, n) => s + n, 0),
    [unreadMap],
  )

  return { unreadMap, lastActivityMap, markAsRead, totalUnread, checkUnread }
}
