import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Chantier, Etape, EtapePhoto, Note } from '@/types'

export function useChantierDetail(chantierId: string) {
  const [chantier, setChantier]   = useState<Chantier | null>(null)
  const [etapes, setEtapes]       = useState<Etape[]>([])
  const [notes, setNotes]         = useState<Note[]>([])
  const [photos, setPhotos]       = useState<Record<string, EtapePhoto[]>>({})
  const [loading, setLoading]     = useState(true)

  const fetchAll = useCallback(async () => {
    const [{ data: c }, { data: e }, { data: n }, { data: p }] = await Promise.all([
      supabase.from('chantiers').select('*').eq('id', chantierId).single(),
      supabase.from('etapes').select('*').eq('chantier_id', chantierId).order('ordre'),
      supabase.from('notes').select('*, profiles(full_name)').eq('chantier_id', chantierId).order('created_at', { ascending: false }),
      supabase.from('etape_photos').select('*').eq('chantier_id', chantierId).order('created_at'),
    ])
    setChantier(c)
    setEtapes(e ?? [])
    setNotes(n ?? [])

    // Indexer les photos par etape_id pour un accès O(1)
    const byEtape: Record<string, EtapePhoto[]> = {}
    for (const photo of (p ?? [])) {
      if (!byEtape[photo.etape_id]) byEtape[photo.etape_id] = []
      byEtape[photo.etape_id].push(photo)
    }
    setPhotos(byEtape)
    setLoading(false)
  }, [chantierId])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const sub = supabase
      .channel(`chantier-${chantierId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'etapes',       filter: `chantier_id=eq.${chantierId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes',        filter: `chantier_id=eq.${chantierId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chantiers',    filter: `id=eq.${chantierId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'etape_photos', filter: `chantier_id=eq.${chantierId}` }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [chantierId, fetchAll])

  async function updateStatut(statut: Chantier['statut']) {
    setChantier(prev => prev ? { ...prev, statut } : prev)
    await supabase.from('chantiers').update({ statut, updated_at: new Date().toISOString() }).eq('id', chantierId)
    fetchAll()
  }

  async function advanceEtape(etape: Etape) {
    const now = new Date().toISOString()
    let updates: Partial<Etape>
    if (etape.statut === 'non_fait') {
      updates = { statut: 'en_cours', started_at: now, finished_at: null, updated_at: now }
    } else if (etape.statut === 'en_cours') {
      updates = { statut: 'fait', finished_at: now, updated_at: now }
    } else {
      updates = { statut: 'non_fait', started_at: null, finished_at: null, updated_at: now }
    }
    setEtapes(prev => prev.map(e => e.id === etape.id ? { ...e, ...updates } : e))
    await supabase.from('etapes').update(updates).eq('id', etape.id)
    fetchAll()
  }

  async function updateConsigne(etapeId: string, consigne: string) {
    setEtapes(prev => prev.map(e => e.id === etapeId ? { ...e, consigne: consigne.trim() || null } : e))
    await supabase.from('etapes').update({ consigne: consigne.trim() || null, updated_at: new Date().toISOString() }).eq('id', etapeId)
    fetchAll()
  }

  async function addNote(contenu: string, technicienId: string) {
    await supabase.from('notes').insert({ chantier_id: chantierId, technicien_id: technicienId, contenu })
    fetchAll()
  }

  async function uploadEtapePhoto(etapeId: string, file: File): Promise<{ error: string | null }> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Session expirée — reconnectez-vous' }

    const ext  = file.name.split('.').pop() || file.type.split('/').pop() || 'jpg'
    const path = `${chantierId}/${etapeId}/${Date.now()}.${ext}`

    const { error: storageError } = await supabase.storage
      .from('chantier-photos')
      .upload(path, file, { upsert: false })

    if (storageError) return { error: `Storage: ${storageError.message}` }

    const { data } = supabase.storage.from('chantier-photos').getPublicUrl(path)

    const { error: dbError } = await supabase
      .from('etape_photos')
      .insert({ etape_id: etapeId, chantier_id: chantierId, url: data.publicUrl })

    if (dbError) return { error: `DB: ${dbError.message}` }

    await fetchAll()
    return { error: null }
  }

  async function deleteEtapePhoto(photoId: string, storagePath: string): Promise<{ error: string | null }> {
    const { error: storageError } = await supabase.storage
      .from('chantier-photos')
      .remove([storagePath])

    if (storageError) return { error: `Storage: ${storageError.message}` }

    const { error: dbError } = await supabase
      .from('etape_photos')
      .delete()
      .eq('id', photoId)

    if (dbError) return { error: `DB: ${dbError.message}` }

    await fetchAll()
    return { error: null }
  }

  async function deleteChantier(): Promise<{ error: string | null }> {
    const { error } = await supabase.from('chantiers').delete().eq('id', chantierId)
    return { error: error?.message ?? null }
  }

  return {
    chantier, etapes, notes, photos, loading,
    updateStatut, advanceEtape, updateConsigne, addNote,
    uploadEtapePhoto, deleteEtapePhoto, deleteChantier,
    refetch: fetchAll,
  }
}
