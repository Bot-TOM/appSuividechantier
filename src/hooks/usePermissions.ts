import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { isManagerRole } from '@/types'
import type { PermissionKey } from '@/types'

/**
 * Hook pour vérifier les permissions de l'utilisateur connecté.
 * Les managers et admins ont automatiquement toutes les permissions.
 * Les techniciens ont les permissions de leur poste.
 */
export function usePermissions() {
  const { profile } = useAuth()
  const [perms, setPerms] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Manager / Admin → toutes les permissions
    if (isManagerRole(profile?.role)) {
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
      .then(({ data, error }) => {
        if (!error && data) {
          const map: Record<string, boolean> = {}
          data.forEach(p => { map[p.permission_key] = p.allowed })
          setPerms(map)
        }
        setLoading(false)
      })
  }, [profile?.role, profile?.poste])

  const can = useCallback((key: PermissionKey): boolean => {
    if (isManagerRole(profile?.role)) return true
    return perms[key] ?? false
  }, [profile?.role, perms])

  return { can, loading }
}
