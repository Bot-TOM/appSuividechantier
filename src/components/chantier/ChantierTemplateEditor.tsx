import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChantierFieldType } from '@/types'
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'

// ── Types locaux ──────────────────────────────────────────────────────────────
export interface ChantierDraftField {
  field_key:     string
  field_label:   string
  field_type:    ChantierFieldType
  field_options: string[] | null
  section:       string | null
  required:      boolean
  active:        boolean
}

interface Props {
  initialFields?: ChantierDraftField[]
  onSave:        (fields: ChantierDraftField[]) => void
  onCancel:      () => void
  saving?:       boolean
}

const FIELD_TYPE_LABELS: Record<ChantierFieldType, string> = {
  text:     'Texte court',
  textarea: 'Texte long',
  number:   'Nombre',
  date:     'Date',
  select:   'Liste de choix',
  boolean:  'Oui / Non',
}
const FIELD_TYPES: ChantierFieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'boolean']

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
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Ligne d'un champ ──────────────────────────────────────────────────────────
function FieldRow({
  field, index, onChange, onDelete,
}: {
  field:    ChantierDraftField
  index:    number
  onChange: (i: number, patch: Partial<ChantierDraftField>) => void
  onDelete: (i: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [optInput, setOptInput] = useState('')

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-gray-300 text-xs w-4 text-center flex-shrink-0">{index + 1}</span>
        <input
          type="text"
          value={field.field_label}
          onChange={e => onChange(index, { field_label: e.target.value, field_key: toKey(e.target.value) })}
          placeholder="Libellé du champ"
          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-0"
        />
        <select
          value={field.field_type}
          onChange={e => {
            const t = e.target.value as ChantierFieldType
            onChange(index, { field_type: t, field_options: t === 'select' ? (field.field_options ?? []) : null })
          }}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white flex-shrink-0"
        >
          {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
        </select>
        <button type="button" onClick={() => setExpanded(e => !e)}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 flex-shrink-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={() => onDelete(index)}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-50 bg-gray-50/50 space-y-2.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
            <input type="checkbox" checked={field.required} onChange={e => onChange(index, { required: e.target.checked })} className="w-3.5 h-3.5 rounded accent-orange-500" />
            Champ obligatoire
          </label>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Section (optionnel)</label>
            <input type="text" value={field.section ?? ''} onChange={e => onChange(index, { section: e.target.value || null })}
              placeholder="Ex: Toiture, Électrique…"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
          </div>
          {field.field_type === 'select' && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">Options</p>
              <div className="flex flex-wrap gap-1.5">
                {(field.field_options ?? []).map((opt, oi) => (
                  <span key={oi} className="flex items-center gap-1 bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                    {opt}
                    <button type="button"
                      onClick={() => onChange(index, { field_options: (field.field_options ?? []).filter((_, j) => j !== oi) })}
                      className="hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input type="text" value={optInput} onChange={e => setOptInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (optInput.trim()) { onChange(index, { field_options: [...(field.field_options ?? []), optInput.trim()] }); setOptInput('') } } }}
                  placeholder="Nouvelle option…"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                <button type="button"
                  onClick={() => { if (optInput.trim()) { onChange(index, { field_options: [...(field.field_options ?? []), optInput.trim()] }); setOptInput('') } }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}>+</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Éditeur principal ─────────────────────────────────────────────────────────
export default function ChantierTemplateEditor({ initialFields = [], onSave, onCancel, saving = false }: Props) {
  const [fields, setFields] = useState<ChantierDraftField[]>(initialFields)

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
        body: { file_base64: base64, mime_type: file.type || 'application/pdf', category: 'chantier' },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (res.error) throw new Error(res.error.message)
      const result = res.data as { fields?: { field_key: string; field_label: string; field_type: ChantierFieldType; field_options: string[] | null; section: string | null; required: boolean }[]; error?: string }
      if (result.error) throw new Error(result.error)
      const proposed = result.fields ?? []
      if (proposed.length === 0) { setAnalyzeErr('Aucun champ détecté. Construisez le modèle manuellement.'); return }
      setFields(proposed.map(f => ({ ...f, active: true })))
      setAnalyzeOk(true)
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : "Erreur lors de l'analyse")
    } finally {
      setAnalyzing(false)
    }
  }, [])

  function addField() {
    setFields(f => [...f, { field_key: `field_${Date.now()}`, field_label: '', field_type: 'text', field_options: null, section: null, required: false, active: true }])
  }
  function changeField(i: number, patch: Partial<ChantierDraftField>) {
    setFields(f => f.map((x, j) => j !== i ? x : { ...x, ...patch }))
  }
  function deleteField(i: number) {
    setFields(f => f.filter((_, j) => j !== i))
  }

  return (
    <div className="space-y-5">
      {/* Zone import IA */}
      <section
        className={`rounded-2xl border-2 border-dashed cursor-pointer transition-all p-5 ${dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50/50 hover:border-orange-300'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) analyzeFile(f) }}
        onClick={() => !analyzing && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) analyzeFile(f); e.target.value = '' }} />
        <div className="flex items-center gap-3">
          {analyzing
            ? <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            : <Sparkles className="w-5 h-5 text-orange-500 flex-shrink-0" />
          }
          <div>
            <p className="text-sm font-semibold text-gray-700">
              {analyzing ? 'Analyse en cours…' : "Importer un modèle via l'IA"}
            </p>
            <p className="text-xs text-gray-400">PDF ou image · l'IA extraira les champs spécifiques à votre entreprise</p>
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
          <p><strong>{fields.length} champ{fields.length > 1 ? 's' : ''}</strong> généré{fields.length > 1 ? 's' : ''} — vérifiez puis enregistrez.</p>
        </div>
      )}

      {/* Liste des champs */}
      {fields.length > 0 && (
        <div className="space-y-1.5">
          {fields.map((field, i) => (
            <FieldRow key={i} field={field} index={i} onChange={changeField} onDelete={deleteField} />
          ))}
        </div>
      )}

      {/* Ajouter un champ */}
      <button type="button" onClick={addField}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors">
        <Plus className="w-4 h-4" />
        Ajouter un champ
      </button>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
          Annuler
        </button>
        <button type="button" onClick={() => onSave(fields)}
          disabled={saving || fields.length === 0}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}>
          {saving ? 'Enregistrement…' : 'Enregistrer le modèle'}
        </button>
      </div>
    </div>
  )
}
