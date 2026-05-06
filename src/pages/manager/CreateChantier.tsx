import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTechniciens } from '@/hooks/useTechniciens'

const ETAPES_DEFAUT = [
  'Pose de la structure',
  'Câblage DC',
  'Raccordement électrique',
  'Mise en service',
  'Nettoyage et finitions',
]

const TYPES_INSTALLATION = ['Résidentiel', 'Professionnel', 'Industriel', 'Agricole']

const TYPES_CONTRAT: { value: string; label: string }[] = [
  { value: '',                       label: 'Non précisé' },
  { value: 'revente_totale',         label: 'Revente totale' },
  { value: 'autoconsommation',       label: 'Autoconsommation' },
  { value: 'autoconsommation_surplus', label: 'Autoconsommation + surplus' },
]

interface EtapeForm {
  nom: string
  consigne: string // note libre : instruction, contexte, durée indicative…
}

export default function CreateChantier() {
  const navigate = useNavigate()
  const { techniciens } = useTechniciens()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nom: '',
    client_nom: '',
    client_adresse: '',
    client_telephone: '',
    type_installation: 'Résidentiel',
    type_contrat: '',
    puissance_kwc: '',
    date_prevue: '',
    date_fin_prevue: '',
  })

  const [selectedTechs, setSelectedTechs] = useState<string[]>([])

  const [etapesForm, setEtapesForm] = useState<EtapeForm[]>(
    ETAPES_DEFAUT.map(nom => ({ nom, consigne: '' }))
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function toggleTech(id: string) {
    setSelectedTechs(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  function handleEtapeConsigne(index: number, value: string) {
    setEtapesForm(prev => prev.map((e, i) => i === index ? { ...e, consigne: value } : e))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // 1. Créer le chantier
    const { data: chantier, error: errChantier } = await supabase
      .from('chantiers')
      .insert({
        nom: form.nom,
        client_nom: form.client_nom,
        client_adresse: form.client_adresse,
        client_telephone: form.client_telephone || null,
        type_installation: form.type_installation,
        type_contrat: form.type_contrat || null,
        puissance_kwc: form.puissance_kwc ? parseFloat(form.puissance_kwc) : null,
        date_prevue: form.date_prevue,
        date_fin_prevue: form.date_fin_prevue || null,
        statut: 'en_attente',
      })
      .select()
      .single()

    if (errChantier || !chantier) {
      setError('Erreur lors de la création du chantier')
      setSubmitting(false)
      return
    }

    // 2. Assigner les techniciens
    if (selectedTechs.length > 0) {
      await supabase.from('chantier_techniciens').insert(
        selectedTechs.map(tid => ({ chantier_id: chantier.id, technicien_id: tid }))
      )
    }

    // 3. Créer les étapes avec leurs consignes
    await supabase.from('etapes').insert(
      etapesForm.map((e, i) => ({
        chantier_id: chantier.id,
        nom: e.nom,
        ordre: i + 1,
        statut: 'non_fait',
        consigne: e.consigne.trim() || null,
      }))
    )

    navigate('/manager')
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl md:max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/manager')}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-xl"
          >←</button>
          <h1 className="text-lg font-bold text-gray-900">Nouveau chantier</h1>
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
                placeholder="Ex: Dupont — 12 panneaux"
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Puissance (kWc) *</label>
              <input name="puissance_kwc" value={form.puissance_kwc} onChange={handleChange} required
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
          </section>

          {/* ── Client ────────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-6 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <h2 className="font-semibold text-gray-900">Client</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
              <input name="client_nom" value={form.client_nom} onChange={handleChange} required
                placeholder="Jean Dupont"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse *</label>
              <input name="client_adresse" value={form.client_adresse} onChange={handleChange} required
                placeholder="12 rue des Acacias, 69000 Lyon"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
              <input name="client_telephone" value={form.client_telephone} onChange={handleChange} type="tel"
                placeholder="06 12 34 56 78"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent" />
            </div>
          </section>

          {/* ── Étapes & consignes ────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-6 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div>
              <h2 className="font-semibold text-gray-900">Étapes & consignes</h2>
              <p className="text-xs text-gray-400 mt-0.5">Optionnel — ajoutez une note par étape visible par le technicien terrain</p>
            </div>

            <div className="space-y-2.5">
              {etapesForm.map((etape, i) => (
                <div key={i} className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
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
              ))}
            </div>
          </section>

          {/* ── Équipe assignée ───────────────────────────────────────────── */}
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
            {submitting ? 'Création...' : '+ Créer le chantier'}
          </button>

          <div className="h-2" />
        </form>
      </main>
    </div>
  )
}
