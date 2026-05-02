import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Anomalie } from '@/types'

export function useAnomalies(chantierId?: string) {
  const [anomalies, setAnomalies] = useState<Anomalie[]>([])
  const [loading, setLoading]     = useState(true)

  const fetch = useCallback(async () => {
    let query = supabase
      .from('anomalies')
      .select('*, profiles(full_name), chantiers(nom)')
      .order('created_at', { ascending: false })

    if (chantierId) query = query.eq('chantier_id', chantierId)

    const { data } = await query
    setAnomalies(data ?? [])
    setLoading(false)
  }, [chantierId])

  useEffect(() => { fetch() }, [fetch])

  // Temps réel
  useEffect(() => {
    const channel = chantierId
      ? supabase.channel(`anomalies-${chantierId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'anomalies', filter: `chantier_id=eq.${chantierId}` }, fetch)
      : supabase.channel('anomalies-global')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'anomalies' }, fetch)

    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [chantierId, fetch])

  async function updateStatut(id: string, statut: Anomalie['statut']) {
    await supabase.from('anomalies').update({ statut, updated_at: new Date().toISOString() }).eq('id', id)
    await fetch()
  }

  return { anomalies, loading, refetch: fetch, updateStatut }
}
