import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Calcule le nombre total de messages non lus sur TOUTES les conversations
 * (chat Équipe + chantiers + groupes + DMs) pour afficher le badge sur
 * l'onglet Chat de la navigation principale.
 *
 * Utilise les mêmes clés localStorage que useChatUnread et useGlobalMessages
 * pour rester cohérent avec l'état "lu" géré dans ChatLayout.
 */
export function useNavChatBadge(userId: string, entrepriseId: string) {
  const [total, setTotal] = useState(0)

  const compute = useCallback(async () => {
    if (!userId || !entrepriseId) return

    // ── 1. Récupère les IDs des conversations accessibles ─────────────────
    const [{ data: chantierRows }, { data: groupRows }] = await Promise.all([
      supabase.from('chantiers').select('id').eq('entreprise_id', entrepriseId),
      supabase.from('chat_group_members').select('group_id').eq('user_id', userId),
    ])

    const chantierIds = (chantierRows ?? []).map(r => r.id as string)
    const groupIds    = (groupRows    ?? []).map(r => r.group_id as string)

    let count = 0

    // ── 2. Chat Équipe (global) ────────────────────────────────────────────
    const globalLastSeen = localStorage.getItem(`global-chat-last-seen-${entrepriseId}`) ?? '1970-01-01'
    const { count: globalCount } = await supabase
      .from('global_messages')
      .select('id', { count: 'exact', head: true })
      .eq('entreprise_id', entrepriseId)
      .neq('user_id', userId)
      .gt('created_at', globalLastSeen)
    count += globalCount ?? 0

    // ── 3. Chantiers ──────────────────────────────────────────────────────
    if (chantierIds.length > 0) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('chantier_id, created_at')
        .in('chantier_id', chantierIds)
        .neq('user_id', userId)

      for (const cId of chantierIds) {
        const lastSeen = localStorage.getItem(`chat-last-seen-chantier-${cId}`) ?? '1970-01-01'
        count += (msgs ?? []).filter(m => m.chantier_id === cId && m.created_at > lastSeen).length
      }
    }

    // ── 4. Groupes & DMs ──────────────────────────────────────────────────
    if (groupIds.length > 0) {
      const { data: gmsgs } = await supabase
        .from('group_messages')
        .select('group_id, created_at')
        .in('group_id', groupIds)
        .neq('user_id', userId)

      for (const gId of groupIds) {
        const lastSeen = localStorage.getItem(`chat-last-seen-group-${gId}`) ?? '1970-01-01'
        count += (gmsgs ?? []).filter(m => m.group_id === gId && m.created_at > lastSeen).length
      }
    }

    setTotal(count)
  }, [userId, entrepriseId])

  // Calcul initial — sync DB → localStorage d'abord pour restaurer l'état cross-device
  useEffect(() => {
    if (!userId) return
    supabase
      .from('chat_last_seen')
      .select('conv_type, conv_id, last_seen_at')
      .eq('user_id', userId)
      .then(({ data }) => {
        for (const row of (data ?? [])) {
          const key = row.conv_type === 'global'
            ? `global-chat-last-seen-${row.conv_id}`
            : `chat-last-seen-${row.conv_type}-${row.conv_id}`
          const local = localStorage.getItem(key)
          if (!local || row.last_seen_at > local) {
            localStorage.setItem(key, row.last_seen_at)
          }
        }
        compute()
      })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling 30 s — filet de sécurité si le realtime rate un event
  useEffect(() => {
    if (!userId || !entrepriseId) return
    const poll = setInterval(compute, 30_000)
    return () => clearInterval(poll)
  }, [userId, entrepriseId, compute])

  // Realtime — recalcul immédiat à chaque nouveau message
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`nav-badge-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },        compute)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' },  compute)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' }, compute)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, compute])

  // Recalcule quand l'utilisateur revient sur la page (visibilité)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') compute() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [compute])

  // Recalcule immédiatement quand une conversation est marquée comme lue
  // (événement dispatché par markAsRead dans useChatUnread et markAllRead dans useGlobalMessages)
  useEffect(() => {
    window.addEventListener('chat-read', compute)
    return () => window.removeEventListener('chat-read', compute)
  }, [compute])

  return total
}
