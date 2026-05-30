import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { GroupMessage } from '@/types'

export function useGroupMessages(groupId: string, userId: string) {
  const [messages, setMessages]   = useState<GroupMessage[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const messagesRef = useRef<GroupMessage[]>([])
  // Ref vers le canal Realtime pour pouvoir broadcaster depuis sendMessage/sendFile
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null)

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

    // ── Stratégie double : Broadcast + postgres_changes (fallback) ────────────
    //
    // postgres_changes seul est peu fiable avec RLS (payload.new vide, coupures
    // réseau mobile, WebSocket suspendu en background).
    //
    // Broadcast = message WebSocket direct entre clients, sans WAL ni RLS.
    // L'expéditeur appelle channel.send() après chaque action, tous les
    // abonnés reçoivent l'événement et rechargent.
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      // 1. Broadcast : notification directe expéditeur → destinataires
      .on('broadcast', { event: 'refresh' }, fetchMessages)
      // 2. postgres_changes : fallback si le broadcast échoue
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, fetchMessages)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages' }, fetchMessages)
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'group_message_reactions' }, fetchMessages)
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [groupId, fetchMessages])

  /** Envoie un broadcast 'refresh' à tous les membres du groupe */
  const broadcastRefresh = useCallback(() => {
    channelRef.current?.send({
      type:    'broadcast',
      event:   'refresh',
      payload: {},
    }).catch(() => {})
  }, [])

  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    const { data, error } = await supabase.from('group_messages').insert({
      group_id:    groupId,
      user_id:     userId,
      content,
      reply_to_id: replyToId ?? null,
    }).select().single()
    if (error) { console.error('[group-chat] sendMessage:', error); return }
    fetchMessages()    // mise à jour immédiate côté expéditeur
    broadcastRefresh() // notification temps réel côté destinataires
    supabase.functions.invoke('send-push', {
      body: { table: 'group_messages', record: data },
    }).catch(() => {})
  }, [groupId, userId, fetchMessages, broadcastRefresh])

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
        broadcastRefresh()
        supabase.functions.invoke('send-push', {
          body: { table: 'group_messages', record: fileData },
        }).catch(() => {})
      }
    } finally {
      setUploading(false)
    }
  }, [groupId, userId, fetchMessages, broadcastRefresh])

  const deleteMessage = useCallback(async (id: string) => {
    await supabase.from('group_messages').delete().eq('id', id)
    fetchMessages()
    broadcastRefresh()
  }, [fetchMessages, broadcastRefresh])

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
    broadcastRefresh()
  }, [userId, broadcastRefresh])

  return { messages, loading, uploading, sendMessage, sendFile, deleteMessage, toggleReaction }
}
