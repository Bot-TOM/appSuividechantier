import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/types'

export function useMessages(chantierId: string, userId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(full_name), message_reactions(*), message_reads(user_id, read_at)')
      .eq('chantier_id', chantierId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data as ChatMessage[])
    setLoading(false)
  }, [chantierId])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${chantierId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chantier_id=eq.${chantierId}` }, fetchMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, fetchMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, fetchMessages)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [chantierId, fetchMessages])

  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    await supabase.from('messages').insert({
      chantier_id: chantierId,
      user_id: userId,
      content,
      reply_to_id: replyToId ?? null,
    })
  }, [chantierId, userId])

  const sendFile = useCallback(async (file: File, replyToId?: string) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${chantierId}/${userId}/${Date.now()}.${ext}`
      const { data: upload, error } = await supabase.storage.from('chat-files').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(upload.path)
      await supabase.from('messages').insert({
        chantier_id: chantierId,
        user_id: userId,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type.startsWith('image/') ? 'image' : 'document',
        reply_to_id: replyToId ?? null,
      })
    } finally {
      setUploading(false)
    }
  }, [chantierId, userId])

  const deleteMessage = useCallback(async (id: string) => {
    await supabase.from('messages').delete().eq('id', id)
  }, [])

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const { data } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle()
    if (data) {
      await supabase.from('message_reactions').delete().eq('id', data.id)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji })
    }
  }, [userId])

  const markAllRead = useCallback(async () => {
    if (messages.length === 0) return
    const unread = messages.filter(m =>
      m.user_id !== userId &&
      !(m.message_reads ?? []).some(r => r.user_id === userId)
    )
    if (unread.length === 0) return
    await supabase.from('message_reads').upsert(
      unread.map(m => ({ message_id: m.id, user_id: userId })),
      { onConflict: 'message_id,user_id' }
    )
  }, [messages, userId])

  return { messages, loading, uploading, sendMessage, sendFile, deleteMessage, toggleReaction, markAllRead }
}
