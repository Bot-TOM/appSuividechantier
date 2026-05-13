import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabaseAuth'
import { UserProfile, POSTES_OPTIONS, PERMISSION_LABELS, type PermissionKey } from '@/types'
import { useRolePermissions } from '@/hooks/useRolePermissions'
import Avatar from '@/components/Avatar'

interface EditModal {
  user: UserProfile
  full_name: string
  email: string
  password: string
  poste: string
}

// Badge couleur selon le poste
const POSTE_COLORS: Record<string, string> = {
  'Technicien':           'bg-gray-100 text-gray-600',
  "Chef d'équipe":        'bg-blue-50 text-blue-600',
  'Chef de chantier':     'bg-orange-50 text-orange-600',
  'Conducteur de travaux':'bg-purple-50 text-purple-600',
}

// ── Section gestion des permissions ─────────────────────────────────────────
function PermissionsSection() {
  const { matrix, loading, saving, toggle, ALL_KEYS } = useRolePermissions()
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white rounded-2xl text-left transition-colors hover:bg-gray-50"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Permissions par poste</p>
            <p className="text-xs text-gray-400">Définissez les droits de chaque rôle terrain</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
          {/* Indicateur de sauvegarde */}
          {saving && (
            <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-orange-600 font-medium">Sauvegarde...</span>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">
                      Permission
                    </th>
                    {POSTES_OPTIONS.map(poste => (
                      <th key={poste} className="px-3 py-3 text-center text-xs font-semibold text-gray-600 min-w-[110px]">
                        {poste}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ALL_KEYS.map(key => (
                    <tr key={key} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 font-medium">
                        {PERMISSION_LABELS[key as PermissionKey]}
                      </td>
                      {POSTES_OPTIONS.map(poste => {
                        const allowed = matrix[poste]?.[key] ?? false
                        return (
                          <td key={poste} className="px-3 py-3 text-center">
                            <button
                              onClick={() => toggle(poste, key)}
                              className={`w-10 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${
                                allowed ? 'bg-orange-500' : 'bg-gray-200'
                              }`}
                            >
                              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                                allowed ? 'left-[18px]' : 'left-0.5'
                              }`} />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-3 text-[11px] text-gray-400 border-t border-gray-50">
                Les managers ont toujours toutes les permissions. Les modifications sont effectives immédiatement.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GestionEquipe({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const { profile, session, signOut } = useAuth()
  const [techniciens, setTechniciens] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({ full_name: '', email: '', password: '', poste: 'Technicien' })

  // Modale édition
  const [editModal, setEditModal] = useState<EditModal | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  // Confirmation suppression
  const [deleteConfirm, setDeleteConfirm] = useState<UserProfile | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  async function fetchEquipe() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', profile?.id ?? '')
      .order('role')
      .order('full_name')
    setTechniciens(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (profile?.id) fetchEquipe() }, [profile?.id])

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
      poste: form.poste || 'Technicien',
    })

    setSuccess(`Compte créé pour ${form.full_name}`)
    setForm({ full_name: '', email: '', password: '', poste: 'Technicien' })
    setShowForm(false)
    fetchEquipe()
    setSubmitting(false)
  }

  // ── Édition ────────────────────────────────────────────────────────────────
  function openEdit(tech: UserProfile) {
    setEditModal({ user: tech, full_name: tech.full_name, email: tech.email, password: '', poste: tech.poste ?? 'Technicien' })
    setEditError('')
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault()
    if (!editModal) return
    setEditError('')
    setEditSubmitting(true)

    // Mise à jour du poste directement dans profiles (pas besoin de l'API auth)
    const posteChanged = editModal.poste !== (editModal.user.poste ?? 'Technicien')
    if (posteChanged) {
      await supabase.from('profiles').update({ poste: editModal.poste }).eq('id', editModal.user.id)
    }

    // Mise à jour des champs auth (nom, email, mdp) via l'API admin
    const payload: Record<string, string> = { userId: editModal.user.id }
    if (editModal.full_name !== editModal.user.full_name) payload.full_name = editModal.full_name
    if (editModal.email    !== editModal.user.email)     payload.email     = editModal.email
    if (editModal.password)                              payload.password  = editModal.password

    if (Object.keys(payload).length > 1) {
      const res = await fetch('/api/admin-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setEditError(data.error ?? 'Erreur lors de la modification')
        setEditSubmitting(false)
        return
      }
    }

    setSuccess(`Compte de ${editModal.full_name} mis à jour`)
    setEditModal(null)
    setEditSubmitting(false)
    fetchEquipe()
  }

  // ── Suppression ────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleteSubmitting(true)

    const res = await fetch('/api/admin-user', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ userId: deleteConfirm.id }),
    })

    if (!res.ok) {
      setSuccess('')
      setError('Erreur lors de la suppression')
    } else {
      setSuccess(`Compte de ${deleteConfirm.full_name} supprimé`)
    }
    setDeleteConfirm(null)
    setDeleteSubmitting(false)
    fetchEquipe()
  }

  return (
    <div className={embedded ? undefined : 'min-h-screen bg-[#F8FAFC]'}>

      {/* ── Header (page standalone uniquement) ─────────────────────────── */}
      {!embedded && (
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                ☀️
              </div>
              <span className="font-bold text-gray-900 text-lg tracking-tight">PVPilot</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 leading-tight">{profile?.full_name}</p>
                <p className="text-xs text-gray-400">Manager</p>
              </div>
              <Avatar name={profile?.full_name ?? ''} avatarUrl={profile?.avatar_url} size="md" />
              <button onClick={signOut} title="Se déconnecter"
                className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none ml-1">
                ↩
              </button>
            </div>
          </div>
          <div className="flex gap-0 -mb-px">
            <button onClick={() => navigate('/manager')}
              className="px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition-colors">
              Chantiers
            </button>
            <button onClick={() => navigate('/manager')}
              className="px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition-colors">
              Anomalies
            </button>
            <button className="px-5 py-3 text-sm font-semibold border-b-2 border-orange-500 text-orange-600">
              Équipe
            </button>
          </div>
        </div>
      </header>
      )}

      <main className={`max-w-2xl md:max-w-5xl mx-auto px-6 space-y-6 ${embedded ? 'py-0' : 'py-8'}`}>

        {success && (
          <div className="bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3 rounded-2xl flex items-center gap-2">
            <span className="text-base">✓</span> {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        {/* ── Formulaire création ──────────────────────────────────────────── */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Poste</label>
                <select name="poste" value={form.poste}
                  onChange={e => setForm(f => ({ ...f, poste: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm bg-white">
                  {POSTES_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe provisoire *</label>
                <input name="password" value={form.password} onChange={handleChange} required
                  type="text" placeholder="Au moins 6 caractères" minLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm" />
                <p className="text-xs text-gray-400 mt-1.5">Le technicien pourra le modifier après connexion</p>
              </div>
              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
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
          <button onClick={() => { setShowForm(true); setError(''); setSuccess('') }}
            className="w-full text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 text-sm"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}>
            + Ajouter un technicien
          </button>
        )}

        {/* ── Liste équipe ──────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Équipe — {techniciens.length} membre{techniciens.length !== 1 ? 's' : ''}
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : techniciens.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <div className="text-4xl mb-3">👥</div>
              <p className="font-semibold text-gray-700 mb-1">Aucun technicien</p>
              <p className="text-sm text-gray-400">Ajoutez votre premier technicien ci-dessus</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {techniciens.map(tech => (
                <div key={tech.id}
                  className="bg-white rounded-2xl px-5 py-4 flex items-center gap-4"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                    {tech.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{tech.full_name}</p>
                      {tech.role === 'manager' ? (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 bg-orange-50 text-orange-600">
                          Manager
                        </span>
                      ) : tech.poste ? (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${POSTE_COLORS[tech.poste] ?? 'bg-gray-100 text-gray-500'}`}>
                          {tech.poste}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{tech.email}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { openEdit(tech); setSuccess(''); setError('') }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-orange-50 text-orange-500 hover:bg-orange-100 transition-colors"
                      title="Modifier">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setDeleteConfirm(tech); setSuccess(''); setError('') }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                      title="Supprimer">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Gestion des permissions ──────────────────────────────────────── */}
        <PermissionsSection />

      </main>

      {/* ── Modale édition ───────────────────────────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Modifier le compte</h3>
              <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet</label>
                <input value={editModal.full_name}
                  onChange={e => setEditModal(m => m ? { ...m, full_name: e.target.value } : m)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Poste</label>
                <select value={editModal.poste}
                  onChange={e => setEditModal(m => m ? { ...m, poste: e.target.value } : m)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm bg-white">
                  {POSTES_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={editModal.email}
                  onChange={e => setEditModal(m => m ? { ...m, email: e.target.value } : m)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nouveau mot de passe <span className="text-gray-400 font-normal">(laisser vide = inchangé)</span>
                </label>
                <input type="text" value={editModal.password} placeholder="••••••••"
                  onChange={e => setEditModal(m => m ? { ...m, password: e.target.value } : m)}
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
              </div>

              {editError && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{editError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditModal(null)}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={editSubmitting}
                  className="flex-1 text-white font-semibold py-3 rounded-xl transition-all text-sm disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                  {editSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modale suppression ───────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Supprimer ce compte ?</h3>
              <p className="text-sm text-gray-500">
                Le compte de <span className="font-semibold text-gray-900">{deleteConfirm.full_name}</span> sera définitivement supprimé.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleteSubmitting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm disabled:opacity-60">
                {deleteSubmitting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
