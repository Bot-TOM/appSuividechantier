import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { VisiteTechnique, VTType } from '@/types'

// Hook liste
export function useVisitesTechniques() {
  const [vts, setVts] = useState<VisiteTechnique[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const { data } = await supabase
      .from('visites_techniques')
      .select('*, profiles(full_name, avatar_url)')
      .order('created_at', { ascending: false })
    setVts((data ?? []) as VisiteTechnique[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { vts, loading, refetch: fetchAll }
}

// Hook détail
export function useVisiteTechnique(id: string) {
  const [vt, setVt] = useState<VisiteTechnique | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('visites_techniques')
      .select('*, profiles(full_name, avatar_url)')
      .eq('id', id)
      .single()
    setVt(data as VisiteTechnique | null)
    setLoading(false)
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  async function updateData(updates: Partial<VisiteTechnique> & { data?: Record<string, unknown> }) {
    await supabase.from('visites_techniques').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    fetch()
  }

  async function valider(valideurId: string) {
    await supabase.from('visites_techniques').update({
      statut: 'valide',
      valide_par: valideurId,
      valide_le: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    fetch()
  }

  async function deleteVT() {
    return supabase.from('visites_techniques').delete().eq('id', id)
  }

  return { vt, loading, updateData, valider, deleteVT, refetch: fetch }
}

// Créer une VT
export async function createVisiteTechnique(type: VTType, technicienId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('visites_techniques')
    .insert({ type, technicien_id: technicienId, statut: 'brouillon', data: {} })
    .select('id')
    .single()
  if (error || !data) return null
  return data.id
}
