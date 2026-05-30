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
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, fetchMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_message_reactions' }, fetchMessages)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [groupId, fetchMessages])

  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: userId,
      content,
      reply_to_id: replyToId ?? null,
    })
  }, [groupId, userId])

  const sendFile = useCallback(async (file: File, replyToId?: string) => {
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `groups/${groupId}/${userId}/${Date.now()}.${ext}`
      const { data: upload, error } = await supabase.storage.from('chat-files').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(upload.path)
      await supabase.from('group_messages').insert({
        group_id:   groupId,
        user_id:    userId,
        file_url:   publicUrl,
        file_name:  file.name,
        file_type:  file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'document',
        reply_to_id: replyToId ?? null,
      })
    } finally {
      setUploading(false)
    }
  }, [groupId, userId])

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
