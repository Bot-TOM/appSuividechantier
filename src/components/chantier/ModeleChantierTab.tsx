import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useChantierFields } from '@/hooks/useChantierFields'
import type { ChantierFieldDef, ChantierFieldType } from '@/types'
import { Upload, Sparkles, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Props {
  entrepriseId: string
}

type DraftField = Omit<ChantierFieldDef, 'id' | 'entreprise_id' | 'created_at'>

const FIELD_TYPE_LABELS: Record<ChantierFieldType, string> = {
  text:     'Texte court',
  textarea: 'Texte long',
  number:   'Nombre',
  date:     'Date',
  select:   'Liste de choix',
  boolean:  'Oui / Non',
}

const FIELD_TYPES: ChantierFieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'boolean']

// ── Composant d'édition d'un champ (draft) ────────────────────────────────────
function DraftFieldRow({
  field, index, onChange, onDelete,
}: {
  field:    DraftField
  index:    number
  onChange: (i: number, patch: Partial<DraftField>) => void
  onDelete: (i: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [optionInput, setOptionInput] = useState('')

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {/* ── Ligne principale ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-gray-300 text-xs font-mono w-5 text-center flex-shrink-0">{index + 1}</span>

        {/* Libellé */}
        <input
          type="text"
          value={field.field_label}
          onChange={e => onChange(index, { field_label: e.target.value, field_key: toKey(e.target.value) })}
          placeholder="Nom du champ"
          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-0"
        />

        {/* Type */}
        <select
          value={field.field_type}
          onChange={e => onChange(index, { field_type: e.target.value as ChantierFieldType, field_options: e.target.value === 'select' ? (field.field_options ?? []) : null })}
          className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white flex-shrink-0"
        >
          {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
        </select>

        {/* Expand / delete */}
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 flex-shrink-0"
          title="Options"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Options étendues ──────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-50 space-y-3 bg-gray-50/50">
          {/* Section */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Section (regroupement)</label>
            <input
              type="text"
              value={field.section ?? ''}
              onChange={e => onChange(index, { section: e.target.value || null })}
              placeholder="Ex: Technique, Administratif…"
              className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
          </div>

          {/* Obligatoire */}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <input
              type="checkbox"
              checked={field.required}
              onChange={e => onChange(index, { required: e.target.checked })}
              className="w-4 h-4 rounded accent-orange-500"
            />
            Champ obligatoire
          </label>

          {/* Options de liste */}
          {field.field_type === 'select' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Options de la liste</p>
              <div className="flex flex-wrap gap-1.5">
                {(field.field_options ?? []).map((opt, oi) => (
                  <span key={oi} className="flex items-center gap-1 bg-orange-50 text-orange-700 text-xs px-2 py-1 rounded-full">
                    {opt}
                    <button
                      type="button"
                      onClick={() => onChange(index, { field_options: (field.field_options ?? []).filter((_, j) => j !== oi) })}
                      className="hover:text-red-500 ml-0.5"
                    >×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (optionInput.trim()) {
                        onChange(index, { field_options: [...(field.field_options ?? []), optionInput.trim()] })
                        setOptionInput('')
                      }
                    }
                  }}
                  placeholder="Nouvelle option…"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (optionInput.trim()) {
                      onChange(index, { field_options: [...(field.field_options ?? []), optionInput.trim()] })
                      setOptionInput('')
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
                >
                  + Ajouter
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Composant ligne de champ actif (gestion) ──────────────────────────────────
function ActiveFieldRow({
  field, onToggle, onDelete,
}: {
  field:    ChantierFieldDef
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
      field.active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'
    }`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{field.field_label}</p>
        <p className="text-xs text-gray-400">{FIELD_TYPE_LABELS[field.field_type]}{field.section ? ` · ${field.section}` : ''}</p>
      </div>
      <button
        type="button"
        onClick={() => onToggle(field.id, !field.active)}
        title={field.active ? 'Désactiver' : 'Activer'}
        className={`flex-shrink-0 transition-colors ${field.active ? 'text-orange-500' : 'text-gray-300'}`}
      >
        {field.active
          ? <ToggleRight className="w-5 h-5" />
          : <ToggleLeft  className="w-5 h-5" />
        }
      </button>
      <button
        type="button"
        onClick={() => onDelete(field.id)}
        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
        title="Supprimer définitivement"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function ModeleChantierTab({ entrepriseId }: Props) {
  const { fields, loading, saveFields, toggleActive, deleteField } = useChantierFields(entrepriseId)

  // États de l'import IA
  const [dragOver,   setDragOver]   = useState(false)
  const [analyzing,  setAnalyzing]  = useState(false)
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null)
  const [analyzeOk,  setAnalyzeOk]  = useState(false)

  // Champs en cours d'édition (après analyse IA ou manuel)
  const [drafts,     setDrafts]     = useState<DraftField[] | null>(null)
  const [saving,     setSaving]     = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Analyse IA ──────────────────────────────────────────────────────────────
  const analyzeFile = useCallback(async (file: File) => {
    setAnalyzeErr(null)
    setAnalyzeOk(false)
    setAnalyzing(true)

    try {
      // Convertit en base64
      const base64 = await fileToBase64(file)
      const { data: { session } } = await supabase.auth.getSession()

      const res = await supabase.functions.invoke('analyze-template', {
        body: { file_base64: base64, mime_type: file.type || 'application/pdf' },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })

      if (res.error) throw new Error(res.error.message)

      const result = res.data as { fields?: DraftField[]; error?: string }
      if (result.error) throw new Error(result.error)

      const proposed = (result.fields ?? []).map((f, i) => ({
        ...f,
        position: fields.length + i,
        active:   true,
      }))

      if (proposed.length === 0) {
        setAnalyzeErr('Aucun champ spécifique détecté dans ce document. Essayez avec une autre fiche ou ajoutez des champs manuellement.')
        setAnalyzing(false)
        return
      }

      setDrafts(proposed)
      setAnalyzeOk(true)
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : 'Erreur lors de l\'analyse')
    } finally {
      setAnalyzing(false)
    }
  }, [fields.length])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) analyzeFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) analyzeFile(file)
  }

  // ── Gestion des drafts ──────────────────────────────────────────────────────
  function changeDraft(index: number, patch: Partial<DraftField>) {
    setDrafts(prev => (prev ?? []).map((d, i) => i === index ? { ...d, ...patch } : d))
  }

  function deleteDraft(index: number) {
    setDrafts(prev => (prev ?? []).filter((_, i) => i !== index))
  }

  function addManualField() {
    const newField: DraftField = {
      field_key:     `champ_${Date.now()}`,
      field_label:   '',
      field_type:    'text',
      field_options: null,
      section:       null,
      position:      (drafts ?? fields).length,
      required:      false,
      active:        true,
    }
    setDrafts(prev => [...(prev ?? []), newField])
  }

  async function confirmDrafts() {
    if (!drafts || drafts.length === 0) return
    setSaving(true)
    try {
      // Fusionne les champs existants + les nouveaux drafts (évite les doublons de key)
      const existingKeys = new Set(fields.map(f => f.field_key))
      const toSave: DraftField[] = [
        ...fields.map(f => ({
          field_key:     f.field_key,
          field_label:   f.field_label,
          field_type:    f.field_type,
          field_options: f.field_options,
          section:       f.section,
          position:      f.position,
          required:      f.required,
          active:        f.active,
        })),
        ...drafts.filter(d => !existingKeys.has(d.field_key)),
      ]
      await saveFields(toSave)
      setDrafts(null)
      setAnalyzeOk(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Affichage principal ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-bold text-gray-900">Modèle de fiche chantier</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Importez votre fiche actuelle — l'IA en extraira les champs spécifiques. Vous pourrez les modifier avant d'enregistrer.
        </p>
      </div>

      {/* ── Zone d'import IA ────────────────────────────────────────────────── */}
      <section
        className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          dragOver
            ? 'border-orange-400 bg-orange-50'
            : 'border-gray-200 bg-gray-50/50 hover:border-orange-300 hover:bg-orange-50/30'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !analyzing && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
          {analyzing ? (
            <>
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-gray-700">Analyse en cours…</p>
              <p className="text-xs text-gray-400">L'IA analyse la structure de votre fiche</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #FEF3C7, #FED7AA)' }}>
                <Sparkles className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  {fields.length > 0 ? 'Réimporter un modèle' : 'Importer votre modèle de fiche'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">PDF, JPEG ou PNG · glissez-déposez ou cliquez</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Upload className="w-3.5 h-3.5" />
                <span>Analyser avec l'IA</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Erreur / Succès analyse ─────────────────────────────────────────── */}
      {analyzeErr && (
        <div className="flex items-start gap-2.5 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{analyzeErr}</p>
        </div>
      )}
      {analyzeOk && drafts && !analyzeErr && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-xl">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <p><strong>{drafts.length} champ{drafts.length > 1 ? 's' : ''}</strong> détecté{drafts.length > 1 ? 's' : ''} — vérifiez et confirmez ci-dessous.</p>
        </div>
      )}

      {/* ── Drafts (résultat IA ou champs manuels à confirmer) ─────────────── */}
      {drafts !== null && (
        <section className="space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }} >
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                {drafts.length} champ{drafts.length !== 1 ? 's' : ''} à intégrer
              </h3>
              <button
                type="button"
                onClick={addManualField}
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter manuellement
              </button>
            </div>

            <div className="space-y-2">
              {drafts.map((f, i) => (
                <DraftFieldRow
                  key={`${f.field_key}-${i}`}
                  field={f}
                  index={i}
                  onChange={changeDraft}
                  onDelete={deleteDraft}
                />
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setDrafts(null); setAnalyzeOk(false); setAnalyzeErr(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDrafts}
                disabled={saving || drafts.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
              >
                {saving ? 'Enregistrement…' : 'Confirmer et enregistrer'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Champs actifs existants ─────────────────────────────────────────── */}
      {fields.length > 0 && (
        <section className="bg-white rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Champs configurés ({fields.length})</h3>
            <button
              type="button"
              onClick={() => { setDrafts([]); setAnalyzeOk(false); setAnalyzeErr(null) }}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un champ
            </button>
          </div>
          <p className="text-xs text-gray-400">Activez / désactivez les champs sans les supprimer.</p>

          <div className="space-y-1.5">
            {fields.map(field => (
              <ActiveFieldRow
                key={field.id}
                field={field}
                onToggle={toggleActive}
                onDelete={async (id) => {
                  if (confirm('Supprimer ce champ ? Les données déjà saisies sur les chantiers existants seront conservées mais n\'apparaîtront plus.')) {
                    await deleteField(id)
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state (pas de champs, pas de draft) ─────────────────────── */}
      {fields.length === 0 && drafts === null && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-gray-500">
            Aucun champ personnalisé configuré.<br />
            Importez votre modèle ci-dessus ou ajoutez des champs manuellement.
          </p>
          <button
            type="button"
            onClick={() => { setDrafts([]); setAnalyzeErr(null) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer un champ manuellement
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || `champ_${Date.now()}`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => {
      const result = reader.result as string
      // Retire le préfixe "data:...;base64,"
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
