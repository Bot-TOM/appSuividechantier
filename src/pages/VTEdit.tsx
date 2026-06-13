import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { VisiteTechnique, isManagerRole } from '@/types'
import { ChevronLeft, ChevronRight, Save, CheckCircle } from 'lucide-react'
import {
  BToCStep1, BToCStep2, BToCStep3, BToCStep4, BToCStep5,
  BToBStep1, BToBStep2, BToBStep3, BToBStep4, BToBStep5, BToBStep6, BToBStep7, BToBPhotosStep,
} from '@/components/vt/VTFormSteps'
import VTCroquisButton from '@/components/vt/VTCroquisButton'
import type { CroquisDoc } from '@/components/croquis/CroquisManager'

export default function VTEdit() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isManager = isManagerRole(profile?.role)

  const [vt, setVt] = useState<VisiteTechnique | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Charger la VT existante
  useEffect(() => {
    if (!id) return
    supabase
      .from('visites_techniques')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          navigate(-1)
          return
        }
        const vtData = data as VisiteTechnique
        // Vérifier que l'utilisateur peut modifier (pas validée)
        if (vtData.statut === 'valide') {
          navigate(`/vt/${id}`)
          return
        }
        // Vérifier que c'est le bon technicien ou un manager
        if (!isManager && profile?.id !== vtData.technicien_id) {
          navigate(-1)
          return
        }
        setVt(vtData)
        setFormData(vtData.data ?? {})
        setLoading(false)
      })
  }, [id, isManager, profile?.id, navigate])

  useEffect(() => {
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current) }
  }, [])

  function handleDataChange(data: Record<string, unknown>) {
    setFormData(data)
    if (!id) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      setSaving(true)
      const updates: Record<string, unknown> = { data, updated_at: new Date().toISOString() }
      if (data['client_nom']) updates['client_nom'] = data['client_nom']
      if (data['client_adresse']) updates['client_adresse'] = data['client_adresse']
      else if (data['adresse_site']) updates['client_adresse'] = data['adresse_site']
      const { error } = await supabase.from('visites_techniques').update(updates).eq('id', id)
      setSaving(false)
      setSaveError(!!error)
    }, 1500)
  }

  async function handleFinish() {
    if (!id) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    setSaving(true)
    const { error } = await supabase.from('visites_techniques').update({
      data: formData,
      statut: 'complete',
      client_nom: (formData['client_nom'] as string) ?? null,
      client_adresse: ((formData['client_adresse'] as string) ?? (formData['adresse_site'] as string)) ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    if (error) {
      setSaveError(true)
      return
    }
    navigate(`/vt/${id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!vt) return null

  const isBtoc = vt.type === 'btoc'

  const btocSteps = [
    { label: 'Général',    component: <BToCStep1 data={formData} onChange={handleDataChange} /> },
    { label: 'Électrique', component: <BToCStep2 data={formData} onChange={handleDataChange} /> },
    { label: 'Couverture', component: <BToCStep3 data={formData} onChange={handleDataChange} /> },
    { label: 'Calepinage', component: <BToCStep4 data={formData} onChange={handleDataChange} /> },
    { label: 'Photos',     component: <BToCStep5 data={formData} onChange={handleDataChange} vtId={id ?? ''} /> },
  ]
  const btobSteps = [
    { label: 'Général',    component: <BToBStep1 data={formData} onChange={handleDataChange} /> },
    { label: 'Couverture', component: <BToBStep2 data={formData} onChange={handleDataChange} /> },
    { label: 'Structure',  component: <BToBStep3 data={formData} onChange={handleDataChange} /> },
    { label: 'Électrique', component: <BToBStep4 data={formData} onChange={handleDataChange} /> },
    { label: 'Shelter',    component: <BToBStep5 data={formData} onChange={handleDataChange} /> },
    { label: 'Sécurité',   component: <BToBStep6 data={formData} onChange={handleDataChange} /> },
    { label: 'Admin',      component: <BToBStep7 data={formData} onChange={handleDataChange} /> },
    { label: 'Photos',     component: <BToBPhotosStep data={formData} onChange={handleDataChange} vtId={id ?? ''} /> },
  ]

  const steps = isBtoc ? btocSteps : btobSteps
  const currentStep = steps[step - 1]
  const isLastStep = step === steps.length

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => { if (step > 1) setStep(s => s - 1); else navigate(`/vt/${id}`) }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{step > 1 ? 'Précédent' : 'Retour'}</span>
          </button>
          <div className="text-center">
            <h1 className="font-bold text-slate-900 text-base">
              {isBtoc ? 'BtoC' : 'BtoB'} — {currentStep?.label}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Étape {step} / {steps.length}</p>
          </div>
          {saving ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              Sauvegarde...
            </div>
          ) : saveError ? (
            <span className="text-xs text-red-500 font-medium">Erreur</span>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Save className="w-3.5 h-3.5" />
              Sauvegardé
            </div>
          )}
        </div>

        {/* Barre de progression */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-3">
          <div className="flex gap-1">
            {steps.map((_s, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i < step ? 'bg-orange-500' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Bandeau VT en cours d'édition */}
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <span className="text-orange-500 text-lg">✏️</span>
          <div>
            <p className="text-sm font-semibold text-orange-800">Modification de la VT</p>
            <p className="text-xs text-orange-600">{vt.client_nom ?? 'Sans titre'} — {isBtoc ? 'BtoC' : 'BtoB'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
          {currentStep?.component}

          {saveError && (
            <p className="mt-4 text-sm text-red-500 font-medium text-center">
              ⚠️ Erreur lors de la sauvegarde. Vérifiez votre connexion.
            </p>
          )}

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
      </main>

      <VTCroquisButton
        value={(formData['__croquis'] as CroquisDoc[] | undefined) ?? []}
        onChange={docs => handleDataChange({ ...formData, __croquis: docs })}
      />
    </div>
  )
}
