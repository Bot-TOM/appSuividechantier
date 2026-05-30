import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChatGroup } from '@/types'

export function useChatGroups(userId: string, entrepriseId: string) {
  const [groups, setGroups]   = useState<ChatGroup[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGroups = useCallback(async () => {
    if (!userId || !entrepriseId) return
    const { data } = await supabase
      .from('chat_groups')
      .select('*, chat_group_members(user_id, profiles(full_name, avatar_url, poste, role))')
      .eq('entreprise_id', entrepriseId)
      .order('created_at', { ascending: true })
    setGroups((data ?? []) as ChatGroup[])
    setLoading(false)
  }, [userId, entrepriseId])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  // Realtime : mise à jour quand un groupe est créé/modifié
  useEffect(() => {
    if (!entrepriseId) return
    const channel = supabase
      .channel('chat-groups-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_groups' }, fetchGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members' }, fetchGroups)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [entrepriseId, fetchGroups])

  const createGroup = useCallback(async (name: string, memberIds: string[]) => {
    // 1. Créer le groupe
    const { data: group, error } = await supabase
      .from('chat_groups')
      .insert({ name, entreprise_id: entrepriseId, created_by: userId })
      .select()
      .single()
    if (error || !group) return { error: error?.message ?? 'Erreur création groupe' }

    // 2. Ajouter le créateur + les membres choisis (créateur toujours inclus)
    const allMembers = [...new Set([userId, ...memberIds])]
    const { error: membersError } = await supabase
      .from('chat_group_members')
      .insert(allMembers.map(uid => ({ group_id: group.id, user_id: uid })))
    if (membersError) return { error: membersError.message }

    await fetchGroups()
    return { group: group as ChatGroup }
  }, [userId, entrepriseId, fetchGroups])

  const deleteGroup = useCallback(async (groupId: string) => {
    await supabase.from('chat_groups').delete().eq('id', groupId)
    await fetchGroups()
  }, [fetchGroups])

  const leaveGroup = useCallback(async (groupId: string) => {
    await supabase.from('chat_group_members').delete()
      .eq('group_id', groupId).eq('user_id', userId)
    await fetchGroups()
  }, [userId, fetchGroups])

  const addMember = useCallback(async (groupId: string, memberId: string) => {
    await supabase.from('chat_group_members').insert({ group_id: groupId, user_id: memberId })
    await fetchGroups()
  }, [fetchGroups])

  return { groups, loading, createGroup, deleteGroup, leaveGroup, addMember, refetch: fetchGroups }
}
