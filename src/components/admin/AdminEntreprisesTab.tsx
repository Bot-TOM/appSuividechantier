import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Entreprise {
  id: string
  nom: string
  created_at: string
  nb_users: number
  nb_chantiers: number
}

export default function AdminEntreprisesTab() {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [nom, setNom]                 = useState('')
  const [creating, setCreating]       = useState(false)
  const [error, setError]             = useState('')

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

  useEffect(() => { fetchEntreprises() }, [])

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
    </div>
  )
}
