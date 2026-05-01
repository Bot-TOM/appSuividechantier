import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabaseAuth'
import { UserProfile } from '@/types'

export default function GestionEquipe() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [techniciens, setTechniciens] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({ full_name: '', email: '', password: '' })

  async function fetchEquipe() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'technicien')
      .order('full_name')
    setTechniciens(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchEquipe() }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    const { data, error: errAuth } = await supabaseAuth.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, role: 'technicien' } },
    })

    if (errAuth || !data.user) {
      setError(errAuth?.message ?? 'Erreur lors de la création du compte')
      setSubmitting(false)
      return
    }

    await supabase.from('profiles').upsert({
      id: data.user.id,
      email: form.email,
      full_name: form.full_name,
      role: 'technicien',
    })

    setSuccess(`Compte créé pour ${form.full_name}`)
    setForm({ full_name: '', email: '', password: '' })
    setShowForm(false)
    fetchEquipe()
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header avec onglets ──────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6">

          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                ☀️
              </div>
              <span className="font-bold text-gray-900 text-lg tracking-tight">SolarTrack</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 leading-tight">{profile?.full_name}</p>
                <p className="text-xs text-gray-400">Manager</p>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={signOut}
                title="Se déconnecter"
                className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none ml-1"
              >
                ↩
              </button>
            </div>
          </div>

          {/* Onglets */}
          <div className="flex gap-0 -mb-px">
            <button
              onClick={() => navigate('/manager')}
              className="px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition-colors"
            >
              Chantiers
            </button>
            <button
              onClick={() => navigate('/manager')}
              className="px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition-colors"
            >
              Anomalies
            </button>
            <button className="px-5 py-3 text-sm font-semibold border-b-2 border-orange-500 text-orange-600">
              Équipe
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-5">

        {/* Succès */}
        {success && (
          <div className="bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3 rounded-2xl flex items-center gap-2">
            <span className="text-base">✓</span>
            {success}
          </div>
        )}

        {/* ── Formulaire création compte ────────────────────────────────────── */}
        {showForm ? (
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h2 className="font-semibold text-gray-900 mb-5">Nouveau technicien</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet *</label>
                <input name="full_name" value={form.full_name} onChange={handleChange} required
                  placeholder="Paul Martin"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                <input name="email" value={form.email} onChange={handleChange} required
                  type="email" placeholder="paul@entreprise.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe provisoire *</label>
                <input name="password" value={form.password} onChange={handleChange} required
                  type="text" placeholder="Au moins 6 caractères" minLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm" />
                <p className="text-xs text-gray-400 mt-1.5">Le technicien pourra le modifier après connexion</p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 text-white font-semibold py-3 rounded-xl transition-all text-sm disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}>
                  {submitting ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 text-sm"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}
          >
            + Ajouter un technicien
          </button>
        )}

        {/* ── Liste équipe ──────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Équipe — {techniciens.length} technicien{techniciens.length !== 1 ? 's' : ''}
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : techniciens.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <div className="text-4xl mb-3">👥</div>
              <p className="font-semibold text-gray-700 mb-1">Aucun technicien</p>
              <p className="text-sm text-gray-400">Ajoutez votre premier technicien ci-dessus</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {techniciens.map(tech => (
                <div key={tech.id}
                  className="bg-white rounded-2xl px-5 py-4 flex items-center gap-4"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                    {tech.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{tech.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{tech.email}</p>
                  </div>
                  <span className="text-xs bg-orange-50 text-orange-600 font-medium px-2.5 py-1 rounded-full flex-shrink-0">
                    Technicien
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
