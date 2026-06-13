import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createVisiteTechnique } from '@/hooks/useVisitesTechniques'
import { useDocumentTemplates } from '@/hooks/useDocumentTemplates'
import { supabase } from '@/lib/supabase'
import { VTType, isManagerRole } from '@/types'
import type { VTTemplateData } from '@/types'
import { ChevronLeft, ChevronRight, Save, CheckCircle, Building, Home, User, ClipboardList, Star } from 'lucide-react'
import {
  BToCStep1, BToCStep2, BToCStep3, BToCStep4, BToCStep5,
  BToBStep1, BToBStep2, BToBStep3, BToBStep4, BToBStep5, BToBStep6, BToBStep7, BToBPhotosStep,
} from '@/components/vt/VTFormSteps'
import DynamicVTStep from '@/components/vt/DynamicVTStep'
import VTCroquisButton from '@/components/vt/VTCroquisButton'
import type { CroquisDoc } from '@/components/croquis/CroquisManager'

export default function VTCreate() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isManager = isManagerRole(profile?.role)

  // Modèles personnalisés de l'entreprise
  const { templates: vtTemplates, loading: templatesLoading } = useDocumentTemplates(
    profile?.entreprise_id,
    'vt',
  )

  const [step, setStep] = useState(0)
  const [vtType, setVtType] = useState<VTType | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [vtId, setVtId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [creating, setCreating] = useState(false)

  // Sélecteur de technicien (pour managers)
  const [techniciens, setTechniciens] = useState<{ id: string; full_name: string }[]>([])
  const [selectedTechId, setSelectedTechId] = useState<string>('')

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Charger la liste des techniciens si manager
  useEffect(() => {
    if (!isManager || !profile?.entreprise_id) return
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('entreprise_id', profile.entreprise_id)
      .order('full_name')
      .then(({ data }) => {
        if (data) {
          setTechniciens(data as { id: string; full_name: string }[])
          const first = (data as { id: string; full_name: string }[]).find(t => t.id !== profile.id)
          setSelectedTechId(first?.id ?? profile.id)
        }
      })
  }, [isManager, profile?.entreprise_id, profile?.id])

  useEffect(() => {
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current) }
  }, [])

  // Template sélectionné (si custom)
  const activeTemplate = selectedTemplateId
    ? vtTemplates.find(t => t.id === selectedTemplateId) ?? null
    : null
  const templateSteps = activeTemplate
    ? ((activeTemplate.template_data as VTTemplateData).steps ?? [])
    : []

  async function handleTypeSelect(type: VTType, templateId?: string) {
    if (!profile?.id || creating) return
    setCreating(true)
    const techId = isManager && selectedTechId ? selectedTechId : profile.id
    const id = await createVisiteTechnique(type, techId, templateId ?? null)
    if (!id) { setCreating(false); return }
    setVtType(type)
    setSelectedTemplateId(templateId ?? null)
    setVtId(id)
    setStep(1)
    setCreating(false)
  }

  function handleDataChange(data: Record<string, unknown>) {
    setFormData(data)
    if (!vtId) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      setSaving(true)
      const updates: Record<string, unknown> = { data, updated_at: new Date().toISOString() }
      if (data['client_nom']) updates['client_nom'] = data['client_nom']
      if (data['client_adresse']) updates['client_adresse'] = data['client_adresse']
      else if (data['adresse_site']) updates['client_adresse'] = data['adresse_site']
      const { error } = await supabase.from('visites_techniques').update(updates).eq('id', vtId)
      setSaving(false)
      setSaveError(!!error)
    }, 1500)
  }

  async function handleFinish() {
    if (!vtId) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    setSaving(true)
    const { error } = await supabase.from('visites_techniques').update({
      data: formData,
      statut: 'complete',
      client_nom: (formData['client_nom'] as string) ?? null,
      client_adresse: ((formData['client_adresse'] as string) ?? (formData['adresse_site'] as string)) ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', vtId)
    setSaving(false)
    if (error) { setSaveError(true); return }
    navigate(`/vt/${vtId}`)
  }

  // ── Étapes standard BtoC / BtoB ──────────────────────────────────────────────
  const btocSteps = [
    { label: 'Général',    component: <BToCStep1 data={formData} onChange={handleDataChange} /> },
    { label: 'Électrique', component: <BToCStep2 data={formData} onChange={handleDataChange} /> },
    { label: 'Couverture', component: <BToCStep3 data={formData} onChange={handleDataChange} /> },
    { label: 'Calepinage', component: <BToCStep4 data={formData} onChange={handleDataChange} /> },
    { label: 'Photos',     component: <BToCStep5 data={formData} onChange={handleDataChange} vtId={vtId ?? ''} /> },
  ]
  const btobSteps = [
    { label: 'Général',    component: <BToBStep1 data={formData} onChange={handleDataChange} /> },
    { label: 'Couverture', component: <BToBStep2 data={formData} onChange={handleDataChange} /> },
    { label: 'Structure',  component: <BToBStep3 data={formData} onChange={handleDataChange} /> },
    { label: 'Électrique', component: <BToBStep4 data={formData} onChange={handleDataChange} /> },
    { label: 'Shelter',    component: <BToBStep5 data={formData} onChange={handleDataChange} /> },
    { label: 'Sécurité',   component: <BToBStep6 data={formData} onChange={handleDataChange} /> },
    { label: 'Admin',      component: <BToBStep7 data={formData} onChange={handleDataChange} /> },
    { label: 'Photos',     component: <BToBPhotosStep data={formData} onChange={handleDataChange} vtId={vtId ?? ''} /> },
  ]

  // ── Étapes custom (template) ──────────────────────────────────────────────────
  const customSteps = templateSteps.map(tplStep => ({
    label: tplStep.label,
    component: (
      <DynamicVTStep
        step={tplStep}
        data={formData}
        onChange={handleDataChange}
        vtId={vtId ?? ''}
      />
    ),
  }))

  const steps = vtType === 'custom'
    ? customSteps
    : vtType === 'btoc'
      ? btocSteps
      : btobSteps

  const currentStep = step > 0 ? steps[step - 1] : null
  const isLastStep  = step > 0 && step === steps.length

  // ── Titre de l'étape dans le header ──────────────────────────────────────────
  function headerTitle() {
    if (step === 0) return 'Nouvelle Visite Technique'
    if (vtType === 'custom') return `${activeTemplate?.name ?? 'Custom'} — ${currentStep?.label}`
    return `${vtType === 'btoc' ? 'BtoC' : 'BtoB'} — ${currentStep?.label}`
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => { if (step > 1) setStep(s => s - 1); else navigate(-1) }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{step > 1 ? 'Précédent' : 'Retour'}</span>
          </button>
          <div className="text-center">
            <h1 className="font-bold text-slate-900 text-base">{headerTitle()}</h1>
            {step > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">Étape {step} / {steps.length}</p>
            )}
          </div>
          {saving ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              Sauvegarde...
            </div>
          ) : saveError ? (
            <span className="text-xs text-red-500 font-medium">Erreur save</span>
          ) : step > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Save className="w-3.5 h-3.5" />
              Sauvegardé
            </div>
          ) : <div className="w-24" />}
        </div>

        {/* Barre de progression */}
        {step > 0 && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-3">
            <div className="flex gap-1">
              {steps.map((_s, i) => (
                <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i < step ? 'bg-orange-500' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Étape 0 : choix type + technicien */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Nouvelle Visite Technique</h2>
              <p className="text-slate-500 text-sm">Sélectionnez le contexte de la visite</p>
            </div>

            {/* Sélecteur technicien (managers uniquement) */}
            {isManager && techniciens.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-slate-700">Technicien assigné</span>
                </div>
                <select
                  value={selectedTechId}
                  onChange={e => setSelectedTechId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white"
                >
                  {techniciens.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}{t.id === profile?.id ? ' (moi)' : ''}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">Le technicien pourra reprendre et compléter cette VT sur place</p>
              </div>
            )}

            {/* Modèles personnalisés de l'entreprise */}
            {!templatesLoading && vtTemplates.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Modèles de votre entreprise
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {vtTemplates.map(tpl => {
                    const tplSteps = ((tpl.template_data as VTTemplateData).steps ?? [])
                    const totalFields = tplSteps.reduce((s, st) => s + st.fields.length, 0)
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => handleTypeSelect('custom', tpl.id)}
                        disabled={creating}
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-left hover:shadow-md hover:border-orange-200 hover:-translate-y-0.5 transition-all group disabled:opacity-50"
                      >
                        <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
                          <ClipboardList className="w-5 h-5 text-orange-500" />
                        </div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-bold text-slate-900 text-base truncate">{tpl.name}</h3>
                          {tpl.is_default && <Star className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-slate-400 mb-1 truncate">{tpl.description}</p>
                        )}
                        <p className="text-xs text-slate-400">
                          {tplSteps.length} section{tplSteps.length > 1 ? 's' : ''} · {totalFields} champ{totalFields > 1 ? 's' : ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Formulaires standard BtoC / BtoB */}
            <div>
              {vtTemplates.length > 0 && (
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Formulaires standard
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => handleTypeSelect('btoc')}
                  disabled={creating}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-left hover:shadow-md hover:border-purple-200 hover:-translate-y-0.5 transition-all group disabled:opacity-50"
                >
                  <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                    <Home className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">BtoC</h3>
                  <p className="text-sm text-slate-500">Résidentiel — Particuliers</p>
                  <p className="text-xs text-slate-400 mt-2">5 étapes</p>
                </button>

                <button
                  onClick={() => handleTypeSelect('btob')}
                  disabled={creating}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-left hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all group disabled:opacity-50"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                    <Building className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">BtoB</h3>
                  <p className="text-sm text-slate-500">Professionnel — Entreprises</p>
                  <p className="text-xs text-slate-400 mt-2">8 étapes</p>
                </button>
              </div>
            </div>

            {creating && (
              <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-4">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                Création en cours...
              </div>
            )}
          </div>
        )}

        {/* Étapes de formulaire */}
        {step > 0 && currentStep && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
            {currentStep.component}

            {saveError && (
              <p className="mt-4 text-sm text-red-500 font-medium text-center">
                ⚠️ Erreur lors de la sauvegarde. Vérifiez votre connexion.
              </p>
            )}

            {/* Navigation bas */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>

              {isLastStep ? (
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Terminer
                </button>
              ) : (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {step > 0 && vtId && (
        <VTCroquisButton
          value={(formData['__croquis'] as CroquisDoc[] | undefined) ?? []}
          onChange={docs => handleDataChange({ ...formData, __croquis: docs })}
        />
      )}
    </div>
  )
}
