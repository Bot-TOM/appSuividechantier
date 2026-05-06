import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Notification {
  id: string
  chantier_id: string
  type: 'anomalie' | 'rapport' | 'bloque' | 'termine'
  message: string
  lu: boolean
  created_at: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data ?? [])
  }, [])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const channel = supabase.channel('notifications-manager')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  const unreadCount = notifications.filter(n => !n.lu).length

  async function markAllRead() {
    const unread = notifications.filter(n => !n.lu).map(n => n.id)
    if (!unread.length) return
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
    await supabase.from('notifications').update({ lu: true }).in('id', unread)
  }

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
  }

  async function clearAll() {
    if (notifications.length === 0) return
    const ids = notifications.map(n => n.id)
    setNotifications([])
    await supabase.from('notifications').delete().in('id', ids)
  }

  return { notifications, unreadCount, markAllRead, markRead, clearAll }
}
