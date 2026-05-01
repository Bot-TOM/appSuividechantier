import { useState, FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { user, profile, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user && profile) {
    return <Navigate to={profile.role === 'manager' ? '/manager' : '/technicien'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError('Email ou mot de passe incorrect')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #F8FAFC 50%, #F8FAFC 100%)' }}>

      {/* Hero top */}
      <div className="flex-1 flex flex-col justify-center px-6 max-w-sm w-full mx-auto">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 8px 24px rgba(249,115,22,0.35)' }}>
            ☀️
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">SolarTrack</h1>
          <p className="text-gray-500 text-sm mt-1.5">Gestion de chantiers photovoltaïques</p>
        </div>

        {/* Card formulaire */}
        <div className="bg-white rounded-3xl p-6 w-full"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)' }}>

          <h2 className="font-semibold text-gray-900 mb-5 text-lg">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="votre@email.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-shadow"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <span>⚠️</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full text-white font-semibold py-3.5 rounded-xl text-sm transition-all disabled:opacity-60 mt-1"
              style={{
                background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
                boxShadow: '0 4px 12px rgba(249,115,22,0.35)',
              }}
            >
              {submitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Pas encore de compte ?{' '}
            <Link to="/signup" className="text-orange-500 font-semibold hover:text-orange-600 transition-colors">
              S'inscrire
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          © 2025 SolarTrack · Gestion professionnelle de chantiers PV
        </p>
      </div>
    </div>
  )
}
