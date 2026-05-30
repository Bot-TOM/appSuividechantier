import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/types'

export function useMessages(chantierId: string, userId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const messagesRef = useRef<ChatMessage[]>([])
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles!messages_user_id_fkey(full_name, avatar_url, poste, role), message_reactions(*), message_reads(user_id, read_at, profiles(full_name))')
      .eq('chantier_id', chantierId)
      .order('created_at', { ascending: true })
    if (error) console.error('[chat] fetchMessages:', error)
    if (data) {
      messagesRef.current = data as ChatMessage[]
      setMessages(data as ChatMessage[])
    }
    setLoading(false)
  }, [chantierId])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${chantierId}`)
      .on('broadcast',        { event: 'refresh' }, fetchMessages)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchMessages)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, fetchMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, fetchMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' },     fetchMessages)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channelRef.current = channel
      })

    const poll = setInterval(fetchMessages, 5000)

    return () => { clearInterval(poll); supabase.removeChannel(channel); channelRef.current = null }
  }, [chantierId, fetchMessages])

  const broadcastRefresh = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'refresh', payload: {} }).catch(() => {})
  }, [])

  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    const { data, error } = await supabase.from('messages').insert({
      chantier_id: chantierId,
      user_id: userId,
      content,
      reply_to_id: replyToId ?? null,
    }).select().single()
    if (error) { console.error('[chat] sendMessage:', error); return }
    fetchMessages()
    broadcastRefresh()
    supabase.functions.invoke('send-push', {
      body: { table: 'messages', record: data },
    }).catch(() => {})
  }, [chantierId, userId, fetchMessages, broadcastRefresh])

  const sendFile = useCallback(async (file: File, replyToId?: string) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${chantierId}/${userId}/${Date.now()}.${ext}`
      const { data: upload, error } = await supabase.storage.from('chat-files').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(upload.path)
      const { data: fileData, error: insertErr } = await supabase.from('messages').insert({
        chantier_id: chantierId,
        user_id: userId,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'document',
        reply_to_id: replyToId ?? null,
      }).select().single()
      if (insertErr) { console.error('[chat] sendFile insert:', insertErr) }
      else {
        fetchMessages()
        broadcastRefresh()
        supabase.functions.invoke('send-push', {
          body: { table: 'messages', record: fileData },
        }).catch(() => {})
      }
    } finally {
      setUploading(false)
    }
  }, [chantierId, userId, fetchMessages])

  const deleteMessage = useCallback(async (id: string) => {
    await supabase.from('messages').delete().eq('id', id)
    broadcastRefresh()
  }, [broadcastRefresh])

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

  // Utilise une ref pour éviter la boucle infinie (messages → markAllRead → fetch → messages → ...)
  const markAllRead = useCallback(async () => {
    const current = messagesRef.current
    if (current.length === 0) return
    const unread = current.filter(m =>
      m.user_id !== userId &&
      !(m.message_reads ?? []).some(r => r.user_id === userId)
    )
    if (unread.length === 0) return
    await supabase.from('message_reads').upsert(
      unread.map(m => ({ message_id: m.id, user_id: userId })),
      { onConflict: 'message_id,user_id' }
    )
  }, [userId])

  return { messages, loading, uploading, sendMessage, sendFile, deleteMessage, toggleReaction, markAllRead }
}
