import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Chantier } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from './usePermissions'

export function useChantiers(entrepriseId?: string) {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [loading, setLoading] = useState(false)

  const fetchChantiers = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('chantiers').select('*').order('created_at', { ascending: false })

      // Filtre admin par entreprise (sélecteur d'entreprise)
      if (entrepriseId) query = query.eq('entreprise_id', entrepriseId)

      if (profile?.role === 'technicien' && !can('voir_tous_chantiers')) {
        // Récupère uniquement les chantiers assignés à ce technicien
        const { data: assignations } = await supabase
          .from('chantier_techniciens')
          .select('chantier_id')
          .eq('technicien_id', profile.id)
        const ids = assignations?.map(a => a.chantier_id) ?? []
        if (ids.length === 0) { setChantiers([]); return }
        query = query.in('id', ids)
      }

      const { data, error } = await query
      if (error) console.error('[useChantiers]', error.message)
      setChantiers(data ?? [])
    } catch (e) {
      console.error('[useChantiers] unexpected error:', e)
      setChantiers([])
    } finally {
      setLoading(false)
    }
  }, [profile, can, entrepriseId])

  useEffect(() => {
    if (profile) fetchChantiers()
  }, [profile, fetchChantiers])

  return { chantiers, loading, refetch: fetchChantiers }
}
