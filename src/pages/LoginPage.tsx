import { useState, FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isManagerRole } from '@/types'

export default function LoginPage() {
  const { user, profile, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPwd, setShowPwd]   = useState(false)

  if (!loading && user && profile) {
    return <Navigate to={isManagerRole(profile.role) ? '/manager' : '/technicien'} replace />
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">ChantierPV</h1>
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
              <div className="flex items-center rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent transition-shadow bg-white">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="flex-1 px-4 py-3 rounded-xl text-sm focus:outline-none bg-transparent"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="px-3 py-3 text-gray-500 hover:text-orange-500 transition-colors flex-shrink-0">
                  {showPwd
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
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
          © 2025 ChantierPV · Gestion professionnelle de chantiers PV
        </p>
      </div>
    </div>
  )
}
