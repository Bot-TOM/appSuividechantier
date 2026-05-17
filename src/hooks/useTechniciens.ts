import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserProfile } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

export function useTechniciens() {
  const { profile } = useAuth()
  const [techniciens, setTechniciens] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profile?.entreprise_id) {
      setTechniciens([])
      setLoading(false)
      return
    }
    setLoading(true)
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
