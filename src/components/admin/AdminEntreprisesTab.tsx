import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Entreprise {
  id: string
  nom: string
  created_at: string
  nb_users: number
  nb_chantiers: number
}

interface AccessCode {
  id: string
  code: string
  status: 'available' | 'used'
  source: string
  created_at: string
  used_at: string | null
}

export default function AdminEntreprisesTab() {
  const { profile } = useAuth()
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [nom, setNom]                 = useState('')
  const [creating, setCreating]       = useState(false)
  const [error, setError]             = useState('')

  // Codes d'accès
  const [codes, setCodes]             = useState<AccessCode[]>([])
  const [codesLoading, setCodesLoading] = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [copiedId, setCopiedId]       = useState<string | null>(null)

  async function fetchEntreprises() {
    setLoading(true)
    const { data: ents } = await supabase
      .from('entreprises')
      .select('id, nom, created_at')
      .order('created_at', { ascending: true })

    if (!ents) { setLoading(false); return }

    // Compter users et chantiers pour chaque entreprise
    const enriched = await Promise.all(ents.map(async (e) => {
      const [{ count: nb_users }, { count: nb_chantiers }] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('entreprise_id', e.id),
        supabase.from('chantiers').select('id', { count: 'exact', head: true }).eq('entreprise_id', e.id),
      ])
      return { ...e, nb_users: nb_users ?? 0, nb_chantiers: nb_chantiers ?? 0 }
    }))

    setEntreprises(enriched)
    setLoading(false)
  }

  async function fetchCodes() {
    setCodesLoading(true)
    const { data } = await supabase
      .from('access_codes')
      .select('id, code, status, source, created_at, used_at')
      .order('created_at', { ascending: false })
    setCodes((data as AccessCode[]) ?? [])
    setCodesLoading(false)
  }

  function generateRandomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let part = ''
    for (let i = 0; i < 5; i++) part += chars[Math.floor(Math.random() * chars.length)]
    return `PVP-${part}`
  }

  async function handleGenerateCode() {
    setGenerating(true)
    const code = generateRandomCode()
    const { error: err } = await supabase
      .from('access_codes')
      .insert({ code, source: 'manual', created_by: profile?.id })
    if (!err) await fetchCodes()
    setGenerating(false)
  }

  async function handleCopy(code: string, id: string) {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  useEffect(() => { fetchEntreprises(); fetchCodes() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setCreating(true)
    setError('')

    const { error: err } = await supabase
      .from('entreprises')
      .insert({ nom: nom.trim() })

    if (err) {
      setError('Erreur lors de la création')
      setCreating(false)
      return
    }

    setNom('')
    setShowForm(false)
    setCreating(false)
    fetchEntreprises()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        Chargement…
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Entreprises</h2>
          <p className="text-sm text-gray-500">{entreprises.length} entreprise{entreprises.length > 1 ? 's' : ''} enregistrée{entreprises.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.30)' }}
        >
          <span className="text-base leading-none">+</span> Nouvelle entreprise
        </button>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 border border-orange-100"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p className="text-sm font-medium text-gray-700 mb-3">Nom de la nouvelle entreprise</p>
          <div className="flex gap-3">
            <input
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Ex : Soleil du Sud PV"
              required
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button type="submit" disabled={creating}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
              {creating ? 'Création…' : 'Créer'}
            </button>
          </div>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </form>
      )}

      {/* Liste des entreprises */}
      <div className="space-y-3">
        {entreprises.map(ent => (
          <div key={ent.id} className="bg-white rounded-2xl p-5 border-l-4 border-l-orange-400"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-base">{ent.nom}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Créée le {new Date(ent.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{ent.nb_users}</div>
                  <div className="text-xs text-gray-400">utilisateur{ent.nb_users > 1 ? 's' : ''}</div>
                </div>
                <div className="w-px bg-gray-100" />
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-500">{ent.nb_chantiers}</div>
                  <div className="text-xs text-gray-400">chantier{ent.nb_chantiers > 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>

            {/* ID entreprise (utile pour le support) */}
            <p className="text-xs text-gray-300 mt-3 font-mono truncate">ID : {ent.id}</p>
          </div>
        ))}

        {entreprises.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Aucune entreprise enregistrée
          </div>
        )}
      </div>

      {/* ── Codes d'accès ── */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Codes d'accès</h2>
            <p className="text-sm text-gray-500">
              {codes.filter(c => c.status === 'available').length} disponible{codes.filter(c => c.status === 'available').length !== 1 ? 's' : ''} · {codes.filter(c => c.status === 'used').length} utilisé{codes.filter(c => c.status === 'used').length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleGenerateCode}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.30)' }}
          >
            <span className="text-base leading-none">+</span> {generating ? 'Génération…' : 'Générer un code'}
          </button>
        </div>

        {codesLoading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Chargement…</div>
        ) : codes.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Aucun code généré</div>
        ) : (
          <div className="space-y-2">
            {codes.map(c => (
              <div key={c.id} className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${c.status === 'available' ? '#22c55e' : '#d1d5db'}` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-bold text-gray-900 text-base tracking-widest">{c.code}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.status === 'available' ? 'Disponible' : 'Utilisé'}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400">
                    {c.status === 'used' && c.used_at
                      ? `Utilisé le ${new Date(c.used_at).toLocaleDateString('fr-FR')}`
                      : `Créé le ${new Date(c.created_at).toLocaleDateString('fr-FR')}`}
                  </span>
                  {c.status === 'available' && (
                    <button
                      onClick={() => handleCopy(c.code, c.id)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: copiedId === c.id ? '#dcfce7' : '#f3f4f6', color: copiedId === c.id ? '#16a34a' : '#6b7280' }}
                    >
                      {copiedId === c.id
                        ? <><span>✓</span> Copié</>
                        : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copier</>
                      }
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
