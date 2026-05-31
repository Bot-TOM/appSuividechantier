import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ── Clés localStorage ─────────────────────────────────────────────────────────
const lastSeenKey = (type: 'chantier' | 'group', id: string) =>
  `chat-last-seen-${type}-${id}`

export interface LastMessagePreview {
  text: string       // contenu tronqué ou "📎 Fichier" / "🎤 Message vocal"
  time: string       // ISO timestamp
  isOwn: boolean
}

// ── Horodatage relatif ────────────────────────────────────────────────────────
export function relativeTime(iso: string): string {
  if (!iso || iso === '1970-01-01') return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  const h    = Math.floor(diff / 3_600_000)
  const d    = Math.floor(diff / 86_400_000)
  if (min < 1)  return 'maintenant'
  if (min < 60) return `${min} min`
  if (h   < 24) return `${h} h`
  if (d   < 7)  return `${d} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function useChatUnread(
  userId: string,
  chantierIds: string[],
  groupIds: string[],
) {
  const [unreadMap,       setUnreadMap]       = useState<Record<string, number>>({})
  const [lastActivityMap, setLastActivityMap] = useState<Record<string, string>>({})
  const [lastMsgMap,      setLastMsgMap]      = useState<Record<string, LastMessagePreview>>({})

  const chantiersKey = useMemo(() => chantierIds.join(','), [chantierIds])
  const groupsKey    = useMemo(() => groupIds.join(','),    [groupIds])

  const checkUnread = useCallback(async () => {
    if (!userId) return
    const nextUnread:   Record<string, number>              = {}
    const nextActivity: Record<string, string>              = {}
    const nextLastMsg:  Record<string, LastMessagePreview>  = {}

    // ── Chantiers ──────────────────────────────────────────────────────────────
    if (chantierIds.length > 0) {
      const { data } = await supabase
        .from('messages')
        .select('chantier_id, created_at, user_id, content, file_type')
        .in('chantier_id', chantierIds)
        .order('created_at', { ascending: false })

      for (const cId of chantierIds) {
        const msgs     = (data ?? []).filter(m => m.chantier_id === cId)
        const lastSeen = localStorage.getItem(lastSeenKey('chantier', cId)) ?? '1970-01-01'
        const last     = msgs[0]

        nextActivity[cId] = last?.created_at ?? '1970-01-01'
        nextUnread[cId]   = msgs.filter(
          m => m.user_id !== userId && m.created_at > lastSeen
        ).length

        if (last) {
          nextLastMsg[cId] = {
            text:  msgPreviewText(last.content, last.file_type),
            time:  last.created_at,
            isOwn: last.user_id === userId,
          }
        }
      }
    }

    // ── Groupes ────────────────────────────────────────────────────────────────
    if (groupIds.length > 0) {
      const { data } = await supabase
        .from('group_messages')
        .select('group_id, created_at, user_id, content, file_type')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })

      for (const gId of groupIds) {
        const msgs     = (data ?? []).filter(m => m.group_id === gId)
        const lastSeen = localStorage.getItem(lastSeenKey('group', gId)) ?? '1970-01-01'
        const last     = msgs[0]

        nextActivity[gId] = last?.created_at ?? '1970-01-01'
        nextUnread[gId]   = msgs.filter(
          m => m.user_id !== userId && m.created_at > lastSeen
        ).length

        if (last) {
          nextLastMsg[gId] = {
            text:  msgPreviewText(last.content, last.file_type),
            time:  last.created_at,
            isOwn: last.user_id === userId,
          }
        }
      }
    }

    setUnreadMap(nextUnread)
    setLastActivityMap(nextActivity)
    setLastMsgMap(nextLastMsg)
  }, [userId, chantiersKey, groupsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync DB → localStorage au montage (restaure l'état lu cross-device / après reconnexion)
  useEffect(() => {
    if (!userId) return
    supabase
      .from('chat_last_seen')
      .select('conv_type, conv_id, last_seen_at')
      .eq('user_id', userId)
      .in('conv_type', ['chantier', 'group'])
      .then(({ data }) => {
        if (!data?.length) return
        let changed = false
        for (const row of data) {
          const key   = lastSeenKey(row.conv_type as 'chantier' | 'group', row.conv_id)
          const local = localStorage.getItem(key)
          if (!local || row.last_seen_at > local) {
            localStorage.setItem(key, row.last_seen_at)
            changed = true
          }
        }
        if (changed) checkUnread()
      })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { checkUnread() }, [checkUnread])

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
    const now = new Date().toISOString()
    localStorage.setItem(lastSeenKey(type, id), now)
    setUnreadMap(prev => ({ ...prev, [id]: 0 }))
    // Notifie useNavChatBadge (et tout autre listener) que l'état de lecture a changé
    window.dispatchEvent(new CustomEvent('chat-read'))
    // Persiste en DB pour la synchronisation cross-device / cross-session
    supabase.from('chat_last_seen').upsert(
      { user_id: userId, conv_type: type, conv_id: id, last_seen_at: now },
      { onConflict: 'user_id,conv_type,conv_id' },
    ).then(null, (e: unknown) => console.error('[chat-last-seen] upsert:', e))
  }, [userId])

  const totalUnread = useMemo(
    () => Object.values(unreadMap).reduce((s, n) => s + n, 0),
    [unreadMap],
  )

  return { unreadMap, lastActivityMap, lastMsgMap, markAsRead, totalUnread, checkUnread }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function msgPreviewText(content: string | null, fileType: string | null): string {
  if (content) return content.slice(0, 60)
  if (fileType === 'image') return '📷 Photo'
  if (fileType === 'audio') return '🎤 Message vocal'
  if (fileType === 'document') return '📎 Fichier'
  return '📎 Fichier'
}
