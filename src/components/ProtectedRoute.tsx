import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole, isManagerRole, type PermissionKey } from '@/types'
import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface Props {
  children: React.ReactNode
  allowedRole?: UserRole
  /** Clé de permission qui permet à un technicien d'accéder à une route manager */
  permissionKey?: PermissionKey
}

export default function ProtectedRoute({ children, allowedRole, permissionKey }: Props) {
  const { user, profile, loading } = useAuth()
  const { can, loading: permsLoading } = usePermissions()
  const [slow, setSlow] = useState(false)

  // Rôle : depuis le profil si chargé, sinon depuis le token JWT (dispo immédiatement)
  const effectiveRole  = profile?.role ?? (user?.user_metadata?.role as string | undefined)
  const roleMatch      = !allowedRole || effectiveRole === allowedRole || (allowedRole === 'manager' && effectiveRole === 'admin')
  const needsPermCheck = !roleMatch && !!permissionKey
  const stillLoading   = loading || (needsPermCheck && permsLoading)

  useEffect(() => {
    if (!stillLoading) return
    const t = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(t)
  }, [stillLoading])

  if (stillLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Chargement...</p>
          {slow && (
            <p className="mt-2 text-gray-400 text-xs">
              Connexion lente…{' '}
              <button onClick={() => window.location.reload()} className="underline text-orange-500">
                Réessayer
              </button>
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Si le rôle ne correspond pas, on vérifie si une permission spécifique l'autorise
  if (!roleMatch) {
    if (permissionKey && can(permissionKey)) {
      // Technicien avec permission élevée → accès autorisé
    } else {
      return <Navigate to={isManagerRole(profile?.role) ? '/manager' : '/technicien'} replace />
    }
  }

  return <>{children}</>
}
