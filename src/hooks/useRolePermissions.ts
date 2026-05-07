import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { POSTES_OPTIONS, type PermissionKey } from '@/types'

type PermMatrix = Record<string, Record<PermissionKey, boolean>>

const ALL_KEYS: PermissionKey[] = [
  'voir_tous_chantiers',
  'creer_chantier',
  'modifier_chantier',
  'assigner_techniciens',
  'resoudre_anomalie',
  'ajouter_document',
  'supprimer_message_autres',
  'voir_rapports',
  'exporter_pdf',
]

/**
 * Hook pour le manager : lit et modifie toutes les permissions par poste.
 */
export function useRolePermissions() {
  const [matrix, setMatrix] = useState<PermMatrix>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('role_permissions')
      .select('poste, permission_key, allowed')

    const m: PermMatrix = {}
    POSTES_OPTIONS.forEach(p => {
      m[p] = {} as Record<PermissionKey, boolean>
      ALL_KEYS.forEach(k => { m[p][k] = false })
    })
    data?.forEach(row => {
      if (m[row.poste]) {
        m[row.poste][row.permission_key as PermissionKey] = row.allowed
      }
    })
    setMatrix(m)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const toggle = useCallback(async (poste: string, key: PermissionKey) => {
    const current = matrix[poste]?.[key] ?? false
    // Optimistic update
    setMatrix(prev => ({
      ...prev,
      [poste]: { ...prev[poste], [key]: !current },
    }))
    setSaving(true)
    await supabase
      .from('role_permissions')
      .upsert({ poste, permission_key: key, allowed: !current }, { onConflict: 'poste,permission_key' })
    setSaving(false)
  }, [matrix])

  return { matrix, loading, saving, toggle, ALL_KEYS }
}
