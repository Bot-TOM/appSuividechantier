import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { DocumentTemplate, DocumentTemplateCategory } from '@/types'

export type { DocumentTemplate }

export function useDocumentTemplates(
  entrepriseId: string | null | undefined,
  category?:    DocumentTemplateCategory,
) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [loading,   setLoading]   = useState(true)

  const fetchTemplates = useCallback(async () => {
    if (!entrepriseId) { setLoading(false); return }
    let query = supabase
      .from('document_templates')
      .select('*')
      .eq('entreprise_id', entrepriseId)
    if (category) query = query.eq('category', category)
    const { data } = await query.order('position')
    setTemplates((data as DocumentTemplate[]) ?? [])
    setLoading(false)
  }, [entrepriseId, category])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  /** Crée un nouveau template et retourne l'objet créé. */
  const createTemplate = useCallback(async (
    tpl: Omit<DocumentTemplate, 'id' | 'created_at'>,
  ): Promise<DocumentTemplate | null> => {
    const { data, error } = await supabase
      .from('document_templates')
      .insert(tpl)
      .select()
      .single()
    if (error) { console.error('[templates] create:', error); return null }
    await fetchTemplates()
    return data as DocumentTemplate
  }, [fetchTemplates])

  /** Met à jour partiellement un template. */
  const updateTemplate = useCallback(async (id: string, patch: Partial<DocumentTemplate>) => {
    await supabase.from('document_templates').update(patch).eq('id', id)
    setTemplates(t => t.map(x => x.id === id ? { ...x, ...patch } : x))
  }, [])

  /** Supprime un template. */
  const deleteTemplate = useCallback(async (id: string) => {
    await supabase.from('document_templates').delete().eq('id', id)
    setTemplates(t => t.filter(x => x.id !== id))
  }, [])

  /** Définit un template comme défaut (dé-sélectionne les autres de la même catégorie). */
  const setDefault = useCallback(async (id: string) => {
    const cat = templates.find(t => t.id === id)?.category
    if (!cat) return
    // On met à jour en mémoire immédiatement
    setTemplates(t => t.map(x => x.category === cat ? { ...x, is_default: x.id === id } : x))
    // Puis en DB
    const same = templates.filter(t => t.category === cat)
    await Promise.all(same.map(t =>
      supabase.from('document_templates').update({ is_default: t.id === id }).eq('id', t.id),
    ))
  }, [templates])

  const defaultTemplate = templates.find(t => t.is_default) ?? templates[0] ?? null

  return {
    templates,
    loading,
    defaultTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefault,
    refetch: fetchTemplates,
  }
}
