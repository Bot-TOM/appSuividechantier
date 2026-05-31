import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { VTTemplateStep, VTTemplateField, VTFieldType } from '@/types'
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Props {
  initialSteps?: VTTemplateStep[]
  onSave:        (steps: VTTemplateStep[]) => void
  onCancel:      () => void
  saving?:       boolean
}

const FIELD_TYPE_LABELS: Record<VTFieldType, string> = {
  text:     'Texte court',
  textarea: 'Texte long',
  number:   'Nombre',
  date:     'Date',
  select:   'Liste de choix',
  radio:    'Choix unique',
  boolean:  'Oui / Non',
  photo:    'Zone photos',
}
const FIELD_TYPES: VTFieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'radio', 'boolean', 'photo']

function toKey(label: string): string {
  return label.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || `field_${Date.now()}`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Éditeur d'un champ ────────────────────────────────────────────────────────
function FieldRow({ field, stepIdx, fieldIdx, onChange, onDelete }: {
  field:    VTTemplateField
  stepIdx:  number
  fieldIdx: number
  onChange: (si: number, fi: number, patch: Partial<VTTemplateField>) => void
  onDelete: (si: number, fi: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [optInput, setOptInput] = useState('')

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-gray-300 text-xs w-4 text-center flex-shrink-0">{fieldIdx + 1}</span>
        <input
          type="text"
          value={field.label}
          onChange={e => onChange(stepIdx, fieldIdx, { label: e.target.value, key: toKey(e.target.value) })}
          placeholder="Libellé du champ"
          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-0"
        />
        <select
          value={field.type}
          onChange={e => {
            const t = e.target.value as VTFieldType
            onChange(stepIdx, fieldIdx, {
              type: t,
              options: (t === 'select' || t === 'radio') ? (field.options ?? []) : undefined,
            })
          }}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white flex-shrink-0"
        >
          {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
        </select>
        <button type="button" onClick={() => setExpanded(e => !e)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 flex-shrink-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={() => onDelete(stepIdx, fieldIdx)} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-50 bg-gray-50/50 space-y-2.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
            <input type="checkbox" checked={field.required ?? false} onChange={e => onChange(stepIdx, fieldIdx, { required: e.target.checked })} className="w-3.5 h-3.5 rounded accent-orange-500" />
            Champ obligatoire
          </label>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Placeholder (optionnel)</label>
            <input type="text" value={field.placeholder ?? ''} onChange={e => onChange(stepIdx, fieldIdx, { placeholder: e.target.value || undefined })} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
          </div>
          {(field.type === 'select' || field.type === 'radio') && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">Options</p>
              <div className="flex flex-wrap gap-1.5">
                {(field.options ?? []).map((opt, oi) => (
                  <span key={oi} className="flex items-center gap-1 bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                    {opt}
                    <button type="button" onClick={() => onChange(stepIdx, fieldIdx, { options: (field.options ?? []).filter((_, j) => j !== oi) })} className="hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={optInput}
                  onChange={e => setOptInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (optInput.trim()) { onChange(stepIdx, fieldIdx, { options: [...(field.options ?? []), optInput.trim()] }); setOptInput('') } } }}
                  placeholder="Nouvelle option…"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
                <button type="button" onClick={() => { if (optInput.trim()) { onChange(stepIdx, fieldIdx, { options: [...(field.options ?? []), optInput.trim()] }); setOptInput('') } }} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}>+</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Éditeur principal ─────────────────────────────────────────────────────────
export default function VTTemplateEditor({ initialSteps = [], onSave, onCancel, saving = false }: Props) {
  const [steps, setSteps] = useState<VTTemplateStep[]>(initialSteps)

  // IA
  const [analyzing,  setAnalyzing]  = useState(false)
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null)
  const [analyzeOk,  setAnalyzeOk]  = useState(false)
  const [dragOver,   setDragOver]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const analyzeFile = useCallback(async (file: File) => {
    setAnalyzeErr(null); setAnalyzeOk(false); setAnalyzing(true)
    try {
      const base64 = await fileToBase64(file)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('analyze-template', {
        body: { file_base64: base64, mime_type: file.type || 'application/pdf', category: 'vt' },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (res.error) throw new Error(res.error.message)
      const result = res.data as { steps?: VTTemplateStep[]; error?: string }
      if (result.error) throw new Error(result.error)
      const proposed = result.steps ?? []
      if (proposed.length === 0) {
        setAnalyzeErr('Aucune section détectée dans ce document. Construisez le template manuellement.')
        return
      }
      setSteps(proposed)
      setAnalyzeOk(true)
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : "Erreur lors de l'analyse")
    } finally {
      setAnalyzing(false)
    }
  }, [])

  // Gestion steps
  function addStep() {
    setSteps(s => [...s, { key: `step_${Date.now()}`, label: '', fields: [] }])
  }
  function removeStep(si: number) {
    setSteps(s => s.filter((_, i) => i !== si))
  }
  function changeStepLabel(si: number, label: string) {
    setSteps(s => s.map((x, i) => i === si ? { ...x, label, key: toKey(label) || x.key } : x))
  }
  function addField(si: number) {
    const newField: VTTemplateField = { key: `field_${Date.now()}`, label: '', type: 'text' }
    setSteps(s => s.map((x, i) => i === si ? { ...x, fields: [...x.fields, newField] } : x))
  }
  function changeField(si: number, fi: number, patch: Partial<VTTemplateField>) {
    setSteps(s => s.map((step, i) => i !== si ? step : {
      ...step,
      fields: step.fields.map((f, j) => j !== fi ? f : { ...f, ...patch }),
    }))
  }
  function deleteField(si: number, fi: number) {
    setSteps(s => s.map((step, i) => i !== si ? step : { ...step, fields: step.fields.filter((_, j) => j !== fi) }))
  }

  return (
    <div className="space-y-5">
      {/* ── Zone import IA ────────────────────────────────────────────────── */}
      <section
        className={`rounded-2xl border-2 border-dashed cursor-pointer transition-all p-5 ${dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50/50 hover:border-orange-300'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) analyzeFile(f) }}
        onClick={() => !analyzing && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) analyzeFile(f); e.target.value = '' }} />
        <div className="flex items-center gap-3">
          {analyzing
            ? <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            : <Sparkles className="w-5 h-5 text-orange-500 flex-shrink-0" />
          }
          <div>
            <p className="text-sm font-semibold text-gray-700">
              {analyzing ? 'Analyse en cours…' : 'Importer un modèle via l\'IA'}
            </p>
            <p className="text-xs text-gray-400">PDF ou image · l'IA générera les sections et champs</p>
          </div>
          <Upload className="w-4 h-4 text-gray-300 ml-auto" />
        </div>
      </section>

      {analyzeErr && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{analyzeErr}</p>
        </div>
      )}
      {analyzeOk && !analyzeErr && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-xl">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <p><strong>{steps.length} section{steps.length > 1 ? 's' : ''}</strong> générée{steps.length > 1 ? 's' : ''} — modifiez puis enregistrez.</p>
        </div>
      )}

      {/* ── Sections (steps) ──────────────────────────────────────────────── */}
      {steps.map((step, si) => (
        <div key={step.key + si} className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {/* En-tête de la section */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{si + 1}</span>
            <input
              type="text"
              value={step.label}
              onChange={e => changeStepLabel(si, e.target.value)}
              placeholder={`Section ${si + 1}…`}
              className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
            <button type="button" onClick={() => removeStep(si)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Champs */}
          <div className="p-3 space-y-1.5">
            {step.fields.map((field, fi) => (
              <FieldRow key={field.key + fi} field={field} stepIdx={si} fieldIdx={fi} onChange={changeField} onDelete={deleteField} />
            ))}
            <button type="button" onClick={() => addField(si)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Ajouter un champ
            </button>
          </div>
        </div>
      ))}

      {/* ── Ajouter une section ────────────────────────────────────────────── */}
      <button type="button" onClick={addStep} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors">
        <Plus className="w-4 h-4" />
        Ajouter une section
      </button>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
          Annuler
        </button>
        <button
          type="button"
          onClick={() => onSave(steps)}
          disabled={saving || steps.length === 0}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer le template'}
        </button>
      </div>
    </div>
  )
}
