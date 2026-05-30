import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { GroupMessage } from '@/types'

export function useGroupMessages(groupId: string, userId: string) {
  const [messages, setMessages]   = useState<GroupMessage[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const messagesRef = useRef<GroupMessage[]>([])

  const fetchMessages = useCallback(async () => {
    if (!groupId) return
    const { data, error } = await supabase
      .from('group_messages')
      .select('*, profiles!group_messages_user_id_fkey(full_name, avatar_url, poste, role), group_message_reactions(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
    if (error) console.error('[group-chat] fetchMessages:', error)
    if (data) {
      messagesRef.current = data as GroupMessage[]
      setMessages(data as GroupMessage[])
    }
    setLoading(false)
  }, [groupId])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  useEffect(() => {
    if (!groupId) return
    // Note: on n'utilise PAS de filtre server-side (group_id=eq.X) car
    // les postgres_changes avec filtre + RLS peuvent bloquer les événements
    // dans certaines versions de Supabase. On filtre côté client à la place.
    // Supabase Realtime avec RLS retourne payload.new = {} vide pour les tables
    // protégées → ne jamais inspecter le payload, appeler fetchMessages directement.
    // fetchMessages filtre déjà par groupId dans la requête.
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, fetchMessages)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages' }, fetchMessages)
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'group_message_reactions' }, fetchMessages)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [groupId, fetchMessages])

  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    const { data, error } = await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: userId,
      content,
      reply_to_id: replyToId ?? null,
    }).select().single()
    if (error) { console.error('[group-chat] sendMessage:', error); return }
    // Rafraîchissement immédiat + notif push aux membres du groupe
    fetchMessages()
    supabase.functions.invoke('send-push', {
      body: { table: 'group_messages', record: data },
    }).catch(() => {})
  }, [groupId, userId, fetchMessages])

  const sendFile = useCallback(async (file: File, replyToId?: string) => {
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `groups/${groupId}/${userId}/${Date.now()}.${ext}`
      const { data: upload, error } = await supabase.storage.from('chat-files').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(upload.path)
      const { data: fileData, error: insertErr } = await supabase.from('group_messages').insert({
        group_id:    groupId,
        user_id:     userId,
        file_url:    publicUrl,
        file_name:   file.name,
        file_type:   file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'document',
        reply_to_id: replyToId ?? null,
      }).select().single()
      if (!insertErr && fileData) {
        fetchMessages()
        supabase.functions.invoke('send-push', {
          body: { table: 'group_messages', record: fileData },
        }).catch(() => {})
      }
    } finally {
      setUploading(false)
    }
  }, [groupId, userId, fetchMessages])

  const deleteMessage = useCallback(async (id: string) => {
    await supabase.from('group_messages').delete().eq('id', id)
  }, [])

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const { data } = await supabase
      .from('group_message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle()
    if (data) {
      await supabase.from('group_message_reactions').delete().eq('id', data.id)
    } else {
      await supabase.from('group_message_reactions').insert({ message_id: messageId, user_id: userId, emoji })
    }
  }, [userId])

  return { messages, loading, uploading, sendMessage, sendFile, deleteMessage, toggleReaction }
}
