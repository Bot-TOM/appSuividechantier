import { useState, FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function SignupPage() {
  const { user, profile, loading, signUp } = useAuth()

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    managerCode: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user && profile) {
    return <Navigate to={profile.role === 'manager' ? '/manager' : '/technicien'} replace />
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setSubmitting(true)
    const { error } = await signUp(form.full_name, form.email, form.password, form.managerCode)
    if (error) {
      setError(error)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #F8FAFC 50%, #F8FAFC 100%)' }}>
      <div className="flex-1 flex flex-col justify-center px-6 max-w-sm w-full mx-auto py-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 8px 24px rgba(249,115,22,0.35)' }}>
            ☀️
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">SolarTrack</h1>
          <p className="text-gray-500 text-sm mt-1.5">Créez votre compte</p>
        </div>

        <div className="bg-white rounded-3xl p-6 w-full"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)' }}>

          <h2 className="font-semibold text-gray-900 mb-5 text-lg">Inscription</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet</label>
              <input name="full_name" value={form.full_name} onChange={handleChange} required
                placeholder="Jean Dupont"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required
                placeholder="votre@email.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Code manager <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input name="managerCode" type="password" value={form.managerCode} onChange={handleChange}
                placeholder="Laissez vide si technicien"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
              <p className="text-xs text-gray-400 mt-1.5">Fourni par votre responsable</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <button type="submit" disabled={submitting}
              className="w-full text-white font-semibold py-3.5 rounded-xl text-sm transition-all disabled:opacity-60 mt-1"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}>
              {submitting ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-orange-500 font-semibold hover:text-orange-600 transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
