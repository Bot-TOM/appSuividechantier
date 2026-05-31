import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { VisiteTechnique, VTType } from '@/types'

type ProfileRow = { id: string; full_name: string; avatar_url?: string | null }

// Récupère les profiles pour une liste d'IDs (sans join SQL pour éviter
// l'ambiguïté PostgREST quand plusieurs FK pointent vers la même table)
async function fetchProfiles(ids: string[]): Promise<Record<string, ProfileRow>> {
  if (ids.length === 0) return {}
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', ids)
  if (!data) return {}
  return Object.fromEntries(data.map(p => [p.id, p as ProfileRow]))
}

// ─── Hook liste ───────────────────────────────────────────────────────────────
export function useVisitesTechniques() {
  const [vts, setVts] = useState<VisiteTechnique[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('visites_techniques')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !data) {
      setLoading(false)
      return
    }

    // Récupérer les profils séparément (évite l'ambiguïté FK PostgREST)
    const techIds = [...new Set(data.map(v => v.technicien_id).filter(Boolean))]
    const profilesMap = await fetchProfiles(techIds)

    const merged: VisiteTechnique[] = data.map(vt => ({
      ...(vt as VisiteTechnique),
      profiles: profilesMap[vt.technicien_id] ?? null,
    }))

    setVts(merged)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { vts, loading, refetch: fetchAll }
}

// ─── Hook détail ──────────────────────────────────────────────────────────────
export function useVisiteTechnique(id: string) {
  const [vt, setVt] = useState<VisiteTechnique | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOne = useCallback(async () => {
    const { data, error } = await supabase
      .from('visites_techniques')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      setVt(null)
      setLoading(false)
      return
    }

    const vt = data as VisiteTechnique

    // Récupérer le profil du technicien séparément
    const profilesMap = await fetchProfiles([vt.technicien_id])

    setVt({ ...vt, profiles: profilesMap[vt.technicien_id] ?? null })
    setLoading(false)
  }, [id])

  useEffect(() => { fetchOne() }, [fetchOne])

  async function updateData(updates: Partial<VisiteTechnique> & { data?: Record<string, unknown> }) {
    await supabase.from('visites_techniques').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    fetchOne()
  }

  async function valider(valideurId: string) {
    await supabase.from('visites_techniques').update({
      statut: 'valide',
      valide_par: valideurId,
      valide_le: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    fetchOne()
  }

  async function deleteVT() {
    return supabase.from('visites_techniques').delete().eq('id', id)
  }

  return { vt, loading, updateData, valider, deleteVT, refetch: fetchOne }
}

// ─── Créer une VT ─────────────────────────────────────────────────────────────
export async function createVisiteTechnique(
  type: VTType,
  technicienId: string,
  templateId?: string | null,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('visites_techniques')
    .insert({
      type,
      technicien_id: technicienId,
      statut: 'brouillon',
      data: {},
      ...(templateId ? { template_id: templateId } : {}),
    })
    .select('id')
    .single()
  if (error || !data) return null
  return data.id
}
