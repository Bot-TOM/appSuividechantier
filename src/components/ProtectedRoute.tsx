import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types'
import { useState, useEffect } from 'react'

interface Props {
  children: React.ReactNode
  allowedRole?: UserRole
}

export default function ProtectedRoute({ children, allowedRole }: Props) {
  const { user, profile, loading } = useAuth()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(t)
  }, [loading])

  if (loading) {
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

  if (allowedRole && profile?.role !== allowedRole) {
    return <Navigate to={profile?.role === 'manager' ? '/manager' : '/technicien'} replace />
  }

  return <>{children}</>
}
