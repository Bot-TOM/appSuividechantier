import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTechniciens } from '@/hooks/useTechniciens'
import { useChantierTechniciens } from '@/hooks/useChantierTechniciens'
import { ChantierStatut, Etape } from '@/types'

const TYPES_INSTALLATION = ['Résidentiel', 'Professionnel', 'Industriel', 'Agricole']

const STATUTS: { value: ChantierStatut; label: string }[] = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_cours',   label: 'En cours' },
  { value: 'bloque',     label: 'Bloqué' },
  { value: 'termine',    label: 'Terminé' },
]

interface EtapeEdit {
  id: string
  nom: string
  ordre: number
  statut: Etape['statut']
  consigne: string // note libre : instruction, contexte, durée indicative…
}

export default function EditChantier() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { techniciens } = useTechniciens()
  const { assignedIds } = useChantierTechniciens(id!)

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  const [form, setForm] = useState({
    nom: '', client_nom: '', client_adresse: '', client_telephone: '',
    type_installation: 'Résidentiel', nb_panneaux: '', date_prevue: '',
    statut: 'en_attente' as ChantierStatut,
  })

  const [selectedTechs, setSelectedTechs] = useState<string[]>([])
  const [etapes, setEtapes]               = useState<EtapeEdit[]>([])

  // Chargement chantier + étapes
  useEffect(() => {
    Promise.all([
      supabase.from('chantiers').select('*').eq('id', id).single(),
      supabase.from('etapes').select('*').eq('chantier_id', id).order('ordre'),
    ]).then(([{ data: c }, { data: e }]) => {
      if (c) {
        setForm({
          nom: c.nom,
          client_nom: c.client_nom,
          client_adresse: c.client_adresse,
          client_telephone: c.client_telephone ?? '',
          type_installation: c.type_installation,
          nb_panneaux: String(c.nb_panneaux),
          date_prevue: c.date_prevue,
          statut: c.statut,
        })
      }
      if (e) {
        setEtapes(e.map((etape: Etape) => ({
          id: etape.id,
          nom: etape.nom,
          ordre: etape.ordre,
          statut: etape.statut,
          consigne: etape.consigne ?? '',
        })))
      }
      setLoading(false)
    })
  }, [id])

  // Pré-sélection techniciens
  useEffect(() => {
    if (assignedIds.length > 0) setSelectedTechs(assignedIds)
  }, [assignedIds.join(',')])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function toggleTech(techId: string) {
    setSelectedTechs(prev => prev.includes(techId) ? prev.filter(t => t !== techId) : [...prev, techId])
  }

  function handleEtapeConsigne(index: number, value: string) {
    setEtapes(prev => prev.map((e, i) => i === index ? { ...e, consigne: value } : e))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // 1. Mettre à jour le chantier
    const { error: errUpdate } = await supabase
      .from('chantiers')
      .update({
        nom: form.nom,
        client_nom: form.client_nom,
        client_adresse: form.client_adresse,
        client_telephone: form.client_telephone || null,
        type_installation: form.type_installation,
        nb_panneaux: parseInt(form.nb_panneaux),
        date_prevue: form.date_prevue,
        statut: form.statut,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (errUpdate) { setError('Erreur lors de la mise à jour'); setSubmitting(false); return }

    // 2. Mettre à jour les consignes des étapes
    await Promise.all(
      etapes.map(etape =>
        supabase
          .from('etapes')
          .update({ consigne: etape.consigne.trim() || null })
          .eq('id', etape.id)
      )
    )

    // 3. Mettre à jour les assignations
    await supabase.from('chantier_techniciens').delete().eq('chantier_id', id)
    if (selectedTechs.length > 0) {
      await supabase.from('chantier_techniciens').insert(
        selectedTechs.map(tid => ({ chantier_id: id, technicien_id: tid }))
      )
    }

    navigate(`/chantier/${id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/chantier/${id}`)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-xl"
          >←</button>
          <h1 className="text-lg font-bold text-gray-900">Modifier le chantier</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Informations chantier ──────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-6 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <h2 className="font-semibold text-gray-900">Informations chantier</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du chantier *</label>
              <input name="nom" value={form.nom} onChange={handleChange} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type *</label>
                <select name="type_installation" value={form.type_installation} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                  {TYPES_INSTALLATION.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nb panneaux *</label>
                <input name="nb_panneaux" value={form.nb_panneaux} onChange={handleChange} required
                  type="number" min="1"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date prévue *</label>
                <input name="date_prevue" value={form.date_prevue} onChange={handleChange} required type="date"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Statut</label>
                <select name="statut" value={form.statut} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                  {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ── Client ────────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-6 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <h2 className="font-semibold text-gray-900">Client</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
              <input name="client_nom" value={form.client_nom} onChange={handleChange} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse *</label>
              <input name="client_adresse" value={form.client_adresse} onChange={handleChange} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
              <input name="client_telephone" value={form.client_telephone} onChange={handleChange} type="tel"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>
          </section>

          {/* ── Consignes par étape ───────────────────────────────────────── */}
          {etapes.length > 0 && (
            <section className="bg-white rounded-2xl p-6 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <div>
                <h2 className="font-semibold text-gray-900">Consignes par étape</h2>
                <p className="text-xs text-gray-400 mt-0.5">Notes visibles par le technicien pendant l'exécution</p>
              </div>

              <div className="space-y-2.5">
                {etapes.map((etape, i) => {
                  const statutDot = etape.statut === 'fait'
                    ? 'bg-green-500'
                    : etape.statut === 'en_cours'
                    ? 'bg-orange-500 animate-pulse'
                    : 'bg-gray-200'
                  return (
                    <div key={etape.id} className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statutDot}`} />
                        <span className="text-sm text-gray-700 font-medium">{etape.nom}</span>
                      </div>
                      <input
                        type="text"
                        value={etape.consigne}
                        onChange={e => handleEtapeConsigne(i, e.target.value)}
                        placeholder="Ex : vérifier les fixations, ~45 min, 2 personnes minimum…"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white text-gray-700 placeholder-gray-300"
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Équipe ────────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-6 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <h2 className="font-semibold text-gray-900">Équipe assignée</h2>
            {techniciens.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun technicien disponible</p>
            ) : (
              techniciens.map(tech => (
                <label key={tech.id} className="flex items-center gap-3 cursor-pointer py-1">
                  <input type="checkbox" checked={selectedTechs.includes(tech.id)}
                    onChange={() => toggleTech(tech.id)}
                    className="w-5 h-5 rounded accent-orange-500" />
                  <span className="text-sm font-medium text-gray-800">{tech.full_name}</span>
                  <span className="text-xs text-gray-400">{tech.email}</span>
                </label>
              ))
            )}
          </section>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full text-white font-semibold py-4 rounded-xl text-sm transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}>
            {submitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>

          <div className="h-2" />
        </form>
      </main>
    </div>
  )
}
