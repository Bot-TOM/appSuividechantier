import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChatGroup } from '@/types'

export function useChatGroups(userId: string, entrepriseId: string) {
  const [groups, setGroups]   = useState<ChatGroup[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGroups = useCallback(async () => {
    if (!userId || !entrepriseId) return
    const { data, error } = await supabase
      .from('chat_groups')
      .select('*, members:chat_group_members(user_id, profiles(full_name, avatar_url, poste, role))')
      .eq('entreprise_id', entrepriseId)
      .order('created_at', { ascending: true })
    if (error) console.error('[useChatGroups] fetchGroups error:', error)
    else setGroups((data ?? []) as ChatGroup[])
    setLoading(false)
  }, [userId, entrepriseId])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  // Realtime : mise à jour quand un groupe est créé/modifié
  useEffect(() => {
    if (!entrepriseId) return
    const channel = supabase
      .channel(`chat-groups-list-${entrepriseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_groups' }, fetchGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members' }, fetchGroups)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [entrepriseId, fetchGroups])

  // Polling 15 s — filet de sécurité si le réaltime manque un événement (mobile, réseau instable)
  useEffect(() => {
    if (!userId || !entrepriseId) return
    const poll = setInterval(fetchGroups, 15_000)
    return () => clearInterval(poll)
  }, [userId, entrepriseId, fetchGroups])

  /** Crée un groupe normal.
   *  Utilise un UUID généré côté client pour éviter le .select() après INSERT
   *  (contournement des cas où le SELECT RLS ne renvoie pas la ligne immédiatement). */
  const createGroup = useCallback(async (name: string, memberIds: string[]) => {
    const newId = crypto.randomUUID()

    const { error } = await supabase
      .from('chat_groups')
      .insert({ id: newId, name, entreprise_id: entrepriseId, created_by: userId })
    if (error) {
      console.error('[createGroup] insert error:', error)
      return { error: error.message }
    }

    const allMembers = [...new Set([userId, ...memberIds])]
    const { error: membersError } = await supabase
      .from('chat_group_members')
      .insert(allMembers.map(uid => ({ group_id: newId, user_id: uid })))
    if (membersError) {
      console.error('[createGroup] members error:', membersError)
      return { error: membersError.message }
    }

    // Mise à jour optimiste : on ajoute le groupe minimal à l'état local
    const optimistic: ChatGroup = {
      id: newId, name, entreprise_id: entrepriseId, created_by: userId,
      created_at: new Date().toISOString(), is_dm: false, members: [],
    }
    setGroups(prev => [...prev, optimistic])

    // Refetch en arrière-plan pour avoir les membres complets
    fetchGroups()

    return { group: optimistic }
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

  /** Crée (ou retrouve) un DM avec un autre utilisateur.
   *  UUID généré côté client → pas de .select() après INSERT. */
  const createDM = useCallback(async (otherUserId: string): Promise<{ group: ChatGroup | null; error?: string }> => {
    // Vérifie si un DM existe déjà
    const existing = groups.find(g =>
      g.is_dm === true &&
      (g.members ?? []).some(m => m.user_id === otherUserId)
    )
    if (existing) return { group: existing }

    const newId = crypto.randomUUID()

    const { error: groupError } = await supabase
      .from('chat_groups')
      .insert({ id: newId, name: '', entreprise_id: entrepriseId, created_by: userId, is_dm: true })
    if (groupError) {
      console.error('[createDM] group insert error:', groupError)
      return { group: null, error: groupError.message }
    }

    const { error: membersError } = await supabase
      .from('chat_group_members')
      .insert([
        { group_id: newId, user_id: userId },
        { group_id: newId, user_id: otherUserId },
      ])
    if (membersError) {
      console.error('[createDM] members insert error:', membersError)
      // Nettoyage best-effort
      await supabase.from('chat_groups').delete().eq('id', newId)
      return { group: null, error: membersError.message }
    }

    // Mise à jour optimiste : conversation disponible immédiatement
    const optimistic: ChatGroup = {
      id: newId, name: '', entreprise_id: entrepriseId, created_by: userId,
      created_at: new Date().toISOString(), is_dm: true, members: [],
    }
    setGroups(prev => [...prev, optimistic])

    // Refetch en arrière-plan pour avoir le nom + avatar de l'autre membre
    fetchGroups()

    // Notif push au destinataire pour qu'il sache qu'une conversation a été ouverte
    supabase.functions.invoke('send-push', {
      body: { table: 'new_dm', record: { group_id: newId, sender_id: userId, recipient_id: otherUserId } },
    }).catch(() => {})

    return { group: optimistic }
  }, [userId, entrepriseId, groups, fetchGroups])

  return { groups, loading, createGroup, deleteGroup, leaveGroup, addMember, createDM, refetch: fetchGroups }
}
