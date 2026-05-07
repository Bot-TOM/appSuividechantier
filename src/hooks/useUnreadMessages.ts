import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/** Retourne le nombre de messages non lus dans un chantier pour l'utilisateur courant.
 *  Se met à jour en temps réel via Supabase Realtime. */
export function useUnreadMessages(chantierId: string, userId: string) {
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!chantierId || !userId) return

    // Récupère tous les messages du chantier pas envoyés par l'utilisateur
    // avec leurs entrées message_reads pour lui
    const { data } = await supabase
      .from('messages')
      .select('id, message_reads(user_id)')
      .eq('chantier_id', chantierId)
      .neq('user_id', userId)

    if (data) {
      const count = data.filter(m =>
        !(m.message_reads as { user_id: string }[]).some(r => r.user_id === userId)
      ).length
      setUnreadCount(count)
    }
  }, [chantierId, userId])

  useEffect(() => { fetchCount() }, [fetchCount])

  useEffect(() => {
    if (!chantierId || !userId) return
    const channel = supabase
      .channel(`unread-${chantierId}-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages',       filter: `chantier_id=eq.${chantierId}` }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, fetchCount)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [chantierId, userId, fetchCount])

  return unreadCount
}
