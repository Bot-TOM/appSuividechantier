import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// Compresse une image à max 1600px / 80% qualité JPEG
async function compressImage(file: File, maxPx = 1600, quality = 0.8): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(b => resolve(b ?? file), 'image/jpeg', quality)
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

export interface RapportPhoto {
  id: string
  rapport_id: string
  chantier_id: string
  url: string
  created_at: string
}

export interface Rapport {
  id: string
  chantier_id: string
  auteur_id: string
  message: string
  created_at: string
  profiles?: { full_name: string }
  rapport_photos?: RapportPhoto[]
}

export function useRapports(chantierId: string) {
  const [rapports, setRapports] = useState<Rapport[]>([])
  const [loading, setLoading]   = useState(true)

  const fetchRapports = useCallback(async () => {
    const { data } = await supabase
      .from('rapports')
      .select('*, profiles(full_name), rapport_photos(*)')
      .eq('chantier_id', chantierId)
      .order('created_at', { ascending: false })
    setRapports(data ?? [])
    setLoading(false)
  }, [chantierId])

  useEffect(() => { fetchRapports() }, [fetchRapports])

  async function addRapport(
    message: string,
    auteurId: string,
    photos: File[]
  ): Promise<{ error: string | null }> {
    const { data: rapport, error: insertError } = await supabase
      .from('rapports')
      .insert({ chantier_id: chantierId, auteur_id: auteurId, message: message.trim() })
      .select()
      .single()

    if (insertError || !rapport) return { error: insertError?.message ?? 'Erreur' }

    // Upload toutes les photos en parallèle après compression
    await Promise.all(photos.map(async file => {
      const compressed = await compressImage(file)
      const safeName   = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const path       = `${chantierId}/${rapport.id}/${Date.now()}_${safeName}`
      const { error: uploadErr } = await supabase.storage
        .from('rapport-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' })
      if (uploadErr) { console.error('[rapport] upload photo:', uploadErr.message); return }
      const { data: { publicUrl } } = supabase.storage.from('rapport-photos').getPublicUrl(path)
      await supabase.from('rapport_photos').insert({
        rapport_id: rapport.id,
        chantier_id: chantierId,
        url: publicUrl,
      })
    }))

    await fetchRapports()
    return { error: null }
  }

  async function deleteRapport(rapport: Rapport) {
    for (const photo of rapport.rapport_photos ?? []) {
      const path = new URL(photo.url).pathname.replace(/^\/storage\/v1\/object\/public\/rapport-photos\//, '')
      await supabase.storage.from('rapport-photos').remove([path])
    }
    await supabase.from('rapports').delete().eq('id', rapport.id)
    setRapports(prev => prev.filter(r => r.id !== rapport.id))
  }

  async function deleteRapportPhoto(photo: RapportPhoto) {
    const path = new URL(photo.url).pathname.replace(/^\/storage\/v1\/object\/public\/rapport-photos\//, '')
    await supabase.storage.from('rapport-photos').remove([path])
    await supabase.from('rapport_photos').delete().eq('id', photo.id)
    setRapports(prev => prev.map(r =>
      r.id === photo.rapport_id
        ? { ...r, rapport_photos: (r.rapport_photos ?? []).filter(p => p.id !== photo.id) }
        : r
    ))
  }

  return { rapports, loading, addRapport, deleteRapport, deleteRapportPhoto, refetch: fetchRapports }
}
