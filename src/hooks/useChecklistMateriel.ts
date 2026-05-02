import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ItemMateriel {
  id: string
  chantier_id: string
  nom: string
  checked: boolean
  ordre: number
}

export function useChecklistMateriel(chantierId: string) {
  const [items, setItems]   = useState<ItemMateriel[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('checklist_materiel')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('ordre')
    setItems(data ?? [])
    setLoading(false)
  }, [chantierId])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const sub = supabase
      .channel(`materiel-${chantierId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_materiel', filter: `chantier_id=eq.${chantierId}` }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [chantierId, fetch])

  async function toggleItem(id: string, checked: boolean) {
    await supabase.from('checklist_materiel').update({ checked }).eq('id', id)
    await fetch()
  }

  async function addItem(nom: string) {
    const ordre = items.length + 1
    await supabase.from('checklist_materiel').insert({ chantier_id: chantierId, nom: nom.trim(), checked: false, ordre })
    await fetch()
  }

  async function deleteItem(id: string) {
    await supabase.from('checklist_materiel').delete().eq('id', id)
    await fetch()
  }

  const total   = items.length
  const checked = items.filter(i => i.checked).length

  return { items, loading, total, checked, toggleItem, addItem, deleteItem }
}
