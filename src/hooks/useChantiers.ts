import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Chantier } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from './usePermissions'

export function useChantiers() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChantiers = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('chantiers').select('*').order('created_at', { ascending: false })

    if (profile?.role === 'technicien' && !can('voir_tous_chantiers')) {
      // Récupère uniquement les chantiers assignés à ce technicien
      const { data: assignations } = await supabase
        .from('chantier_techniciens')
        .select('chantier_id')
        .eq('technicien_id', profile.id)
      const ids = assignations?.map(a => a.chantier_id) ?? []
      if (ids.length === 0) { setChantiers([]); setLoading(false); return }
      query = query.in('id', ids)
    }

    const { data } = await query
    setChantiers(data ?? [])
    setLoading(false)
  }, [profile, can])

  useEffect(() => {
    if (profile) fetchChantiers()
  }, [profile, fetchChantiers])

  return { chantiers, loading, refetch: fetchChantiers }
}
