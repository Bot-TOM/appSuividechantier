import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserProfile } from '@/types'

export function useChantierTechniciens(chantierId: string) {
  const [techniciens, setTechniciens] = useState<UserProfile[]>([])
  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!chantierId) return
    supabase
      .from('chantier_techniciens')
      .select('technicien_id, profiles(*)')
      .eq('chantier_id', chantierId)
      .then(({ data }) => {
        const profiles = (data ?? []).map((d: any) => d.profiles).filter(Boolean)
        setTechniciens(profiles)
        setAssignedIds(profiles.map((p: UserProfile) => p.id))
        setLoading(false)
      })
  }, [chantierId])

  return { techniciens, assignedIds, loading }
}
