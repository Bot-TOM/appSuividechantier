import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTechniciens } from '@/hooks/useTechniciens'
import { useChantierTechniciens } from '@/hooks/useChantierTechniciens'
import { ChantierStatut, Etape } from '@/types'

const TYPES_INSTALLATION = ['Résidentiel', 'Professionnel', 'Industriel', 'Agricole']

const TYPES_CONTRAT: { value: string; label: string }[] = [
  { value: '',                         label: 'Non précisé' },
  { value: 'revente_totale',           label: 'Revente totale' },
  { value: 'autoconsommation',         label: 'Autoconsommation' },
  { value: 'autoconsommation_surplus', label: 'Autoconsommation + surplus' },
]

const STATUTS: { value: ChantierStatut; label: string }[] = [
  { value: 'planifie',   label: 'Planifié' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_cours',   label: 'En cours' },
  { value: 'bloque',     label: 'Bloqué' },
  { value: 'termine',    label: 'Terminé' },
]

interface EtapeEdit {
  id: string          // UUID existant ou 'new-{timestamp}' pour les nouvelles
  nom: string
  ordre: number
  statut: Etape['statut']
  consigne: string
  isNew?: boolean
}

export default function EditChantier() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { techniciens } = useTechniciens()
  const { assignedIds } = useChantierTechniciens(id!)

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [newEtapeNom, setNewEtapeNom] = useState('')

  const [form, setForm] = useState({
    nom: '', client_nom: '', client_adresse: '', client_telephone: '',
    type_installation: 'Résidentiel', type_contrat: '',
    puissance_kwc: '', date_prevue: '', date_fin_prevue: '',
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
          type_contrat: c.type_contrat ?? '',
          puissance_kwc: c.puissance_kwc != null ? String(c.puissance_kwc) : '',
          date_prevue: c.date_prevue,
          date_fin_prevue: c.date_fin_prevue ?? '',
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

  function handleEtapeNom(index: number, value: string) {
    setEtapes(prev => prev.map((e, i) => i === index ? { ...e, nom: value } : e))
  }

  function handleEtapeConsigne(index: number, value: string) {
    setEtapes(prev => prev.map((e, i) => i === index ? { ...e, consigne: value } : e))
  }

  function handleAddEtape() {
    const nom = newEtapeNom.trim()
    if (!nom) return
    const ordre = etapes.length + 1
    setEtapes(prev => [...prev, { id: `new-${Date.now()}`, nom, ordre, statut: 'non_fait', consigne: '', isNew: true }])
    setNewEtapeNom('')
  }

  function handleDeleteEtape(index: number) {
    const etape = etapes[index]
    if (!etape.isNew) setDeletedIds(prev => [...prev, etape.id])
    setEtapes(prev => prev.filter((_, i) => i !== index).map((e, i) => ({ ...e, ordre: i + 1 })))
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
        type_contrat: form.type_contrat || null,
        puissance_kwc: form.puissance_kwc ? parseFloat(form.puissance_kwc) : null,
        date_prevue: form.date_prevue,
        date_fin_prevue: form.date_fin_prevue || null,
        statut: form.statut,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (errUpdate) { setError('Erreur lors de la mise à jour'); setSubmitting(false); return }

    // 2. Mettre à jour les étapes existantes
    const existantes = etapes.filter(e => !e.isNew)
    const nouvelles  = etapes.filter(e => e.isNew)

    await Promise.all(
      existantes.map(etape =>
        supabase.from('etapes').update({
          nom:     etape.nom.trim(),
          consigne: etape.consigne.trim() || null,
          ordre:   etape.ordre,
        }).eq('id', etape.id)
      )
    )

    if (nouvelles.length > 0) {
      await supabase.from('etapes').insert(
        nouvelles.map(e => ({
          chantier_id: id,
          nom:         e.nom.trim(),
          consigne:    e.consigne.trim() || null,
          ordre:       e.ordre,
          statut:      'non_fait',
        }))
      )
    }

    if (deletedIds.length > 0) {
      await supabase.from('etapes').delete().in('id', deletedIds)
    }

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
        <div className="max-w-2xl md:max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/chantier/${id}`)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-xl"
          >←</button>
          <h1 className="text-lg font-bold text-gray-900">Modifier le chantier</h1>
        </div>
      </header>

      <main className="max-w-2xl md:max-w-5xl mx-auto px-4 py-6">
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type d'installation *</label>
                <select name="type_installation" value={form.type_installation} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                  {TYPES_INSTALLATION.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type de contrat</label>
                <select name="type_contrat" value={form.type_contrat} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                  {TYPES_CONTRAT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Puissance (kWc)</label>
              <input name="puissance_kwc" value={form.puissance_kwc} onChange={handleChange}
                type="number" min="0.1" step="0.01" placeholder="6.00"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de début *</label>
                <input name="date_prevue" value={form.date_prevue} onChange={handleChange} required type="date"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de fin prévue</label>
                <input name="date_fin_prevue" value={form.date_fin_prevue} onChange={handleChange} type="date"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Statut</label>
              <select name="statut" value={form.statut} onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
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

          {/* ── Étapes ───────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-6 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div>
              <h2 className="font-semibold text-gray-900">Étapes du chantier</h2>
              <p className="text-xs text-gray-400 mt-0.5">Nom, ordre et consignes visibles par le technicien</p>
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
                      <span className="text-xs text-gray-400 w-5 text-center">{i + 1}.</span>
                      <input
                        type="text"
                        value={etape.nom}
                        onChange={e => handleEtapeNom(i, e.target.value)}
                        placeholder="Nom de l'étape"
                        className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteEtape(i)}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        title="Supprimer cette étape"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={etape.consigne}
                      onChange={e => handleEtapeConsigne(i, e.target.value)}
                      placeholder="Consigne (optionnel) — ex : vérifier les fixations, ~45 min…"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white text-gray-700 placeholder-gray-300"
                    />
                  </div>
                )
              })}
            </div>

            {/* Ajouter une étape */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newEtapeNom}
                onChange={e => setNewEtapeNom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddEtape())}
                placeholder="Nouvelle étape…"
                className="flex-1 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-gray-50 placeholder-gray-400"
              />
              <button
                type="button"
                onClick={handleAddEtape}
                disabled={!newEtapeNom.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
              >
                + Ajouter
              </button>
            </div>
          </section>

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
