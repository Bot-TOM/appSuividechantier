import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Chantier } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

export function useChantiers() {
  const { profile } = useAuth()
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchChantiers() {
    setLoading(true)
    let query = supabase.from('chantiers').select('*').order('created_at', { ascending: false })

    if (profile?.role === 'technicien') {
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
  }

  useEffect(() => {
    if (profile) fetchChantiers()
  }, [profile])

  return { chantiers, loading, refetch: fetchChantiers }
}
