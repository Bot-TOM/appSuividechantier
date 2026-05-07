import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { PermissionKey } from '@/types'

/**
 * Hook pour vérifier les permissions de l'utilisateur connecté.
 * Les managers ont automatiquement toutes les permissions.
 * Les techniciens ont les permissions de leur poste.
 */
export function usePermissions() {
  const { profile } = useAuth()
  const [perms, setPerms] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Manager → toutes les permissions
    if (profile?.role === 'manager') {
      setLoading(false)
      return
    }

    const poste = profile?.poste
    if (!poste) {
      setLoading(false)
      return
    }

    supabase
      .from('role_permissions')
      .select('permission_key, allowed')
      .eq('poste', poste)
      .then(({ data }) => {
        const map: Record<string, boolean> = {}
        data?.forEach(p => { map[p.permission_key] = p.allowed })
        setPerms(map)
        setLoading(false)
      })
  }, [profile?.role, profile?.poste])

  const can = useCallback((key: PermissionKey): boolean => {
    if (profile?.role === 'manager') return true
    return perms[key] ?? false
  }, [profile?.role, perms])

  return { can, loading }
}
