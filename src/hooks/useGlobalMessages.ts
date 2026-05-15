import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface GlobalMessage {
  id: string
  user_id: string
  entreprise_id: string | null
  content: string | null
  file_url: string | null
  file_name: string | null
  file_type: 'image' | 'audio' | 'document' | null
  reply_to_id: string | null
  created_at: string
  profiles?: {
    full_name?: string | null
    avatar_url?: string | null
    poste?: string | null
    role?: string | null
  } | null
  global_message_reactions?: { id: string; emoji: string; user_id: string }[]
}

export function useGlobalMessages(userId: string, entrepriseId: string) {
  const [messages, setMessages]   = useState<GlobalMessage[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const msgsRef = useRef<GlobalMessage[]>([])

  const fetchMessages = useCallback(async () => {
    if (!entrepriseId) return          // pas d'entreprise connue → rien à charger
    const { data, error } = await supabase
      .from('global_messages')
      .select('*, profiles!global_messages_user_id_fkey(full_name, avatar_url, poste, role), global_message_reactions(*)')
      .eq('entreprise_id', entrepriseId)
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) console.error('[global-chat] fetchMessages:', error)
    if (data) {
      msgsRef.current = data as GlobalMessage[]
      setMessages(data as GlobalMessage[])
    }
    setLoading(false)
  }, [entrepriseId])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  useEffect(() => {
    if (!entrepriseId) return
    // Canal isolé par entreprise pour le realtime
    const channelName = `global-chat-${entrepriseId}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'global_messages',
        filter: `entreprise_id=eq.${entrepriseId}`,
      }, fetchMessages)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'global_message_reactions',
      }, fetchMessages)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchMessages, entrepriseId])

  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    if (!entrepriseId) return
    const { data, error } = await supabase.from('global_messages').insert({
      user_id:       userId,
      entreprise_id: entrepriseId,
      content,
      reply_to_id:   replyToId ?? null,
    }).select().single()
    if (error) { console.error('[global-chat] sendMessage:', error); return }
    // Notif push à tous les membres de l'entreprise (sauf l'expéditeur)
    supabase.functions.invoke('send-push', {
      body: { table: 'global_messages', record: data },
    }).catch(() => {})
  }, [userId, entrepriseId])

  const sendFile = useCallback(async (file: File, replyToId?: string) => {
    if (!entrepriseId) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `global/${entrepriseId}/${userId}/${Date.now()}.${ext}`
      const { data: upload, error } = await supabase.storage.from('chat-files').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(upload.path)
      const { data: fileData, error: insertErr } = await supabase.from('global_messages').insert({
        user_id:       userId,
        entreprise_id: entrepriseId,
        file_url:      publicUrl,
        file_name:     file.name,
        file_type:     file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'document',
        reply_to_id:   replyToId ?? null,
      }).select().single()
      if (insertErr) { console.error('[global-chat] sendFile insert:', insertErr) }
      else {
        supabase.functions.invoke('send-push', {
          body: { table: 'global_messages', record: fileData },
        }).catch(() => {})
      }
    } finally {
      setUploading(false)
    }
  }, [userId, entrepriseId])

  const deleteMessage = useCallback(async (id: string) => {
    await supabase.from('global_messages').delete().eq('id', id)
  }, [])

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const { data } = await supabase
      .from('global_message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle()
    if (data) {
      await supabase.from('global_message_reactions').delete().eq('id', data.id)
    } else {
      await supabase.from('global_message_reactions').insert({ message_id: messageId, user_id: userId, emoji })
    }
  }, [userId])

  // Compteur non-lus : messages depuis la dernière visite
  // Clé localStorage scoped par entreprise pour éviter les croisements
  const storageKey = `global-chat-last-seen-${entrepriseId}`

  const getLastSeen = useCallback(() => {
    return localStorage.getItem(storageKey) ?? '1970-01-01'
  }, [storageKey])

  const markAllRead = useCallback(() => {
    localStorage.setItem(storageKey, new Date().toISOString())
  }, [storageKey])

  const unreadCount = messages.filter(
    m => m.user_id !== userId && m.created_at > getLastSeen()
  ).length

  return { messages, loading, uploading, sendMessage, sendFile, deleteMessage, toggleReaction, markAllRead, unreadCount }
}
