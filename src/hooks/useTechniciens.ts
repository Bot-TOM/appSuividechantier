import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserProfile } from '@/types'

export function useTechniciens() {
  const [techniciens, setTechniciens] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'technicien')
      .then(({ data }) => {
        setTechniciens(data ?? [])
        setLoading(false)
      })
  }, [])

  return { techniciens, loading }
}
