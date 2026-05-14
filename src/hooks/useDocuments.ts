import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ChantierDocument {
  id: string
  chantier_id: string
  uploaded_by: string
  nom: string
  url: string
  taille?: number
  created_at: string
}

export function useDocuments(chantierId: string) {
  const [documents, setDocuments] = useState<ChantierDocument[]>([])
  const [loading, setLoading]     = useState(true)

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('created_at', { ascending: false })
    setDocuments(data ?? [])
    setLoading(false)
  }, [chantierId])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function uploadDocument(file: File, userId: string): Promise<{ error: string | null }> {
    if (file.size === 0) return { error: 'Le fichier semble vide ou corrompu, impossible de l\'importer' }
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path     = `${chantierId}/${Date.now()}_${safeName}`
    const ext      = file.name.split('.').pop()?.toLowerCase() ?? ''
    const MIME: Record<string, string> = {
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
    const contentType = file.type || MIME[ext] || 'application/octet-stream'

    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { contentType })
    if (uploadError) return { error: uploadError.message }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

    const { error: insertError } = await supabase.from('documents').insert({
      chantier_id: chantierId,
      uploaded_by: userId,
      nom:         file.name,
      url:         publicUrl,
      taille:      file.size,
    })
    if (insertError) return { error: insertError.message }

    fetchDocs()
    return { error: null }
  }

  async function deleteDocument(doc: ChantierDocument) {
    const path = new URL(doc.url).pathname.replace(/^\/storage\/v1\/object\/public\/documents\//, '')
    await supabase.storage.from('documents').remove([path])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  return { documents, loading, uploadDocument, deleteDocument, refetch: fetchDocs }
}
