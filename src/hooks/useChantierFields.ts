import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChantierFieldDef } from '@/types'

export type { ChantierFieldDef }

/** Gère les définitions de champs personnalisés d'une entreprise. */
export function useChantierFields(entrepriseId: string | null | undefined) {
  const [fields,  setFields]  = useState<ChantierFieldDef[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFields = useCallback(async () => {
    if (!entrepriseId) { setLoading(false); return }
    const { data } = await supabase
      .from('chantier_field_definitions')
      .select('*')
      .eq('entreprise_id', entrepriseId)
      .order('position')
    setFields((data as ChantierFieldDef[]) ?? [])
    setLoading(false)
  }, [entrepriseId])

  useEffect(() => { fetchFields() }, [fetchFields])

  /** Remplace toute la liste (utilisé après une analyse IA ou un réordonnancement). */
  const saveFields = useCallback(async (
    defs: Omit<ChantierFieldDef, 'id' | 'entreprise_id' | 'created_at'>[],
  ) => {
    if (!entrepriseId) return
    const rows = defs.map((d, i) => ({
      entreprise_id: entrepriseId,
      field_key:     d.field_key,
      field_label:   d.field_label,
      field_type:    d.field_type,
      field_options: d.field_options ?? null,
      section:       d.section ?? null,
      position:      i,
      required:      d.required,
      active:        d.active ?? true,
    }))
    await supabase
      .from('chantier_field_definitions')
      .upsert(rows, { onConflict: 'entreprise_id,field_key' })
    await fetchFields()
  }, [entrepriseId, fetchFields])

  /** Active ou désactive un champ. */
  const toggleActive = useCallback(async (id: string, active: boolean) => {
    await supabase.from('chantier_field_definitions').update({ active }).eq('id', id)
    setFields(f => f.map(x => x.id === id ? { ...x, active } : x))
  }, [])

  /** Supprime un champ définitivement. */
  const deleteField = useCallback(async (id: string) => {
    await supabase.from('chantier_field_definitions').delete().eq('id', id)
    setFields(f => f.filter(x => x.id !== id))
  }, [])

  /** Met à jour le libellé ou les options d'un champ existant. */
  const updateField = useCallback(async (id: string, patch: Partial<ChantierFieldDef>) => {
    await supabase.from('chantier_field_definitions').update(patch).eq('id', id)
    setFields(f => f.map(x => x.id === id ? { ...x, ...patch } : x))
  }, [])

  /** Champs actifs uniquement (pour les formulaires de saisie). */
  const activeFields = fields.filter(f => f.active)

  return { fields, activeFields, loading, saveFields, toggleActive, deleteField, updateField, refetch: fetchFields }
}
