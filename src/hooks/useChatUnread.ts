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
  // unreadMap : { [convId]: nombre de messages non lus (0 = lu) }
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})

  const chantiersKey = useMemo(() => chantierIds.join(','), [chantierIds])
  const groupsKey    = useMemo(() => groupIds.join(','),    [groupIds])

  const checkUnread = useCallback(async () => {
    if (!userId) return
    const next: Record<string, number> = {}

    // ── Chantiers ──────────────────────────────────────────────────────────────
    if (chantierIds.length > 0) {
      // Récupère le dernier message (hors soi-même) par chantier
      const { data } = await supabase
        .from('messages')
        .select('chantier_id, created_at')
        .in('chantier_id', chantierIds)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })

      for (const cId of chantierIds) {
        const lastSeen = localStorage.getItem(lastSeenKey('chantier', cId)) ?? '1970-01-01'
        const count = (data ?? []).filter(
          m => m.chantier_id === cId && m.created_at > lastSeen
        ).length
        next[cId] = count
      }
    }

    // ── Groupes ────────────────────────────────────────────────────────────────
    if (groupIds.length > 0) {
      const { data } = await supabase
        .from('group_messages')
        .select('group_id, created_at')
        .in('group_id', groupIds)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })

      for (const gId of groupIds) {
        const lastSeen = localStorage.getItem(lastSeenKey('group', gId)) ?? '1970-01-01'
        const count = (data ?? []).filter(
          m => m.group_id === gId && m.created_at > lastSeen
        ).length
        next[gId] = count
      }
    }

    setUnreadMap(next)
  }, [userId, chantiersKey, groupsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Charge au montage et quand les listes changent
  useEffect(() => { checkUnread() }, [checkUnread])

  // Realtime : rafraîchit les badges quand un message arrive
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('unread-watcher')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },          checkUnread)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' },     checkUnread)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, checkUnread])

  // Marque une conversation comme lue (appelé à l'ouverture)
  const markAsRead = useCallback((id: string, type: 'chantier' | 'group') => {
    localStorage.setItem(lastSeenKey(type, id), new Date().toISOString())
    setUnreadMap(prev => ({ ...prev, [id]: 0 }))
  }, [])

  // Nombre total de non-lus (chantiers + groupes, hors global)
  const totalUnread = useMemo(
    () => Object.values(unreadMap).reduce((s, n) => s + n, 0),
    [unreadMap],
  )

  return { unreadMap, markAsRead, totalUnread, checkUnread }
}
