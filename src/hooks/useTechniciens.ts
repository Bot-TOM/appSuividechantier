import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserProfile } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

export function useTechniciens() {
  const { profile } = useAuth()
  const [techniciens, setTechniciens] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    if (!profile.entreprise_id) { setLoading(false); return }
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'technicien')
      .eq('entreprise_id', profile.entreprise_id)
      .then(({ data }) => {
        setTechniciens(data ?? [])
        setLoading(false)
      })
  }, [profile?.entreprise_id])

  return { techniciens, loading }
}
