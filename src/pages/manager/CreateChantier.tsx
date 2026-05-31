import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTechniciens } from '@/hooks/useTechniciens'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDocumentTemplates } from '@/hooks/useDocumentTemplates'
import { isManagerRole } from '@/types'
import type { ChantierTemplateData, DocumentTemplate } from '@/types'
import { useChantierFields } from '@/hooks/useChantierFields'
import CustomFieldsSection from '@/components/chantier/CustomFieldsSection'
import { Star, FileText, X } from 'lucide-react'

const TYPES_INSTALLATION = [
  'Résidentiel',
  'Résidentiel collectif',
  'Tertiaire',
  'GMS',
  'Professionnel',
  'Industriel',
  'Agricole',
]

const TYPES_CONTRAT: { value: string; label: string }[] = [
  { value: '',                         label: 'Non précisé' },
  { value: 'revente_totale',           label: 'Vente totale' },
  { value: 'autoconsommation',         label: 'Autoconsommation individuelle et collective' },
  { value: 'autoconsommation_surplus', label: 'Autoconsommation avec revente de surplus' },
]

interface EtapeForm {
  nom: string
  consigne: string
}

// ── Picker modal ──────────────────────────────────────────────────────────────
function TemplatePicker({
  templates,
  onSelect,
  onSkip,
}: {
  templates: DocumentTemplate[]
  onSelect:  (tpl: DocumentTemplate) => void
  onSkip:    () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Choisir un modèle de fiche</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sélectionnez le modèle adapté à ce chantier</p>
          </div>
          <button onClick={onSkip}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Liste des modèles */}
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {templates.map(tpl => {
            const fields = (tpl.template_data as ChantierTemplateData).fields ?? []
            return (
              <button
                key={tpl.id}
                onClick={() => onSelect(tpl)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-orange-300 hover:bg-orange-50/30 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                  <FileText className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 truncate">{tpl.name}</span>
                    {tpl.is_default && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <Star className="w-2.5 h-2.5" /> Défaut
                      </span>
                    )}
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-gray-400 truncate">{tpl.description}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {fields.length} champ{fields.length > 1 ? 's' : ''}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>

        {/* Continuer sans modèle */}
        <div className="px-4 pb-4">
          <button onClick={onSkip}
            className="w-full py-3 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
            Continuer sans modèle
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function CreateChantier() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { can } = usePermissions()
  const { techniciens } = useTechniciens()
  const backUrl = isManagerRole(profile?.role) ? '/manager' : '/technicien'
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [newEtapeNom, setNewEtapeNom] = useState('')

  // Modèles chantier de l'entreprise
  const { templates: chantierTemplates, loading: templatesLoading } =
    useDocumentTemplates(profile?.entreprise_id, 'chantier')

  // Picker modal
  const [pickerShown, setPickerShown] = useState(false)
  const [pickerOpen,  setPickerOpen]  = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)

  // Champs issus du template sélectionné (ou de l'ancien système)
  const { activeFields: legacyFields } = useChantierFields(profile?.entreprise_id)

  // Ouvrir le picker une seule fois une fois les templates chargés
  useEffect(() => {
    if (!templatesLoading && !pickerShown && chantierTemplates.length > 0) {
      setPickerOpen(true)
      setPickerShown(true)
      // Pré-sélectionner le défaut silencieusement
      const def = chantierTemplates.find(t => t.is_default) ?? null
      if (def) setSelectedTemplate(def)
    } else if (!templatesLoading && !pickerShown) {
      setPickerShown(true) // pas de templates → pas de picker
    }
  }, [templatesLoading, chantierTemplates, pickerShown])

  // Champs actifs = depuis template sélectionné, sinon ancien système
  const templateFields = selectedTemplate
    ? ((selectedTemplate.template_data as ChantierTemplateData).fields ?? [])
        .filter(f => f.active !== false)
        .map(f => ({ ...f, id: f.field_key, entreprise_id: profile?.entreprise_id ?? '', position: 0, created_at: '' }))
    : null

  const activeFields = templateFields ?? legacyFields

  const [customData, setCustomData] = useState<Record<string, unknown>>({})

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
  const [etapesForm, setEtapesForm] = useState<EtapeForm[]>([])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function toggleTech(id: string) {
    setSelectedTechs(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  function handleAddEtape() {
    const nom = newEtapeNom.trim()
    if (!nom) return
    setEtapesForm(prev => [...prev, { nom, consigne: '' }])
    setNewEtapeNom('')
  }

  function handleDeleteEtape(index: number) {
    setEtapesForm(prev => prev.filter((_, i) => i !== index))
  }

  function handleEtapeField(index: number, field: 'nom' | 'consigne', value: string) {
    setEtapesForm(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e))
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
        entreprise_id: profile?.entreprise_id ?? null,
        template_id: selectedTemplate?.id ?? null,
        custom_data: Object.keys(customData).length > 0 ? customData : null,
      })
      .select()
      .single()

    if (errChantier || !chantier) {
      if (errChantier?.message === 'plan_limit_chantiers') {
        setError('Limite du plan Starter atteinte (3 chantiers max). Passez au plan Pro depuis votre tableau de bord.')
      } else {
        setError('Erreur lors de la création du chantier')
      }
      setSubmitting(false)
      return
    }

    // 2. Assigner les techniciens
    if (selectedTechs.length > 0) {
      await supabase.from('chantier_techniciens').insert(
        selectedTechs.map(tid => ({ chantier_id: chantier.id, technicien_id: tid }))
      )
      supabase.functions.invoke('send-push', {
        body: {
          table:  'assignation_chantier',
          record: {
            chantierId:    chantier.id,
            chantierNom:   form.nom,
            technicienIds: selectedTechs,
          },
        },
      }).catch(() => {})
    }

    // 3. Créer les étapes
    if (etapesForm.length > 0) {
      await supabase.from('etapes').insert(
        etapesForm.map((e, i) => ({
          chantier_id: chantier.id,
          nom: e.nom,
          ordre: i + 1,
          statut: 'non_fait',
          consigne: e.consigne.trim() || null,
        }))
      )
    }

    navigate(backUrl)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Picker modal */}
      {pickerOpen && chantierTemplates.length > 0 && (
        <TemplatePicker
          templates={chantierTemplates}
          onSelect={tpl => { setSelectedTemplate(tpl); setCustomData({}); setPickerOpen(false) }}
          onSkip={() => { setSelectedTemplate(null); setCustomData({}); setPickerOpen(false) }}
        />
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl md:max-w-5xl mx-auto px-4 py-5 flex items-center gap-3">
          <button
            onClick={() => navigate(backUrl)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-xl"
          >←</button>
          <h1 className="text-lg font-bold text-gray-900">Nouveau chantier</h1>
        </div>
      </header>

      <main className="max-w-2xl md:max-w-5xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Modèle sélectionné (badge) ─────────────────────────────────── */}
          {chantierTemplates.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 rounded-xl border border-orange-100">
              <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-gray-700 flex-1">
                Modèle :&nbsp;
                <span className="font-semibold text-orange-700">
                  {selectedTemplate ? selectedTemplate.name : 'Aucun'}
                </span>
              </p>
              <button type="button" onClick={() => setPickerOpen(true)}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2">
                Changer
              </button>
            </div>
          )}

          {/* ── Informations chantier ──────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-6 space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Informations chantier</h2>

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
          <section className="bg-white rounded-2xl p-6 space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Client</h2>
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

          {/* ── Étapes ────────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-6 space-y-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Étapes du chantier</h2>
              <p className="text-xs text-gray-400 mt-0.5">Nom et consignes visibles par le technicien</p>
            </div>

            <div className="space-y-2.5">
              {etapesForm.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Aucune étape — ajoutez-en ci-dessous</p>
              )}
              {etapesForm.map((etape, i) => (
                <div key={i} className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={etape.nom}
                      onChange={e => handleEtapeField(i, 'nom', e.target.value)}
                      placeholder="Nom de l'étape"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    />
                    <button type="button" onClick={() => handleDeleteEtape(i)}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={etape.consigne}
                    onChange={e => handleEtapeField(i, 'consigne', e.target.value)}
                    placeholder="Consigne (optionnel)"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white text-gray-700 placeholder-gray-300"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newEtapeNom}
                onChange={e => setNewEtapeNom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddEtape())}
                placeholder="Nouvelle étape…"
                className="flex-1 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 placeholder-gray-400"
              />
              <button type="button" onClick={handleAddEtape} disabled={!newEtapeNom.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                + Ajouter
              </button>
            </div>
          </section>

          {/* ── Champs personnalisés (template ou legacy) ─────────────────── */}
          {activeFields.length > 0 && (
            <section className="bg-white rounded-2xl p-6 space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  {selectedTemplate ? selectedTemplate.name : 'Infos spécifiques'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Champs personnalisés de votre entreprise</p>
              </div>
              <CustomFieldsSection
                fields={activeFields}
                values={customData}
                onChange={(key, val) => setCustomData(prev => ({ ...prev, [key]: val }))}
              />
            </section>
          )}

          {/* ── Équipe assignée ───────────────────────────────────────────── */}
          {can('assigner_techniciens') && (
            <section className="bg-white rounded-2xl p-6 space-y-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Équipe assignée</h2>
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
          )}

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
